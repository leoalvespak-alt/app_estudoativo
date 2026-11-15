import { useEffect, useState } from 'react';
import { BookMarked, Check, Copy, Download, Sparkles, X } from 'lucide-react';
import type { ComparativeTableEntry } from '../types/trainer';
import { downloadTextFile, formatShortDate, slugifyFilename } from '../lib/storage';

interface ComparativeTableModalProps {
  table: ComparativeTableEntry | null;
  onClose: () => void;
  onOpenInLibrary: (tableId: string) => void;
}

export function buildComparativeMarkdown(table: ComparativeTableEntry): string {
  const header = `# ${table.title}\n\nDisciplina: ${table.discipline}\n\n| Critério de comparação | ${table.conceptA} | ${table.conceptB} | Diferença decisiva na prova |\n| --- | --- | --- | --- |\n`;
  const body = table.rows
    .map(
      (r) =>
        `| ${r.criterion.replace(/\|/g, '/')} | ${r.conceptAValue.replace(/\|/g, '/')} | ${r.conceptBValue.replace(/\|/g, '/')} | ${r.examDecisiveDiff.replace(/\|/g, '/')} |`
    )
    .join('\n');
  const tip = table.summaryTip ? `\n\n> Dica de ouro: ${table.summaryTip}\n` : '\n';
  return `${header}${body}${tip}`;
}

export function ComparativeTableModal({
  table,
  onClose,
  onOpenInLibrary,
}: ComparativeTableModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!table) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [table, onClose]);

  if (!table) return null;

  const markdown = buildComparativeMarkdown(table);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard failures in restricted frames
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="comparative-table-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/55 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[960px] max-h-[90vh] flex flex-col bg-white dark:bg-[#22201D] border border-[#D6D0C6] dark:border-[#36332E] rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 sm:px-7 py-4 border-b border-[#E5E0D8] dark:border-[#36332E] flex items-start justify-between gap-4 bg-[#FAF8F5] dark:bg-[#1C1B19]">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#44403C] dark:text-[#C2BCB2]">
              <span className="font-semibold text-[#B45309] dark:text-[#F59E0B] inline-flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                <span>
                  {table.triggerReason === 'auto_confusion'
                    ? 'Quadro automático de desambiguação'
                    : 'Quadro comparativo sob demanda'}
                </span>
              </span>
              <span aria-hidden="true">·</span>
              <span>{table.discipline}</span>
              <span aria-hidden="true">·</span>
              <span>{formatShortDate(table.createdAt)}</span>
            </div>
            <h2
              id="comparative-table-modal-title"
              className="font-display text-xl sm:text-2xl font-semibold text-[#18181B] dark:text-[#EFECE6]"
            >
              {table.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar quadro comparativo"
            className="p-2 rounded-lg text-[#44403C] dark:text-[#C2BCB2] hover:text-[#18181B] dark:hover:text-[#EFECE6] hover:bg-[#E5E0D8]/60 dark:hover:bg-[#36332E]/60 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 sm:p-7 overflow-y-auto space-y-5">
          <div className="overflow-x-auto rounded-xl border border-[#E5E0D8] dark:border-[#36332E]">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#F5F2EC] dark:bg-[#1C1B19] border-b border-[#E5E0D8] dark:border-[#36332E] text-xs font-semibold text-[#18181B] dark:text-[#EFECE6]">
                  <th className="py-3 px-4 w-[18%] min-w-[140px]">Critério de comparação</th>
                  <th className="py-3 px-4 w-[27%] min-w-[180px]">{table.conceptA}</th>
                  <th className="py-3 px-4 w-[27%] min-w-[180px]">{table.conceptB}</th>
                  <th className="py-3 px-4 w-[28%] min-w-[190px]">Diferença decisiva na prova</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E0D8] dark:divide-[#36332E]">
                {table.rows.map((row, idx) => (
                  <tr
                    key={`${row.criterion}-${idx}`}
                    className="bg-white dark:bg-[#22201D] align-top"
                  >
                    <td className="py-3 px-4 font-semibold text-[#18181B] dark:text-[#EFECE6]">
                      {row.criterion}
                    </td>
                    <td className="py-3 px-4 text-[#44403C] dark:text-[#D0CAC0] leading-relaxed">
                      {row.conceptAValue}
                    </td>
                    <td className="py-3 px-4 text-[#44403C] dark:text-[#D0CAC0] leading-relaxed">
                      {row.conceptBValue}
                    </td>
                    <td className="py-3 px-4 text-[#18181B] dark:text-[#EFECE6] bg-[#FAF8F5]/75 dark:bg-[#1C1B19]/60 font-medium leading-relaxed">
                      {row.examDecisiveDiff}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {table.summaryTip && (
            <div className="p-4 rounded-xl bg-[#F5F2EC] dark:bg-[#1C1B19] border border-[#E5E0D8] dark:border-[#36332E] space-y-1">
              <p className="text-xs font-semibold text-[#B45309] dark:text-[#F59E0B]">
                Regra rápida para não trocar os conceitos na hora da prova
              </p>
              <p className="text-sm text-[#18181B] dark:text-[#EFECE6] reading-measure">
                {table.summaryTip}
              </p>
            </div>
          )}
        </div>

        <div className="px-5 sm:px-7 py-4 border-t border-[#E5E0D8] dark:border-[#36332E] bg-[#FAF8F5] dark:bg-[#1C1B19] flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[#44403C] dark:text-[#C2BCB2]">
            Salvo automaticamente na sua Biblioteca de Sínteses.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D6D0C6] dark:border-[#45413B] bg-white dark:bg-[#22201D] text-xs font-medium text-[#18181B] dark:text-[#EFECE6] hover:border-[#B45309] dark:hover:border-[#F59E0B] cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#047857] dark:text-[#34D399]" aria-hidden="true" />
                  <span>Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Copiar tabela</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() =>
                downloadTextFile(
                  `${slugifyFilename(table.title)}-comparativo.md`,
                  markdown
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D6D0C6] dark:border-[#45413B] bg-white dark:bg-[#22201D] text-xs font-medium text-[#18181B] dark:text-[#EFECE6] hover:border-[#B45309] dark:hover:border-[#F59E0B] cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Exportar .md</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenInLibrary(`lib_comp_${table.id}`)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#B45309] dark:bg-[#F59E0B] text-[#FAF8F5] dark:text-[#141312] text-xs font-semibold hover:bg-[#92400E] dark:hover:bg-[#FBBF24] cursor-pointer"
            >
              <BookMarked className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Ver na Biblioteca</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
