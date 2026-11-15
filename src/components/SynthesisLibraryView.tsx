import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Download, Play, Search, Trash2 } from 'lucide-react';
import type {
  ComparativeTableEntry,
  LibraryEntry,
  TrainingSession,
} from '../types/trainer';
import {
  buildLibraryEntries,
  downloadTextFile,
  formatShortDate,
  slugifyFilename,
} from '../lib/storage';
import { buildComparativeMarkdown } from './ComparativeTableModal';

interface SynthesisLibraryViewProps {
  usernameKey: string;
  sessions: TrainingSession[];
  comparativeTables: ComparativeTableEntry[];
  initialSelectedEntryId?: string | null;
  onDeleteComparativeTable: (tableId: string) => void;
  onRetrainTopic: (topic: string) => void;
  onStartNewTraining: () => void;
}

type LibraryFilter =
  | 'all'
  | 'hierarchical_tree'
  | 'comparative_table'
  | 'strategic_synthesis'
  | 'prep_class';

const KIND_LABELS: Record<LibraryEntry['kind'], string> = {
  hierarchical_tree: 'Árvore Hierárquica',
  comparative_table: 'Quadro Comparativo',
  strategic_synthesis: 'Síntese Estratégica',
  prep_class: 'Aula Preparatória',
};

export function SynthesisLibraryView({
  usernameKey,
  sessions,
  comparativeTables,
  initialSelectedEntryId,
  onDeleteComparativeTable,
  onRetrainTopic,
  onStartNewTraining,
}: SynthesisLibraryViewProps) {
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedEntryId ?? null
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (initialSelectedEntryId) {
      setSelectedId(initialSelectedEntryId);
      if (initialSelectedEntryId.startsWith('lib_comp_')) {
        setFilter('all');
      }
    }
  }, [initialSelectedEntryId]);

  const entries = useMemo(
    () => buildLibraryEntries(sessions, comparativeTables),
    [sessions, comparativeTables]
  );

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (filter !== 'all' && entry.kind !== filter) return false;
      if (!q) return true;
      return (
        entry.title.toLowerCase().includes(q) ||
        entry.sessionTitle.toLowerCase().includes(q) ||
        entry.subtitle.toLowerCase().includes(q) ||
        (entry.asciiTree?.toLowerCase().includes(q) ?? false) ||
        (entry.comparativeTable?.conceptA.toLowerCase().includes(q) ?? false) ||
        (entry.comparativeTable?.conceptB.toLowerCase().includes(q) ?? false)
      );
    });
  }, [entries, filter, query]);

  const selectedEntry =
    filteredEntries.find((e) => e.id === selectedId) ?? filteredEntries[0] ?? null;

  const getPlainText = (entry: LibraryEntry): string => {
    if (entry.asciiTree) {
      return `${entry.title}\n\n${entry.asciiTree}\n\n${entry.closingFeedback || ''}`;
    }
    if (entry.comparativeTable) {
      return buildComparativeMarkdown(entry.comparativeTable);
    }
    if (entry.strategicSynthesis) {
      const syn = entry.strategicSynthesis;
      const defs = syn.keyDefinitions
        .map((d) => `- ${d.term}: ${d.definition}`)
        .join('\n');
      const insights = syn.adjacentInsights.map((i) => `- ${i}`).join('\n');
      return `${syn.title}\n\n${syn.focusSummary}\n\nDefinições:\n${defs}\n\nComplementos:\n${insights}`;
    }
    if (entry.prepClass) {
      const prep = entry.prepClass;
      const concepts = prep.concepts
        .map((c) => `- ${c.term}: ${c.definition} (Regra: ${c.keyRule})`)
        .join('\n');
      return `${entry.title}\n\n${prep.summary}\n\nConceitos:\n${concepts}\n\nAtenção:\n${prep.studyTips}`;
    }
    return entry.title;
  };

  const handleCopy = async (entry: LibraryEntry) => {
    try {
      await navigator.clipboard.writeText(getPlainText(entry));
      setCopiedId(entry.id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  if (entries.length === 0) {
    return (
      <section className="max-w-[920px] mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <div className="bg-white dark:bg-[#22201D] border border-[#E5E0D8] dark:border-[#36332E] rounded-xl p-6 sm:p-10 space-y-8">
          <div className="text-center space-y-3 max-w-xl mx-auto">
            <p className="text-xs font-medium text-[#44403C] dark:text-[#C2BCB2]">
              Acervo de revisões · {usernameKey}
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#18181B] dark:text-[#EFECE6]">
              Biblioteca de Sínteses
            </h1>
            <p className="reading-measure mx-auto text-[#44403C] dark:text-[#D0CAC0]">
              Suas árvores hierárquicas finais, quadros comparativos de conceitos, sínteses estratégicas (rodadas 3, 6 e 9) e aulas preparatórias da conta de {usernameKey} ficarão arquivadas aqui para consulta rápida ou exportação.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={onStartNewTraining}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#B45309] dark:bg-[#F59E0B] text-[#FAF8F5] dark:text-[#141312] text-sm font-semibold hover:bg-[#92400E] dark:hover:bg-[#FBBF24] transition-colors cursor-pointer"
              >
                <Play className="w-4 h-4" aria-hidden="true" />
                <span>Começar primeiro treino</span>
              </button>
            </div>
          </div>

          <div
            aria-hidden="true"
            className="grid grid-cols-1 md:grid-cols-12 gap-4 opacity-55 select-none pointer-events-none"
          >
            <div className="md:col-span-5 space-y-2.5">
              {[
                'Árvore Hierárquica',
                'Quadro Comparativo',
                'Síntese Estratégica (R3/R6/R9)',
              ].map((label) => (
                <div
                  key={label}
                  className="p-3.5 rounded-xl border border-dashed border-[#D6D0C6] dark:border-[#3E3A34] bg-[#FAF8F5] dark:bg-[#1C1B19] space-y-1.5"
                >
                  <p className="text-xs font-medium text-[#44403C] dark:text-[#C2BCB2]">
                    {label}
                  </p>
                  <div className="h-3 w-3/4 rounded bg-[#E5E0D8] dark:bg-[#36332E]" />
                </div>
              ))}
            </div>
            <div className="md:col-span-7 p-4 rounded-xl border border-dashed border-[#D6D0C6] dark:border-[#3E3A34] bg-[#FAF8F5] dark:bg-[#1C1B19] space-y-2.5">
              <p className="text-xs font-medium text-[#44403C] dark:text-[#C2BCB2]">
                Prévia de árvore e quadros comparativos
              </p>
              <div className="h-24 rounded-lg bg-[#E5E0D8]/70 dark:bg-[#282522] p-3 font-mono text-xs text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
                Tema Central
                <br />
                ├── 1. Subtópico principal e regra geral
                <br />
                └── 2. Exceções, prazos e pegadinhas
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-[1280px] mx-auto px-4 sm:px-8 py-8 sm:py-10 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-[#E5E0D8] dark:border-[#36332E]">
        <div>
          <p className="text-xs font-medium text-[#44403C] dark:text-[#C2BCB2] tabular-nums">
            Conta de {usernameKey} · {entries.length} material(is) salvo(s)
          </p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-semibold text-[#18181B] dark:text-[#EFECE6]">
            Biblioteca de Sínteses e Quadros
          </h1>
        </div>

        <div className="w-full sm:w-64 relative">
          <Search
            className="w-4 h-4 text-[#57534E] dark:text-[#C2BCB2] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por tema ou conceito..."
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-[#D6D0C6] dark:border-[#45413B] bg-white dark:bg-[#22201D] text-sm text-[#18181B] dark:text-[#EFECE6] placeholder:text-[#57534E] dark:placeholder:text-[#A8A29E] focus:border-[#B45309] dark:focus:border-[#F59E0B] focus:outline-none"
          />
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Filtrar materiais por tipo"
        className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#F5F2EC] dark:bg-[#1C1B19] border border-[#E5E0D8] dark:border-[#36332E] max-w-full"
      >
        {(
          [
            ['all', 'Todas'],
            ['hierarchical_tree', 'Árvores Hierárquicas'],
            ['comparative_table', 'Quadros Comparativos'],
            ['strategic_synthesis', 'Sínteses R3/R6/R9'],
            ['prep_class', 'Aulas Preparatórias'],
          ] as Array<[LibraryFilter, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            onClick={() => setFilter(key)}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              filter === key
                ? 'bg-white dark:bg-[#282522] text-[#18181B] dark:text-[#EFECE6] shadow-xs'
                : 'text-[#44403C] dark:text-[#C2BCB2] hover:text-[#18181B] dark:hover:text-[#EFECE6]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filteredEntries.length === 0 ? (
        <div className="bg-white dark:bg-[#22201D] border border-[#E5E0D8] dark:border-[#36332E] rounded-xl p-8 text-center text-sm text-[#44403C] dark:text-[#C2BCB2]">
          Nenhum material encontrado para os filtros aplicados.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 space-y-2.5 max-h-[680px] overflow-y-auto pr-1">
            {filteredEntries.map((entry) => {
              const isSelected = selectedEntry?.id === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSelectedId(entry.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-white dark:bg-[#282522] border-[#B45309] dark:border-[#F59E0B]'
                      : 'bg-[#FAF8F5] dark:bg-[#22201D] border-[#E5E0D8] dark:border-[#36332E] hover:bg-white dark:hover:bg-[#282522]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-[#44403C] dark:text-[#C2BCB2]">
                    <span className="font-semibold text-[#18181B] dark:text-[#EFECE6]">
                      {KIND_LABELS[entry.kind]}
                    </span>
                    <span>{formatShortDate(entry.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-[#18181B] dark:text-[#EFECE6] line-clamp-2">
                    {entry.title}
                  </p>
                  <p className="mt-1 text-xs text-[#44403C] dark:text-[#C2BCB2] truncate">
                    {entry.subtitle}
                  </p>
                </button>
              );
            })}
          </div>

          {selectedEntry && (
            <div className="lg:col-span-7 bg-white dark:bg-[#22201D] border border-[#E5E0D8] dark:border-[#36332E] rounded-xl p-6 sm:p-8 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[#E5E0D8] dark:border-[#36332E]">
                <div>
                  <p className="text-xs font-medium text-[#44403C] dark:text-[#C2BCB2]">
                    {KIND_LABELS[selectedEntry.kind]} · {formatShortDate(selectedEntry.createdAt)}
                  </p>
                  <h2 className="mt-1 font-display text-xl sm:text-2xl font-semibold text-[#18181B] dark:text-[#EFECE6]">
                    {selectedEntry.title}
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy(selectedEntry)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D6D0C6] dark:border-[#45413B] bg-[#FAF8F5] dark:bg-[#1C1B19] text-xs font-medium text-[#18181B] dark:text-[#EFECE6] hover:border-[#B45309] dark:hover:border-[#F59E0B] cursor-pointer"
                  >
                    {copiedId === selectedEntry.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#047857] dark:text-[#34D399]" aria-hidden="true" />
                        <span>Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadTextFile(
                        `${slugifyFilename(selectedEntry.title)}.md`,
                        getPlainText(selectedEntry)
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D6D0C6] dark:border-[#45413B] bg-[#FAF8F5] dark:bg-[#1C1B19] text-xs font-medium text-[#18181B] dark:text-[#EFECE6] hover:border-[#B45309] dark:hover:border-[#F59E0B] cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Exportar .md</span>
                  </button>
                  {selectedEntry.comparativeTable ? (
                    <button
                      type="button"
                      onClick={() =>
                        onDeleteComparativeTable(selectedEntry.comparativeTable!.id)
                      }
                      aria-label={`Excluir quadro ${selectedEntry.title}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E0D8] dark:border-[#36332E] text-xs font-medium text-[#44403C] dark:text-[#C2BCB2] hover:text-[#B91C1C] dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-700 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Excluir</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onRetrainTopic(selectedEntry.sessionTitle)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#B45309] dark:bg-[#F59E0B] text-[#FAF8F5] dark:text-[#141312] text-xs font-semibold hover:bg-[#92400E] dark:hover:bg-[#FBBF24] cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Treinar novamente</span>
                    </button>
                  )}
                </div>
              </div>

              {selectedEntry.asciiTree && (
                <div className="space-y-4">
                  <div className="p-5 sm:p-6 rounded-xl bg-[#FAF8F5] dark:bg-[#141312] border border-[#D6D0C6] dark:border-[#36332E] overflow-x-auto">
                    <pre className="max-w-[72ch] font-mono text-xs sm:text-[13px] leading-[1.7] text-[#18181B] dark:text-[#EFECE6] whitespace-pre-wrap break-words">
                      {selectedEntry.asciiTree}
                    </pre>
                  </div>
                  {selectedEntry.closingFeedback && (
                    <p className="reading-measure text-[#44403C] dark:text-[#D0CAC0]">
                      {selectedEntry.closingFeedback}
                    </p>
                  )}
                </div>
              )}

              {selectedEntry.comparativeTable && (
                <div className="space-y-4">
                  <div className="overflow-x-auto rounded-xl border border-[#E5E0D8] dark:border-[#36332E]">
                    <table className="w-full text-left border-collapse text-xs sm:text-sm">
                      <thead>
                        <tr className="bg-[#F5F2EC] dark:bg-[#1C1B19] border-b border-[#E5E0D8] dark:border-[#36332E] text-xs font-semibold text-[#18181B] dark:text-[#EFECE6]">
                          <th className="py-2.5 px-3 min-w-[120px]">Critério</th>
                          <th className="py-2.5 px-3 min-w-[140px]">
                            {selectedEntry.comparativeTable.conceptA}
                          </th>
                          <th className="py-2.5 px-3 min-w-[140px]">
                            {selectedEntry.comparativeTable.conceptB}
                          </th>
                          <th className="py-2.5 px-3 min-w-[150px]">
                            Diferença decisiva na prova
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E0D8] dark:divide-[#36332E]">
                        {selectedEntry.comparativeTable.rows.map((row, rIdx) => (
                          <tr
                            key={`${row.criterion}-${rIdx}`}
                            className="bg-white dark:bg-[#22201D] align-top"
                          >
                            <td className="py-2.5 px-3 font-semibold text-[#18181B] dark:text-[#EFECE6]">
                              {row.criterion}
                            </td>
                            <td className="py-2.5 px-3 text-[#44403C] dark:text-[#D0CAC0] leading-relaxed">
                              {row.conceptAValue}
                            </td>
                            <td className="py-2.5 px-3 text-[#44403C] dark:text-[#D0CAC0] leading-relaxed">
                              {row.conceptBValue}
                            </td>
                            <td className="py-2.5 px-3 text-[#18181B] dark:text-[#EFECE6] bg-[#FAF8F5]/75 dark:bg-[#1C1B19]/60 font-medium leading-relaxed">
                              {row.examDecisiveDiff}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {selectedEntry.comparativeTable.summaryTip && (
                    <div className="p-4 rounded-xl bg-[#F5F2EC] dark:bg-[#1C1B19] border border-[#E5E0D8] dark:border-[#36332E] space-y-1">
                      <p className="text-xs font-semibold text-[#B45309] dark:text-[#F59E0B]">
                        Regra rápida de prova
                      </p>
                      <p className="text-xs sm:text-sm text-[#18181B] dark:text-[#EFECE6] reading-measure">
                        {selectedEntry.comparativeTable.summaryTip}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {selectedEntry.strategicSynthesis && (
                <div className="space-y-4">
                  <p className="reading-measure text-[#18181B] dark:text-[#EFECE6]">
                    {selectedEntry.strategicSynthesis.focusSummary}
                  </p>
                  {selectedEntry.strategicSynthesis.keyDefinitions.length > 0 && (
                    <dl className="space-y-2.5">
                      {selectedEntry.strategicSynthesis.keyDefinitions.map((def, i) => (
                        <div
                          key={i}
                          className="p-4 rounded-lg bg-[#FAF8F5] dark:bg-[#1C1B19] border border-[#E5E0D8] dark:border-[#36332E]"
                        >
                          <dt className="text-sm font-semibold text-[#18181B] dark:text-[#EFECE6]">
                            {def.term}
                          </dt>
                          <dd className="mt-1 reading-measure text-sm text-[#44403C] dark:text-[#D0CAC0]">
                            {def.definition}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              )}

              {selectedEntry.prepClass && (
                <div className="space-y-4">
                  <p className="reading-measure text-[#18181B] dark:text-[#EFECE6]">
                    {selectedEntry.prepClass.summary}
                  </p>
                  <dl className="space-y-2.5">
                    {selectedEntry.prepClass.concepts.map((c, i) => (
                      <div
                        key={i}
                        className="p-4 rounded-lg bg-[#FAF8F5] dark:bg-[#1C1B19] border border-[#E5E0D8] dark:border-[#36332E]"
                      >
                        <dt className="text-sm font-semibold text-[#18181B] dark:text-[#EFECE6]">
                          {c.term}
                        </dt>
                        <dd className="mt-1 reading-measure text-sm text-[#44403C] dark:text-[#D0CAC0]">
                          {c.definition}
                        </dd>
                        <dd className="mt-1.5 text-xs font-medium text-[#18181B] dark:text-[#EFECE6]">
                          <strong className="text-[#44403C] dark:text-[#C2BCB2]">Regra:</strong>{' '}
                          {c.keyRule}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
