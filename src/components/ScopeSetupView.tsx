import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  Eye,
  FileText,
  FolderGit2,
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

  // Git KB catalog browser state
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

  // Keep local form synchronized when pendingScope resets/repopulates (e.g. retrain from library)
  useEffect(() => {
    if (pendingScope) {
      setSourceType(pendingScope.sourceType);
      setSourceContent(pendingScope.sourceContent);
      setSelectedKbPaths(pendingScope.selectedKbPaths);
    }
  }, [pendingScope]);

  // Fetch Git KB catalog when Git tab is active (debounced for search query)
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
              : 'Não foi possível carregar os documentos do repositório Git.'
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
        err instanceof Error ? err.message : 'Erro ao carregar prévia do documento.'
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
        ? `${focus} — Documentos selecionados da Base Git: ${docTitles.join(' | ')}`
        : `Estudo direcionado nos documentos da Base Git: ${docTitles.join(' | ')}`;
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
          ? `Base Git (${pendingScope.selectedKbPaths.length} documento${pendingScope.selectedKbPaths.length === 1 ? '' : 's'})`
          : pendingScope.sourceType === 'text'
            ? 'Texto base'
            : 'Tema livre · Busca automática na Base Git';

    return (
      <section className="max-w-[920px] mx-auto px-4 sm:px-8 py-12">
        <div className="bg-white dark:bg-[#1A1917] border border-[#E5E2DC] dark:border-[#2E2C28] rounded-xl p-6 sm:p-10">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-[#E5E2DC] dark:border-[#2E2C28]">
            <div className="space-y-1">
              <p className="text-xs font-medium text-[#57534E] dark:text-[#A8A29E]">
                Escopo definido · {scopeLabel}
              </p>
              <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#18181B] dark:text-[#F4F2ED]">
                Escolha como iniciar sua sessão
              </h1>
            </div>
            <button
              type="button"
              onClick={onResetScope}
              disabled={isLoading}
              className="text-sm font-medium text-[#57534E] dark:text-[#A8A29E] hover:text-[#18181B] dark:hover:text-[#F4F2ED] underline underline-offset-4 cursor-pointer disabled:opacity-50"
            >
              Alterar escopo
            </button>
          </div>

          <div className="mt-6 p-4 rounded-lg bg-[#F3F1EC] dark:bg-[#21201D] border border-[#E5E2DC] dark:border-[#2E2C28] space-y-2">
            <p className="text-sm text-[#18181B] dark:text-[#F4F2ED] leading-relaxed line-clamp-3">
              {pendingScope.sourceContent}
            </p>
            {pendingScope.selectedKbPaths.length > 0 && (
              <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">
                Fonte primária: {pendingScope.selectedKbPaths.length} arquivo(s) selecionado(s) de{' '}
                <span className="font-mono">rota-base-conhecimento-estudos</span>
              </p>
            )}
          </div>

          <p className="mt-8 text-base sm:text-lg font-medium text-[#18181B] dark:text-[#F4F2ED] leading-relaxed">
            Você prefere receber uma aula concisa preparatória (completa, com o máximo de informações e o mínimo de palavras) sobre os pontos que serão treinados, ou quer ir direto para o treino ativo (com sínteses a cada 3 rodadas)?
          </p>

          {errorMessage && (
            <div
              role="alert"
              className="mt-6 p-4 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-sm text-[#B91C1C] dark:text-red-300"
            >
              {errorMessage}
            </div>
          )}

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => onChoosePath(true)}
              className="text-left p-6 rounded-xl border border-[#E5E2DC] dark:border-[#2E2C28] bg-[#FAF9F6] dark:bg-[#141311] hover:border-[#B45309] dark:hover:border-[#F59E0B] hover:bg-white dark:hover:bg-[#1F1D1A] transition-colors flex flex-col justify-between gap-6 cursor-pointer disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B45309]"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[#B45309] dark:text-[#F59E0B]">
                  <BookOpen className="w-5 h-5" aria-hidden="true" />
                  <span className="text-sm font-semibold">Aula Concisa Preparatória</span>
                </div>
                <p className="text-sm text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
                  Receba primeiro uma exposição densa e enxuta dos conceitos, regras e definições centrais antes de enfrentar a Rodada 1.
                </p>
              </div>
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#18181B] dark:text-[#F4F2ED]">
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span>Preparando aula e plano...</span>
                  </>
                ) : (
                  <>
                    <span>Receber aula e depois treinar</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </>
                )}
              </span>
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => onChoosePath(false)}
              className="text-left p-6 rounded-xl border border-[#B45309]/40 dark:border-[#F59E0B]/40 bg-amber-50/40 dark:bg-amber-950/25 hover:border-[#B45309] dark:hover:border-[#F59E0B] hover:bg-amber-50/70 dark:hover:bg-amber-950/40 transition-colors flex flex-col justify-between gap-6 cursor-pointer disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B45309]"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[#B45309] dark:text-[#F59E0B]">
                  <Play className="w-5 h-5" aria-hidden="true" />
                  <span className="text-sm font-semibold">Direto para o Treino Ativo</span>
                </div>
                <p className="text-sm text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
                  Comece imediatamente na Rodada 1 com questões mistas (abertas e múltipla escolha A–E) e Sínteses Estratégicas a cada 3 rodadas.
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
    <section className="max-w-[1280px] mx-auto px-4 sm:px-8 py-10 sm:py-14">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-7 bg-white dark:bg-[#1A1917] border border-[#E5E2DC] dark:border-[#2E2C28] rounded-xl p-6 sm:p-10">
          <p className="text-xs font-medium text-[#57534E] dark:text-[#A8A29E]">
            Treino Ativo · Base Primária Git Concursos
          </p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl font-semibold text-[#18181B] dark:text-[#F4F2ED] leading-tight">
            Transforme qualquer matéria em retenção ativa
          </h1>
          <p className="mt-3 text-base text-[#57534E] dark:text-[#A8A29E] leading-relaxed max-w-2xl">
            Escolha materiais do repositório <span className="font-mono text-sm">rota-base-conhecimento-estudos</span>, defina um tema livre ou cole anotações. O treinador prioriza a base Git e complementa lacunas com pesquisa web.
          </p>

          <form onSubmit={handleSubmitScope} className="mt-8 space-y-6">
            <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#F3F1EC] dark:bg-[#21201D] border border-[#E5E2DC] dark:border-[#2E2C28] w-fit max-w-full">
              <button
                type="button"
                onClick={() => setSourceType('topic')}
                className={`inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  sourceType === 'topic'
                    ? 'bg-white dark:bg-[#111110] text-[#18181B] dark:text-[#F4F2ED] shadow-xs'
                    : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#18181B] dark:hover:text-[#F4F2ED]'
                }`}
              >
                <BookOpen className="w-4 h-4" aria-hidden="true" />
                <span>Tema Livre</span>
              </button>
              <button
                type="button"
                onClick={() => setSourceType('git_kb')}
                className={`inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  sourceType === 'git_kb'
                    ? 'bg-white dark:bg-[#111110] text-[#18181B] dark:text-[#F4F2ED] shadow-xs'
                    : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#18181B] dark:hover:text-[#F4F2ED]'
                }`}
              >
                <FolderGit2 className="w-4 h-4" aria-hidden="true" />
                <span>Base Git (Concursos)</span>
              </button>
              <button
                type="button"
                onClick={() => setSourceType('text')}
                className={`inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  sourceType === 'text'
                    ? 'bg-white dark:bg-[#111110] text-[#18181B] dark:text-[#F4F2ED] shadow-xs'
                    : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#18181B] dark:hover:text-[#F4F2ED]'
                }`}
              >
                <FileText className="w-4 h-4" aria-hidden="true" />
                <span>Texto Base / Anotações</span>
              </button>
            </div>

            {sourceType === 'git_kb' ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[#18181B] dark:text-[#F4F2ED]">
                    Catálogo de Documentos ({kbTotalCount > 0 ? `${kbTotalCount} arquivos` : 'repositório Git'})
                  </p>
                  <span className="text-xs font-mono tabular-nums text-[#B45309] dark:text-[#F59E0B]">
                    Selecionados: {selectedKbPaths.length}/{MAX_SELECTED_DOCS}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-7 relative">
                    <Search
                      className="w-4 h-4 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      value={kbQuery}
                      onChange={(e) => setKbQuery(e.target.value)}
                      placeholder="Buscar por assunto, lei, banca ou título..."
                      className="w-full rounded-lg border border-[#D6D3CD] dark:border-[#3A3732] bg-[#FAF9F6] dark:bg-[#111110] pl-9 pr-3 py-2 text-sm text-[#18181B] dark:text-[#F4F2ED] placeholder:text-[#78716C] focus:bg-white dark:focus:bg-[#161513] focus:border-[#B45309] dark:focus:border-[#F59E0B] focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-5">
                    <select
                      aria-label="Filtrar por disciplina"
                      value={kbDiscipline}
                      onChange={(e) => setKbDiscipline(e.target.value)}
                      className="w-full rounded-lg border border-[#D6D3CD] dark:border-[#3A3732] bg-[#FAF9F6] dark:bg-[#111110] px-3 py-2 text-sm text-[#18181B] dark:text-[#F4F2ED] focus:bg-white dark:focus:bg-[#161513] focus:border-[#B45309] dark:focus:border-[#F59E0B] focus:outline-none"
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
                  <div className="p-3 rounded-lg bg-[#FAF9F6] dark:bg-[#141311] border border-[#E5E2DC] dark:border-[#2E2C28] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-[#57534E] dark:text-[#A8A29E]">
                        Documentos selecionados para esta sessão
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedKbPaths([])}
                        className="text-xs text-[#57534E] dark:text-[#A8A29E] hover:text-[#18181B] dark:hover:text-[#F4F2ED] underline underline-offset-2 cursor-pointer"
                      >
                        Limpar seleção
                      </button>
                    </div>
                    <ul className="space-y-1.5">
                      {selectedItemsList.map(({ rawPath, item }) => (
                        <li
                          key={rawPath}
                          className="flex items-center justify-between gap-2 text-xs text-[#18181B] dark:text-[#F4F2ED]"
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
                            className="p-1 text-[#78716C] hover:text-[#B91C1C] dark:hover:text-red-400 cursor-pointer shrink-0"
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
                  <div className="py-10 flex items-center justify-center gap-2 text-sm text-[#57534E] dark:text-[#A8A29E] border border-[#E5E2DC] dark:border-[#2E2C28] rounded-lg">
                    <Loader2 className="w-4 h-4 animate-spin text-[#B45309] dark:text-[#F59E0B]" aria-hidden="true" />
                    <span>Indexando documentos do GitHub...</span>
                  </div>
                ) : kbItems.length === 0 ? (
                  <div className="py-8 text-center text-sm text-[#57534E] dark:text-[#A8A29E] border border-[#E5E2DC] dark:border-[#2E2C28] rounded-lg">
                    Nenhum documento encontrado para esse filtro.
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto divide-y divide-[#E5E2DC] dark:divide-[#2E2C28] border border-[#E5E2DC] dark:border-[#2E2C28] rounded-lg bg-[#FAF9F6] dark:bg-[#111110]">
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
                              ? 'bg-amber-50/70 dark:bg-amber-950/25'
                              : 'hover:bg-white dark:hover:bg-[#1A1917]'
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
                                  ? 'bg-[#B45309] dark:bg-[#D97706] border-[#B45309] dark:border-[#D97706] text-white'
                                  : 'border-[#D6D3CD] dark:border-[#3A3732] bg-white dark:bg-[#161513]'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3" aria-hidden="true" />}
                            </span>
                            <span className="min-w-0 space-y-0.5">
                              <span className="block text-sm font-medium text-[#18181B] dark:text-[#F4F2ED] leading-snug">
                                {item.title}
                              </span>
                              <span className="block text-xs text-[#57534E] dark:text-[#A8A29E]">
                                {item.discipline} · {item.sourceLabel} · {sizeKb} KB
                              </span>
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenPreview(item)}
                            title="Visualizar conteúdo do documento"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[#D6D3CD] dark:border-[#3A3732] bg-white dark:bg-[#1A1917] text-xs font-medium text-[#57534E] dark:text-[#A8A29E] hover:text-[#18181B] dark:hover:text-[#F4F2ED] hover:border-[#18181B] dark:hover:border-[#F4F2ED] shrink-0 cursor-pointer"
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
                    className="block text-xs font-semibold text-[#18181B] dark:text-[#F4F2ED] mb-1.5"
                  >
                    Foco específico dentro dos documentos (opcional)
                  </label>
                  <input
                    id="kb-focus-input"
                    type="text"
                    value={sourceContent}
                    onChange={(e) => setSourceContent(e.target.value)}
                    placeholder="Ex.: focar em prazos, exceções e jurisprudência cobrada pela FGV/CESPE"
                    className="w-full rounded-lg border border-[#D6D3CD] dark:border-[#3A3732] bg-[#FAF9F6] dark:bg-[#111110] px-3.5 py-2.5 text-sm text-[#18181B] dark:text-[#F4F2ED] placeholder:text-[#78716C] focus:bg-white dark:focus:bg-[#161513] focus:border-[#B45309] dark:focus:border-[#F59E0B] focus:outline-none"
                  />
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label
                    htmlFor="scope-input"
                    className="block text-sm font-semibold text-[#18181B] dark:text-[#F4F2ED] mb-2"
                  >
                    {sourceType === 'topic'
                      ? 'Qual assunto ou disciplina você quer treinar?'
                      : 'Cole o resumo, trecho de livro, lei ou anotações de aula'}
                  </label>
                  <textarea
                    id="scope-input"
                    rows={sourceType === 'topic' ? 3 : 8}
                    value={sourceContent}
                    onChange={(e) => setSourceContent(e.target.value)}
                    placeholder={
                      sourceType === 'topic'
                        ? 'Ex.: Direito Administrativo — Atos Administrativos (requisitos, atributos, extinção e convalidação)'
                        : 'Cole aqui o conteúdo de referência que servirá de base para as perguntas das 10 rodadas...'
                    }
                    className="w-full rounded-lg border border-[#D6D3CD] dark:border-[#3A3732] bg-[#FAF9F6] dark:bg-[#111110] px-4 py-3 text-base text-[#18181B] dark:text-[#F4F2ED] placeholder:text-[#78716C] focus:bg-white dark:focus:bg-[#161513] focus:border-[#B45309] dark:focus:border-[#F59E0B] focus:outline-none transition-colors"
                  />
                  {sourceType === 'topic' && (
                    <p className="mt-2 text-xs text-[#57534E] dark:text-[#A8A29E]">
                      Busca automática ativada: os documentos correspondentes de{' '}
                      <span className="font-mono">rota-base-conhecimento-estudos</span> serão consultados como base primária.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-[#57534E] dark:text-[#A8A29E]">
                    Sugestões rápidas para testar:
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {EXAMPLE_TOPICS.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => {
                          setSourceType(item.sourceType);
                          setSourceContent(item.content);
                        }}
                        className="text-xs font-medium text-[#B45309] dark:text-[#F59E0B] hover:text-[#92400E] dark:hover:text-amber-300 underline underline-offset-4 cursor-pointer"
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
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#B45309] dark:bg-[#D97706] text-white text-sm font-semibold hover:bg-[#92400E] dark:hover:bg-[#B45309] transition-colors disabled:opacity-40 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B45309]"
              >
                <span>Definir Escopo e Avançar</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </form>
        </div>

        <aside className="lg:col-span-5 bg-[#F3F1EC] dark:bg-[#21201D] border border-[#E5E2DC] dark:border-[#2E2C28] rounded-xl p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="font-display text-xl font-semibold text-[#18181B] dark:text-[#F4F2ED]">
              Como funciona o método
            </h2>
            <p className="mt-1 text-sm text-[#57534E] dark:text-[#A8A29E]">
              Recordação ativa ancorada na sua base de concursos.
            </p>
          </div>

          <ol className="space-y-5 text-sm">
            <li className="pb-4 border-b border-[#E5E2DC] dark:border-[#2E2C28]">
              <p className="font-semibold text-[#18181B] dark:text-[#F4F2ED]">
                01. Base Git como fonte primária
              </p>
              <p className="mt-1 text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
                Cada sessão consulta primeiro os materiais e leis de <span className="font-mono text-xs">rota-base-conhecimento-estudos</span> e só complementa com base própria ou pesquisa web no que faltar.
              </p>
            </li>
            <li className="pb-4 border-b border-[#E5E2DC] dark:border-[#2E2C28]">
              <p className="font-semibold text-[#18181B] dark:text-[#F4F2ED]">
                02. Mix inteligente: abertas e A–E
              </p>
              <p className="mt-1 text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
                A IA equilibra múltipla escolha (A–E) em questões densas ou amplas e resposta aberta direta em retestes e cálculos.
              </p>
            </li>
            <li className="pb-4 border-b border-[#E5E2DC] dark:border-[#2E2C28]">
              <p className="font-semibold text-[#18181B] dark:text-[#F4F2ED]">
                03. Persistência em pontos fracos e sínteses
              </p>
              <p className="mt-1 text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
                O que você erra retorna em formato aberto na rodada seguinte. Após as rodadas 3, 6 e 9, você recebe uma Síntese Estratégica.
              </p>
            </li>
            <li>
              <p className="font-semibold text-[#18181B] dark:text-[#F4F2ED]">
                04. Prorrogação e Árvore ASCII na nuvem
              </p>
              <p className="mt-1 text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
                Se houver 2 ou mais erros na Rodada 10, abre-se uma prorrogação exclusiva. Ao concluir, sua árvore final fica salva no seu perfil Firebase.
              </p>
            </li>
          </ol>
        </aside>
      </div>

      {previewDoc && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="kb-preview-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
        >
          <div className="w-full max-w-2xl max-h-[82vh] flex flex-col bg-white dark:bg-[#1A1917] border border-[#E5E2DC] dark:border-[#2E2C28] rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E5E2DC] dark:border-[#2E2C28] flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-[#57534E] dark:text-[#A8A29E]">
                  {previewDoc.item.discipline} · {previewDoc.item.sourceLabel}
                </p>
                <h2
                  id="kb-preview-title"
                  className="mt-0.5 font-display text-lg font-semibold text-[#18181B] dark:text-[#F4F2ED]"
                >
                  {previewDoc.item.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                aria-label="Fechar prévia"
                className="p-1.5 rounded-md text-[#57534E] dark:text-[#A8A29E] hover:text-[#18181B] dark:hover:text-[#F4F2ED] cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {isLoadingPreview ? (
                <div className="py-12 flex items-center justify-center gap-2 text-sm text-[#57534E] dark:text-[#A8A29E]">
                  <Loader2 className="w-4 h-4 animate-spin text-[#B45309] dark:text-[#F59E0B]" aria-hidden="true" />
                  <span>Carregando conteúdo do GitHub...</span>
                </div>
              ) : previewError ? (
                <p className="text-sm text-[#B91C1C] dark:text-red-300">{previewError}</p>
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-sm text-[#18181B] dark:text-[#F4F2ED] leading-relaxed">
                  {previewDoc.excerpt}
                  {previewDoc.totalLength > previewDoc.excerpt.length && '\n\n[...]'}
                </pre>
              )}
            </div>

            <div className="px-6 py-3.5 border-t border-[#E5E2DC] dark:border-[#2E2C28] bg-[#FAF9F6] dark:bg-[#141311] flex items-center justify-between gap-3">
              <span className="text-xs font-mono text-[#57534E] dark:text-[#A8A29E] truncate">
                {previewDoc.item.relativePath}
              </span>
              <button
                type="button"
                onClick={() => {
                  toggleSelectKbItem(previewDoc.item);
                  setPreviewDoc(null);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#B45309] dark:bg-[#D97706] text-white text-xs font-semibold hover:bg-[#92400E] dark:hover:bg-[#B45309] shrink-0 cursor-pointer"
              >
                {selectedKbPaths.includes(previewDoc.item.rawPath)
                  ? 'Remover da seleção'
                  : 'Selecionar este documento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
