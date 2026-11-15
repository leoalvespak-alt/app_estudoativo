import { useMemo, useState } from 'react';
import { Check, Copy, Download, Play, Search } from 'lucide-react';
import type { LibraryEntry, TrainingSession } from '../types/trainer';
import {
  buildLibraryEntries,
  downloadTextFile,
  formatShortDate,
  slugifyFilename,
} from '../lib/storage';

interface SynthesisLibraryViewProps {
  usernameKey: string;
  sessions: TrainingSession[];
  onRetrainTopic: (topic: string) => void;
  onStartNewTraining: () => void;
}

type LibraryFilter = 'all' | 'final_tree' | 'strategic_synthesis' | 'prep_class';

const KIND_LABELS: Record<LibraryEntry['kind'], string> = {
  final_tree: 'Árvore Final',
  strategic_synthesis: 'Síntese Estratégica',
  prep_class: 'Aula Preparatória',
};

export function SynthesisLibraryView({
  usernameKey,
  sessions,
  onRetrainTopic,
  onStartNewTraining,
}: SynthesisLibraryViewProps) {
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const entries = useMemo(() => buildLibraryEntries(sessions), [sessions]);

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (filter !== 'all' && entry.kind !== filter) return false;
      if (!q) return true;
      return (
        entry.title.toLowerCase().includes(q) ||
        entry.sessionTitle.toLowerCase().includes(q) ||
        entry.subtitle.toLowerCase().includes(q) ||
        (entry.asciiTree?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [entries, filter, query]);

  const selectedEntry =
    filteredEntries.find((e) => e.id === selectedId) ?? filteredEntries[0] ?? null;

  const getPlainText = (entry: LibraryEntry): string => {
    if (entry.asciiTree) {
      return `${entry.title}\n\n${entry.asciiTree}\n\n${entry.closingFeedback || ''}`;
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
      <section className="max-w-[820px] mx-auto px-4 sm:px-8 py-14">
        <div className="bg-white dark:bg-[#1A1917] border border-[#E5E2DC] dark:border-[#2E2C28] rounded-xl p-8 sm:p-12 text-center space-y-4">
          <h1 className="font-display text-2xl font-semibold text-[#18181B] dark:text-[#F4F2ED]">
            Biblioteca de Sínteses
          </h1>
          <p className="text-sm sm:text-base text-[#57534E] dark:text-[#A8A29E] max-w-md mx-auto leading-relaxed">
            Suas aulas preparatórias, sínteses estratégicas (R3, R6, R9) e árvores ultracompactas finais da conta <span className="font-mono text-[#18181B] dark:text-[#F4F2ED]">@{usernameKey}</span> ficarão arquivadas na nuvem aqui.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={onStartNewTraining}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#B45309] dark:bg-[#D97706] text-white text-sm font-semibold hover:bg-[#92400E] transition-colors cursor-pointer"
            >
              <span>Iniciar Primeiro Treino</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-[1280px] mx-auto px-4 sm:px-8 py-8 sm:py-10 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-[#E5E2DC] dark:border-[#2E2C28]">
        <div>
          <p className="text-xs font-medium text-[#57534E] dark:text-[#A8A29E]">
            Nuvem de @{usernameKey} · {entries.length} materiais salvos
          </p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-semibold text-[#18181B] dark:text-[#F4F2ED]">
            Biblioteca de Sínteses
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search
              className="w-4 h-4 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por tema ou conceito..."
              className="pl-9 pr-4 py-2 rounded-lg border border-[#D6D3CD] dark:border-[#3A3732] bg-white dark:bg-[#1A1917] text-sm text-[#18181B] dark:text-[#F4F2ED] placeholder:text-[#78716C] focus:border-[#B45309] dark:focus:border-[#F59E0B] focus:outline-none w-64"
            />
          </div>
        </div>
      </div>

      <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#F3F1EC] dark:bg-[#21201D] border border-[#E5E2DC] dark:border-[#2E2C28]">
        {(
          [
            ['all', 'Todas'],
            ['final_tree', 'Árvores Finais'],
            ['strategic_synthesis', 'Sínteses R3/R6/R9'],
            ['prep_class', 'Aulas Preparatórias'],
          ] as Array<[LibraryFilter, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              filter === key
                ? 'bg-white dark:bg-[#111110] text-[#18181B] dark:text-[#F4F2ED] shadow-xs'
                : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#18181B] dark:hover:text-[#F4F2ED]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filteredEntries.length === 0 ? (
        <div className="bg-white dark:bg-[#1A1917] border border-[#E5E2DC] dark:border-[#2E2C28] rounded-xl p-8 text-center text-sm text-[#57534E] dark:text-[#A8A29E]">
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
                      ? 'bg-white dark:bg-[#1A1917] border-[#B45309] dark:border-[#F59E0B]'
                      : 'bg-[#FAF9F6] dark:bg-[#141311] border-[#E5E2DC] dark:border-[#2E2C28] hover:bg-white dark:hover:bg-[#1A1917]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-[#57534E] dark:text-[#A8A29E]">
                    <span className="font-medium text-[#B45309] dark:text-[#F59E0B]">
                      {KIND_LABELS[entry.kind]}
                    </span>
                    <span>{formatShortDate(entry.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-[#18181B] dark:text-[#F4F2ED] line-clamp-2">
                    {entry.title}
                  </p>
                  <p className="mt-1 text-xs text-[#57534E] dark:text-[#A8A29E] truncate">
                    {entry.subtitle}
                  </p>
                </button>
              );
            })}
          </div>

          {selectedEntry && (
            <div className="lg:col-span-7 bg-white dark:bg-[#1A1917] border border-[#E5E2DC] dark:border-[#2E2C28] rounded-xl p-6 sm:p-8 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[#E5E2DC] dark:border-[#2E2C28]">
                <div>
                  <p className="text-xs font-medium text-[#57534E] dark:text-[#A8A29E]">
                    {KIND_LABELS[selectedEntry.kind]} · {formatShortDate(selectedEntry.createdAt)}
                  </p>
                  <h2 className="mt-1 font-display text-xl sm:text-2xl font-semibold text-[#18181B] dark:text-[#F4F2ED]">
                    {selectedEntry.title}
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy(selectedEntry)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D6D3CD] dark:border-[#3A3732] bg-[#FAF9F6] dark:bg-[#141311] text-xs font-medium text-[#18181B] dark:text-[#F4F2ED] hover:border-[#18181B] dark:hover:border-[#F4F2ED] cursor-pointer"
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D6D3CD] dark:border-[#3A3732] bg-[#FAF9F6] dark:bg-[#141311] text-xs font-medium text-[#18181B] dark:text-[#F4F2ED] hover:border-[#18181B] dark:hover:border-[#F4F2ED] cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Exportar .md</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRetrainTopic(selectedEntry.sessionTitle)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#18181B] dark:bg-[#F4F2ED] text-[#FAF9F6] dark:text-[#111110] text-xs font-medium hover:bg-[#27272A] dark:hover:bg-[#E5E2DC] cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Treinar novamente</span>
                  </button>
                </div>
              </div>

              {selectedEntry.asciiTree && (
                <div className="space-y-4">
                  <pre className="p-5 rounded-xl bg-[#18181B] dark:bg-[#0B0B0A] border border-transparent dark:border-[#2E2C28] text-[#FAF9F6] font-mono text-xs leading-relaxed overflow-x-auto whitespace-pre">
                    {selectedEntry.asciiTree}
                  </pre>
                  {selectedEntry.closingFeedback && (
                    <p className="text-sm text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
                      {selectedEntry.closingFeedback}
                    </p>
                  )}
                </div>
              )}

              {selectedEntry.strategicSynthesis && (
                <div className="space-y-4">
                  <p className="text-sm text-[#18181B] dark:text-[#F4F2ED] leading-relaxed">
                    {selectedEntry.strategicSynthesis.focusSummary}
                  </p>
                  {selectedEntry.strategicSynthesis.keyDefinitions.length > 0 && (
                    <dl className="space-y-2.5">
                      {selectedEntry.strategicSynthesis.keyDefinitions.map((def, i) => (
                        <div
                          key={i}
                          className="p-3.5 rounded-lg bg-[#FAF9F6] dark:bg-[#141311] border border-[#E5E2DC] dark:border-[#2E2C28]"
                        >
                          <dt className="text-xs font-semibold text-[#18181B] dark:text-[#F4F2ED]">
                            {def.term}
                          </dt>
                          <dd className="mt-1 text-xs text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
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
                  <p className="text-sm text-[#18181B] dark:text-[#F4F2ED] leading-relaxed">
                    {selectedEntry.prepClass.summary}
                  </p>
                  <dl className="space-y-2.5">
                    {selectedEntry.prepClass.concepts.map((c, i) => (
                      <div
                        key={i}
                        className="p-3.5 rounded-lg bg-[#FAF9F6] dark:bg-[#141311] border border-[#E5E2DC] dark:border-[#2E2C28]"
                      >
                        <dt className="text-xs font-semibold text-[#18181B] dark:text-[#F4F2ED]">
                          {c.term}
                        </dt>
                        <dd className="mt-1 text-xs text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
                          {c.definition}
                        </dd>
                        <dd className="mt-1 text-xs text-[#B45309] dark:text-[#F59E0B]">
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
