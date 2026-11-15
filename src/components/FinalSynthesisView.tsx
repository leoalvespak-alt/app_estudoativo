import { useState } from 'react';
import { BookMarked, Check, Copy, Download, Plus } from 'lucide-react';
import type { TrainingSession } from '../types/trainer';
import { downloadTextFile, slugifyFilename } from '../lib/storage';

interface FinalSynthesisViewProps {
  session: TrainingSession;
  onStartNewTraining: () => void;
  onOpenLibrary: () => void;
}

export function FinalSynthesisView({
  session,
  onStartNewTraining,
  onOpenLibrary,
}: FinalSynthesisViewProps) {
  const [copied, setCopied] = useState(false);
  const finalSyn = session.finalSynthesis;

  if (!finalSyn) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(finalSyn.asciiTree);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  const handleDownloadTxt = () => {
    downloadTextFile(
      `${slugifyFilename(session.title)}-arvore.txt`,
      `${session.title.toUpperCase()}\n\n${finalSyn.asciiTree}\n\nParecer:\n${finalSyn.closingFeedback}`
    );
  };

  const handleDownloadMd = () => {
    const md = `# ${session.title}\n\n## Árvore Hierárquica da Sessão\n\n\`\`\`text\n${finalSyn.asciiTree}\n\`\`\`\n\n## Parecer da Sessão\n\n${finalSyn.closingFeedback}\n`;
    downloadTextFile(`${slugifyFilename(session.title)}-sintese.md`, md);
  };

  return (
    <section className="max-w-[1040px] mx-auto px-4 sm:px-8 py-8 sm:py-10 space-y-8">
      <div className="bg-white dark:bg-[#22201D] border border-[#E5E0D8] dark:border-[#36332E] rounded-xl p-6 sm:p-10 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-[#E5E0D8] dark:border-[#36332E]">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#047857] dark:text-[#34D399]">
              Treino concluído · Árvore salva na Biblioteca de {session.ownerUsername}
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#18181B] dark:text-[#EFECE6]">
              {session.title}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onOpenLibrary}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#D6D0C6] dark:border-[#45413B] bg-[#FAF8F5] dark:bg-[#1C1B19] text-sm font-medium text-[#18181B] dark:text-[#EFECE6] hover:border-[#B45309] dark:hover:border-[#F59E0B] transition-colors cursor-pointer"
            >
              <BookMarked className="w-4 h-4" aria-hidden="true" />
              <span>Abrir Biblioteca</span>
            </button>
            <button
              type="button"
              onClick={onStartNewTraining}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#B45309] dark:bg-[#F59E0B] text-[#FAF8F5] dark:text-[#141312] text-sm font-semibold hover:bg-[#92400E] dark:hover:bg-[#FBBF24] transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Novo Treino</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-[#FAF8F5] dark:bg-[#1C1B19] border border-[#E5E0D8] dark:border-[#36332E]">
            <p className="text-xs text-[#44403C] dark:text-[#C2BCB2]">Rodadas concluídas</p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#18181B] dark:text-[#EFECE6]">
              {session.rounds.filter((r) => r.evaluations.length > 0).length}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-[#FAF8F5] dark:bg-[#1C1B19] border border-[#E5E0D8] dark:border-[#36332E]">
            <p className="text-xs text-[#44403C] dark:text-[#C2BCB2]">Subtópicos trabalhados</p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#18181B] dark:text-[#EFECE6]">
              {finalSyn.topicsCoveredCount}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-[#FAF8F5] dark:bg-[#1C1B19] border border-[#E5E0D8] dark:border-[#36332E]">
            <p className="text-xs text-[#44403C] dark:text-[#C2BCB2]">
              Pontos fracos consolidados
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#18181B] dark:text-[#EFECE6]">
              {finalSyn.masteredWeakPointsCount}
            </p>
          </div>
        </div>

        <div className="p-5 rounded-lg bg-[#F5F2EC] dark:bg-[#1C1B19] border border-[#E5E0D8] dark:border-[#36332E]">
          <p className="text-xs font-semibold text-[#18181B] dark:text-[#EFECE6]">
            Parecer Final do Treinador
          </p>
          <p className="mt-1.5 reading-measure text-[#18181B] dark:text-[#EFECE6]">
            {finalSyn.closingFeedback}
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold text-[#18181B] dark:text-[#EFECE6]">
                Síntese Final em Árvore Hierárquica
              </h2>
              <p className="text-xs text-[#44403C] dark:text-[#C2BCB2]">
                Estrutura organizada em tema central, regras gerais, exceções/prazos e pontos de atenção das rodadas erradas ou chutadas.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D6D0C6] dark:border-[#45413B] bg-white dark:bg-[#1C1B19] text-xs font-medium text-[#18181B] dark:text-[#EFECE6] hover:border-[#B45309] dark:hover:border-[#F59E0B] transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#047857] dark:text-[#34D399]" aria-hidden="true" />
                    <span>Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Copiar Árvore</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleDownloadTxt}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D6D0C6] dark:border-[#45413B] bg-white dark:bg-[#1C1B19] text-xs font-medium text-[#18181B] dark:text-[#EFECE6] hover:border-[#B45309] dark:hover:border-[#F59E0B] transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>.txt</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadMd}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D6D0C6] dark:border-[#45413B] bg-white dark:bg-[#1C1B19] text-xs font-medium text-[#18181B] dark:text-[#EFECE6] hover:border-[#B45309] dark:hover:border-[#F59E0B] transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>.md</span>
              </button>
            </div>
          </div>

          <div className="p-5 sm:p-7 rounded-xl bg-[#FAF8F5] dark:bg-[#141312] border border-[#D6D0C6] dark:border-[#36332E] overflow-x-auto">
            <pre className="max-w-[72ch] font-mono text-xs sm:text-[13.5px] leading-[1.7] text-[#18181B] dark:text-[#EFECE6] whitespace-pre-wrap break-words">
              {finalSyn.asciiTree}
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
