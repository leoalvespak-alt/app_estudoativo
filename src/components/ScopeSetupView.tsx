import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  Eye,
  FileText,
  FolderOpen,
  Loader2,
  Play,
  Search,
  X,
} from 'lucide-react';
import { fetchKbCatalog, fetchKbDocumentPreview } from '../lib/api';
import type { KbMaterialItem, SourceType } from '../types/trainer';

interface ScopeSetupViewProps {
  pendingScope: {
    sourceType: SourceType;
    sourceContent: string;
    selectedKbPaths: string[];
  } | null;
  onConfirmScope: (
    sourceType: SourceType,
    sourceContent: string,
    selectedKbPaths: string[]
  ) => void;
  onChoosePath: (wantsPrepClass: boolean) => void;
  onResetScope: () => void;
  isLoading: boolean;
  errorMessage: string | null;
}

const MAX_SELECTED_DOCS = 10;

const EXAMPLE_TOPICS = [
  {
    label: 'Direito Tributário — Obrigação e Crédito Tributário',
    sourceType: 'topic' as const,
    content:
      'Direito Tributário: fato gerador, obrigação tributária principal e acessória, responsabilidade tributária, constituição do crédito tributário pelo lançamento, suspensão, extinção e exclusão no CTN.',
  },
  {
    label: 'Controle de Constitucionalidade no Brasil',
    sourceType: 'topic' as const,
    content:
      'Controle de Constitucionalidade no Direito Brasileiro: controle preventivo e repressivo, sistema difuso e concentrado, ADI, ADC, ADPF e modulação de efeitos.',
  },
  {
    label: 'Reforma Tributária — EC 132/2023 e LC 214/2025 (IBS e CBS)',
    sourceType: 'topic' as const,
    content:
      'Reforma Tributária (EC 132/2023 e LC 214/2025): IBS, CBS, Imposto Seletivo, não cumulatividade plena, cashback, regimes diferenciados e período de transição.',
  },
];

export function ScopeSetupView({
  pendingScope,
  onConfirmScope,
  onChoosePath,
  onResetScope,
  isLoading,
  errorMessage,
}: ScopeSetupViewProps) {
  const [sourceType, setSourceType] = useState<SourceType>(
    pendingScope?.sourceType ?? 'topic'
  );
  const [sourceContent, setSourceContent] = useState<string>(
    pendingScope?.sourceContent ?? ''
  );
  const [selectedKbPaths, setSelectedKbPaths] = useState<string[]>(
    pendingScope?.selectedKbPaths ?? []
  );
  const [selectedItemsMap, setSelectedItemsMap] = useState<Record<string, KbMaterialItem>>({});

  // Study base catalog browser state
  const [kbQuery, setKbQuery] = useState('');
  const [kbDiscipline, setKbDiscipline] = useState('');
  const [kbItems, setKbItems] = useState<KbMaterialItem[]>([]);
  const [kbDisciplines, setKbDisciplines] = useState<Array<{ name: string; count: number }>>([]);
  const [kbTotalCount, setKbTotalCount] = useState<number>(0);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Document preview modal state
  const [previewDoc, setPreviewDoc] = useState<{
    item: KbMaterialItem;
    excerpt: string;
    totalLength: number;
  } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (pendingScope) {
      setSourceType(pendingScope.sourceType);
      setSourceContent(pendingScope.sourceContent);
      setSelectedKbPaths(pendingScope.selectedKbPaths);
    }
  }, [pendingScope]);

  // Close preview modal with Esc
  useEffect(() => {
    if (!previewDoc) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setPreviewDoc(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [previewDoc]);

  useEffect(() => {
    if (sourceType !== 'git_kb' || pendingScope) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setIsLoadingCatalog(true);
      setCatalogError(null);
      try {
        const res = await fetchKbCatalog({
          q: kbQuery.trim() || undefined,
          discipline: kbDiscipline || undefined,
        });
        if (cancelled) return;
        setKbTotalCount(res.totalCount);
        setKbDisciplines(res.disciplines);
        setKbItems(res.items);
        setSelectedItemsMap((prev) => {
          const next = { ...prev };
          for (const item of res.items) {
            next[item.rawPath] = item;
          }
          return next;
        });
      } catch (err) {
        if (!cancelled) {
          setCatalogError(
            err instanceof Error
              ? err.message
              : 'Não foi possível carregar os materiais da base de estudos.'
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingCatalog(false);
        }
      }
    }, kbQuery ? 260 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [sourceType, kbQuery, kbDiscipline, pendingScope]);

  const selectedItemsList = useMemo(() => {
    return selectedKbPaths.map((rawPath) => ({
      rawPath,
      item: selectedItemsMap[rawPath],
    }));
  }, [selectedKbPaths, selectedItemsMap]);

  const toggleSelectKbItem = (item: KbMaterialItem) => {
    setSelectedItemsMap((prev) => ({ ...prev, [item.rawPath]: item }));
    setSelectedKbPaths((prev) => {
      if (prev.includes(item.rawPath)) {
        return prev.filter((p) => p !== item.rawPath);
      }
      if (prev.length >= MAX_SELECTED_DOCS) {
        return prev;
      }
      return [...prev, item.rawPath];
    });
  };

  const handleOpenPreview = async (item: KbMaterialItem) => {
    setPreviewError(null);
    setIsLoadingPreview(true);
    setPreviewDoc({ item, excerpt: '', totalLength: 0 });
    try {
      const data = await fetchKbDocumentPreview(item.rawPath);
      setPreviewDoc({
        item,
        excerpt: data.excerpt,
        totalLength: data.totalLength,
      });
    } catch (err) {
      setPreviewError(
        err instanceof Error ? err.message : 'Erro ao carregar prévia do material.'
      );
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleSubmitScope = (e: React.FormEvent) => {
    e.preventDefault();
    if (sourceType === 'git_kb') {
      if (selectedKbPaths.length === 0) return;
      const docTitles = selectedKbPaths.map(
        (p) => selectedItemsMap[p]?.title || p.split('/').pop() || p
      );
      const focus = sourceContent.trim();
      const combined = focus
        ? `${focus} — Materiais selecionados da Base de Estudos: ${docTitles.join(' | ')}`
        : `Estudo direcionado nos materiais da Base de Estudos: ${docTitles.join(' | ')}`;
      onConfirmScope('git_kb', combined.slice(0, 19000), selectedKbPaths);
      return;
    }

    if (!sourceContent.trim()) return;
    onConfirmScope(sourceType, sourceContent.trim(), []);
  };

  const canSubmit =
    sourceType === 'git_kb'
      ? selectedKbPaths.length > 0
      : Boolean(sourceContent.trim());

  if (pendingScope) {
    const scopeLabel =
      pendingScope.sourceType === 'weak_points'
        ? 'Banco de Erros · Treino Sob Demanda'
        : pendingScope.sourceType === 'git_kb'
          ? `Base de Estudos (${pendingScope.selectedKbPaths.length} material${pendingScope.selectedKbPaths.length === 1 ? '' : 'is'})`
          : pendingScope.sourceType === 'text'
            ? 'Texto base'
            : 'Tema livre · Consulta automática na base';

    return (
      <section className="max-w-[820px] mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <div className="bg-white dark:bg-[#22201D] border border-[#E5E0D8] dark:border-[#36332E] rounded-xl p-6 sm:p-9">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[#E5E0D8] dark:border-[#36332E]">
            <div className="space-y-1">
              <p className="text-xs font-medium text-[#44403C] dark:text-[#C2BCB2]">
                Escopo definido · {scopeLabel}
              </p>
              <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#18181B] dark:text-[#EFECE6]">
                Escolha como iniciar sua sessão
              </h1>
            </div>
            <button
              type="button"
              onClick={onResetScope}
              disabled={isLoading}
              className="text-sm font-medium text-[#B45309] dark:text-[#F59E0B] hover:underline underline-offset-4 cursor-pointer disabled:opacity-50"
            >
              Alterar escopo
            </button>
          </div>

          <div className="mt-5 p-4 rounded-lg bg-[#F5F2EC] dark:bg-[#1C1B19] border border-[#E5E0D8] dark:border-[#36332E] space-y-2">
            <p className="text-sm text-[#18181B] dark:text-[#EFECE6] leading-relaxed line-clamp-3">
              {pendingScope.sourceContent}
            </p>
            {pendingScope.selectedKbPaths.length > 0 && (
              <p className="text-xs text-[#44403C] dark:text-[#C2BCB2] tabular-nums">
                Referência principal: {pendingScope.selectedKbPaths.length} material(is) selecionado(s) da sua base de estudos
              </p>
            )}
          </div>

          <p className="mt-6 reading-measure font-medium text-[#18181B] dark:text-[#EFECE6]">
            Você prefere ver uma aula curta preparatória sobre os pontos que serão cobrados, ou quer ir direto para as questões do treino ativo?
          </p>

          {errorMessage && (
            <div
              role="alert"
              className="mt-5 p-4 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-sm text-[#B91C1C] dark:text-red-300"
            >
              {errorMessage}
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => onChoosePath(true)}
              className="text-left p-5 rounded-xl border border-[#D6D0C6] dark:border-[#45413B] bg-[#FAF8F5] dark:bg-[#1C1B19] hover:border-[#B45309] dark:hover:border-[#F59E0B] hover:bg-white dark:hover:bg-[#282522] transition-colors flex flex-col justify-between gap-5 cursor-pointer disabled:opacity-60"
            >
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-[#18181B] dark:text-[#EFECE6]">
                  <BookOpen className="w-4 h-4 text-[#B45309] dark:text-[#F59E0B]" aria-hidden="true" />
                  <span className="text-sm font-semibold">Aula Concisa Preparatória</span>
                </div>
                <p className="text-sm text-[#44403C] dark:text-[#C2BCB2] leading-relaxed">
                  Veja primeiro uma síntese direta com definições e regras-chave antes de começar a Rodada 1.
                </p>
              </div>
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#B45309] dark:text-[#F59E0B]">
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span>Preparando aula e plano...</span>
                  </>
                ) : (
                  <>
                    <span>Ver aula e depois treinar</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </>
                )}
              </span>
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => onChoosePath(false)}
              className="text-left p-5 rounded-xl border border-[#B45309] dark:border-[#F59E0B] bg-amber-50/50 dark:bg-[#282522] hover:bg-amber-50/80 dark:hover:bg-[#2E2A26] transition-colors flex flex-col justify-between gap-5 cursor-pointer disabled:opacity-60"
            >
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-[#18181B] dark:text-[#EFECE6]">
                  <Play className="w-4 h-4 text-[#B45309] dark:text-[#F59E0B]" aria-hidden="true" />
                  <span className="text-sm font-semibold">Direto para o Treino Ativo</span>
                </div>
                <p className="text-sm text-[#44403C] dark:text-[#C2BCB2] leading-relaxed">
                  Comece agora na Rodada 1 com questões mistas (abertas e A–E) e Sínteses Estratégicas a cada 3 rodadas.
                </p>
              </div>
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#B45309] dark:text-[#F59E0B]">
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span>Iniciando Rodada 1...</span>
                  </>
                ) : (
                  <>
                    <span>Ir direto para a Rodada 1</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </>
                )}
              </span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-[820px] mx-auto px-4 sm:px-8 py-6 sm:py-10">
      <div className="bg-white dark:bg-[#22201D] border border-[#E5E0D8] dark:border-[#36332E] rounded-xl p-6 sm:p-9">
        <p className="text-xs font-medium text-[#44403C] dark:text-[#C2BCB2]">
          Configurar Sessão de Estudo
        </p>
        <h1 className="mt-1.5 font-display text-2xl sm:text-3xl font-semibold text-[#18181B] dark:text-[#EFECE6]">
          Transforme qualquer matéria em retenção ativa
        </h1>
        <p className="mt-2.5 reading-measure text-[#44403C] dark:text-[#D0CAC0]">
          Escolha um tema livre, selecione leis e resumos da sua base de estudos ou cole suas anotações. O treino prioriza os materiais organizados e gera 10 rodadas progressivas.
        </p>

        <form
          data-tour="scope-form"
          onSubmit={handleSubmitScope}
          className="mt-6 space-y-5"
        >
          <div
            data-tour="scope-sources"
            role="tablist"
            aria-label="Tipo de fonte de estudo"
            className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#F5F2EC] dark:bg-[#1C1B19] border border-[#E5E0D8] dark:border-[#36332E] w-fit max-w-full"
          >
            <button
              type="button"
              role="tab"
              aria-selected={sourceType === 'topic'}
              onClick={() => setSourceType('topic')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                sourceType === 'topic'
                  ? 'bg-white dark:bg-[#282522] text-[#18181B] dark:text-[#EFECE6] shadow-xs'
                  : 'text-[#44403C] dark:text-[#C2BCB2] hover:text-[#18181B] dark:hover:text-[#EFECE6]'
              }`}
            >
              <BookOpen className="w-4 h-4" aria-hidden="true" />
              <span>Tema Livre</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sourceType === 'git_kb'}
              onClick={() => setSourceType('git_kb')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                sourceType === 'git_kb'
                  ? 'bg-white dark:bg-[#282522] text-[#18181B] dark:text-[#EFECE6] shadow-xs'
                  : 'text-[#44403C] dark:text-[#C2BCB2] hover:text-[#18181B] dark:hover:text-[#EFECE6]'
              }`}
            >
              <FolderOpen className="w-4 h-4" aria-hidden="true" />
              <span>Base de Estudos</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sourceType === 'text'}
              onClick={() => setSourceType('text')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                sourceType === 'text'
                  ? 'bg-white dark:bg-[#282522] text-[#18181B] dark:text-[#EFECE6] shadow-xs'
                  : 'text-[#44403C] dark:text-[#C2BCB2] hover:text-[#18181B] dark:hover:text-[#EFECE6]'
              }`}
            >
              <FileText className="w-4 h-4" aria-hidden="true" />
              <span>Texto Base / Anotações</span>
            </button>
          </div>

          {sourceType === 'git_kb' ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#18181B] dark:text-[#EFECE6]">
                  Catálogo de Materiais ({kbTotalCount > 0 ? `${kbTotalCount} arquivos` : 'base de estudos'})
                </p>
                <span className="text-xs font-mono tabular-nums text-[#44403C] dark:text-[#C2BCB2]">
                  Selecionados: {selectedKbPaths.length}/{MAX_SELECTED_DOCS}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-7 relative">
                  <Search
                    className="w-4 h-4 text-[#57534E] dark:text-[#C2BCB2] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    value={kbQuery}
                    onChange={(e) => setKbQuery(e.target.value)}
                    placeholder="Buscar por assunto, lei, banca ou título..."
                    className="w-full rounded-lg border border-[#D6D0C6] dark:border-[#45413B] bg-[#FAF8F5] dark:bg-[#141312] pl-9 pr-3 py-2 text-sm text-[#18181B] dark:text-[#EFECE6] placeholder:text-[#57534E] dark:placeholder:text-[#A8A29E] focus:bg-white dark:focus:bg-[#1C1B19] focus:border-[#B45309] dark:focus:border-[#F59E0B] focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-5">
                  <select
                    aria-label="Filtrar por disciplina"
                    value={kbDiscipline}
                    onChange={(e) => setKbDiscipline(e.target.value)}
                    className="w-full rounded-lg border border-[#D6D0C6] dark:border-[#45413B] bg-[#FAF8F5] dark:bg-[#141312] px-3 py-2 text-sm text-[#18181B] dark:text-[#EFECE6] focus:bg-white dark:focus:bg-[#1C1B19] focus:border-[#B45309] dark:focus:border-[#F59E0B] focus:outline-none"
                  >
                    <option value="">Todas as disciplinas</option>
                    {kbDisciplines.map((d) => (
                      <option key={d.name} value={d.name}>
                        {d.name} ({d.count})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedItemsList.length > 0 && (
                <div className="p-3 rounded-lg bg-[#F5F2EC] dark:bg-[#1C1B19] border border-[#E5E0D8] dark:border-[#36332E] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#44403C] dark:text-[#C2BCB2]">
                      Materiais selecionados para esta sessão
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedKbPaths([])}
                      className="text-xs font-medium text-[#B45309] dark:text-[#F59E0B] hover:underline underline-offset-2 cursor-pointer"
                    >
                      Limpar seleção
                    </button>
                  </div>
                  <ul className="space-y-1.5">
                    {selectedItemsList.map(({ rawPath, item }) => (
                      <li
                        key={rawPath}
                        className="flex items-center justify-between gap-2 text-xs text-[#18181B] dark:text-[#EFECE6]"
                      >
                        <span className="truncate">
                          {item ? `${item.title} · ${item.discipline}` : rawPath}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedKbPaths((prev) => prev.filter((p) => p !== rawPath))
                          }
                          aria-label={`Remover ${item?.title || rawPath}`}
                          className="p-1 text-[#57534E] dark:text-[#C2BCB2] hover:text-[#B91C1C] dark:hover:text-red-400 cursor-pointer shrink-0"
                        >
                          <X className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {catalogError ? (
                <div
                  role="alert"
                  className="p-3 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-xs text-[#B91C1C] dark:text-red-300"
                >
                  {catalogError}
                </div>
              ) : isLoadingCatalog && kbItems.length === 0 ? (
                <div className="py-10 flex items-center justify-center gap-2 text-sm text-[#44403C] dark:text-[#C2BCB2] border border-[#E5E0D8] dark:border-[#36332E] rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin text-[#B45309] dark:text-[#F59E0B]" aria-hidden="true" />
                  <span>Carregando materiais da base de estudos...</span>
                </div>
              ) : kbItems.length === 0 ? (
                <div className="py-8 text-center text-sm text-[#44403C] dark:text-[#C2BCB2] border border-[#E5E0D8] dark:border-[#36332E] rounded-lg">
                  Nenhum material encontrado para esse filtro.
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto divide-y divide-[#E5E0D8] dark:divide-[#36332E] border border-[#E5E0D8] dark:border-[#36332E] rounded-lg bg-[#FAF8F5] dark:bg-[#141312]">
                  {kbItems.map((item) => {
                    const isSelected = selectedKbPaths.includes(item.rawPath);
                    const isLimitReached =
                      !isSelected && selectedKbPaths.length >= MAX_SELECTED_DOCS;
                    const sizeKb = Math.max(1, Math.round(item.sizeBytes / 1024));

                    return (
                      <div
                        key={item.rawPath}
                        className={`flex items-start justify-between gap-3 p-3 transition-colors ${
                          isSelected
                            ? 'bg-amber-50/70 dark:bg-[#282522]'
                            : 'hover:bg-white dark:hover:bg-[#1C1B19]'
                        }`}
                      >
                        <button
                          type="button"
                          disabled={isLimitReached}
                          onClick={() => toggleSelectKbItem(item)}
                          className="flex-1 text-left flex items-start gap-3 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                        >
                          <span
                            className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                              isSelected
                                ? 'bg-[#B45309] dark:bg-[#F59E0B] border-[#B45309] dark:border-[#F59E0B] text-[#FAF8F5] dark:text-[#141312]'
                                : 'border-[#D6D0C6] dark:border-[#45413B] bg-white dark:bg-[#1C1B19]'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3" aria-hidden="true" />}
                          </span>
                          <span className="min-w-0 space-y-0.5">
                            <span className="block text-sm font-medium text-[#18181B] dark:text-[#EFECE6] leading-snug">
                              {item.title}
                            </span>
                            <span className="block text-xs text-[#44403C] dark:text-[#C2BCB2] tabular-nums">
                              {item.discipline} · {item.sourceLabel} · {sizeKb} KB
                            </span>
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenPreview(item)}
                          title="Visualizar conteúdo do material"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[#D6D0C6] dark:border-[#45413B] bg-white dark:bg-[#22201D] text-xs font-medium text-[#44403C] dark:text-[#D0CAC0] hover:text-[#18181B] dark:hover:text-[#EFECE6] hover:border-[#B45309] dark:hover:border-[#F59E0B] shrink-0 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Prévia</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div>
                <label
                  htmlFor="kb-focus-input"
                  className="block text-xs font-semibold text-[#18181B] dark:text-[#EFECE6] mb-1.5"
                >
                  Foco específico dentro dos materiais (opcional)
                </label>
                <input
                  id="kb-focus-input"
                  type="text"
                  value={sourceContent}
                  onChange={(e) => setSourceContent(e.target.value)}
                  placeholder="Ex.: focar em prazos, exceções e jurisprudência cobrada em provas"
                  className="w-full rounded-lg border border-[#D6D0C6] dark:border-[#45413B] bg-[#FAF8F5] dark:bg-[#141312] px-3.5 py-2.5 text-sm text-[#18181B] dark:text-[#EFECE6] placeholder:text-[#57534E] dark:placeholder:text-[#A8A29E] focus:bg-white dark:focus:bg-[#1C1B19] focus:border-[#B45309] dark:focus:border-[#F59E0B] focus:outline-none"
                />
              </div>
            </div>
          ) : (
            <>
              <div>
                <label
                  htmlFor="scope-input"
                  className="block text-sm font-semibold text-[#18181B] dark:text-[#EFECE6] mb-2"
                >
                  {sourceType === 'topic'
                    ? 'Qual assunto ou disciplina você quer treinar?'
                    : 'Cole o resumo, trecho de livro, lei ou anotações de aula'}
                </label>
                <textarea
                  id="scope-input"
                  rows={sourceType === 'topic' ? 3 : 7}
                  value={sourceContent}
                  onChange={(e) => setSourceContent(e.target.value)}
                  placeholder={
                    sourceType === 'topic'
                      ? 'Ex.: Direito Administrativo — Atos Administrativos (requisitos, atributos, extinção e convalidação)'
                      : 'Cole aqui o conteúdo de referência que servirá de base para as perguntas das 10 rodadas...'
                  }
                  className="w-full rounded-lg border border-[#D6D0C6] dark:border-[#45413B] bg-[#FAF8F5] dark:bg-[#141312] px-4 py-3 text-base text-[#18181B] dark:text-[#EFECE6] placeholder:text-[#57534E] dark:placeholder:text-[#A8A29E] focus:bg-white dark:focus:bg-[#1C1B19] focus:border-[#B45309] dark:focus:border-[#F59E0B] focus:outline-none transition-colors"
                />
                {sourceType === 'topic' && (
                  <p className="mt-2 text-xs text-[#44403C] dark:text-[#C2BCB2]">
                    Consulta automática ativada: ancorado nos materiais e resumos organizados da sua base de estudos.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-[#44403C] dark:text-[#C2BCB2]">
                  Sugestões rápidas para começar:
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {EXAMPLE_TOPICS.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        setSourceType(item.sourceType);
                        setSourceContent(item.content);
                      }}
                      className="text-xs font-medium text-[#B45309] dark:text-[#F59E0B] hover:underline underline-offset-4 cursor-pointer text-left"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#B45309] dark:bg-[#F59E0B] text-[#FAF8F5] dark:text-[#141312] text-sm font-semibold hover:bg-[#92400E] dark:hover:bg-[#FBBF24] transition-colors disabled:opacity-40 cursor-pointer"
            >
              <span>Definir Escopo e Avançar</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </form>
      </div>

      {previewDoc && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="kb-preview-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewDoc(null);
          }}
        >
          <div className="w-full max-w-2xl max-h-[82vh] flex flex-col bg-white dark:bg-[#22201D] border border-[#E5E0D8] dark:border-[#36332E] rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E5E0D8] dark:border-[#36332E] flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-[#44403C] dark:text-[#C2BCB2]">
                  {previewDoc.item.discipline} · {previewDoc.item.sourceLabel}
                </p>
                <h2
                  id="kb-preview-title"
                  className="mt-0.5 font-display text-lg font-semibold text-[#18181B] dark:text-[#EFECE6]"
                >
                  {previewDoc.item.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                aria-label="Fechar prévia"
                className="p-1.5 rounded-md text-[#44403C] dark:text-[#C2BCB2] hover:text-[#18181B] dark:hover:text-[#EFECE6] cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {isLoadingPreview ? (
                <div className="py-12 flex items-center justify-center gap-2 text-sm text-[#44403C] dark:text-[#C2BCB2]">
                  <Loader2 className="w-4 h-4 animate-spin text-[#B45309] dark:text-[#F59E0B]" aria-hidden="true" />
                  <span>Carregando conteúdo do material...</span>
                </div>
              ) : previewError ? (
                <p className="text-sm text-[#B91C1C] dark:text-red-300">{previewError}</p>
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-sm text-[#18181B] dark:text-[#EFECE6] leading-relaxed">
                  {previewDoc.excerpt}
                  {previewDoc.totalLength > previewDoc.excerpt.length && '\n\n[...]'}
                </pre>
              )}
            </div>

            <div className="px-6 py-3.5 border-t border-[#E5E0D8] dark:border-[#36332E] bg-[#F5F2EC] dark:bg-[#1C1B19] flex items-center justify-between gap-3">
              <span className="text-xs text-[#44403C] dark:text-[#C2BCB2] truncate">
                {previewDoc.item.discipline}
              </span>
              <button
                type="button"
                onClick={() => {
                  toggleSelectKbItem(previewDoc.item);
                  setPreviewDoc(null);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#B45309] dark:bg-[#F59E0B] text-[#FAF8F5] dark:text-[#141312] text-xs font-semibold hover:bg-[#92400E] dark:hover:bg-[#FBBF24] shrink-0 cursor-pointer"
              >
                {selectedKbPaths.includes(previewDoc.item.rawPath)
                  ? 'Remover da seleção'
                  : 'Selecionar este material'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
