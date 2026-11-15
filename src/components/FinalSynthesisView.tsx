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
    const md = `# ${session.title}\n\n## Síntese Ultracompacta Final\n\n\`\`\`text\n${finalSyn.asciiTree}\n\`\`\`\n\n## Parecer da Sessão\n\n${finalSyn.closingFeedback}\n`;
    downloadTextFile(`${slugifyFilename(session.title)}-sintese.md`, md);
  };

  return (
    <section className="max-w-[1100px] mx-auto px-4 sm:px-8 py-10 space-y-8">
      <div className="bg-white dark:bg-[#1A1917] border border-[#E5E2DC] dark:border-[#2E2C28] rounded-xl p-6 sm:p-10 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-[#E5E2DC] dark:border-[#2E2C28]">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#047857] dark:text-[#34D399]">
              Treino Concluído · Síntese salva na nuvem para @{session.ownerUsername}
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#18181B] dark:text-[#F4F2ED]">
              {session.title}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onOpenLibrary}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#D6D3CD] dark:border-[#3A3732] bg-[#FAF9F6] dark:bg-[#141311] text-sm font-medium text-[#18181B] dark:text-[#F4F2ED] hover:border-[#18181B] dark:hover:border-[#F4F2ED] transition-colors cursor-pointer"
            >
              <BookMarked className="w-4 h-4" aria-hidden="true" />
              <span>Abrir Biblioteca</span>
            </button>
            <button
              type="button"
              onClick={onStartNewTraining}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#B45309] dark:bg-[#D97706] text-white text-sm font-semibold hover:bg-[#92400E] transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Novo Treino</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-[#FAF9F6] dark:bg-[#141311] border border-[#E5E2DC] dark:border-[#2E2C28]">
            <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">Rodadas concluídas</p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#18181B] dark:text-[#F4F2ED]">
              {session.rounds.filter((r) => r.evaluations.length > 0).length}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-[#FAF9F6] dark:bg-[#141311] border border-[#E5E2DC] dark:border-[#2E2C28]">
            <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">Subtópicos trabalhados</p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#18181B] dark:text-[#F4F2ED]">
              {finalSyn.topicsCoveredCount}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-[#FAF9F6] dark:bg-[#141311] border border-[#E5E2DC] dark:border-[#2E2C28]">
            <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">
              Pontos fracos consolidados
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#B45309] dark:text-[#F59E0B]">
              {finalSyn.masteredWeakPointsCount}
            </p>
          </div>
        </div>

        <div className="p-5 rounded-lg bg-[#F3F1EC] dark:bg-[#21201D] border border-[#E5E2DC] dark:border-[#2E2C28]">
          <p className="text-xs font-semibold text-[#18181B] dark:text-[#F4F2ED]">
            Parecer Final do Treinador
          </p>
          <p className="mt-1.5 text-sm sm:text-[15px] text-[#18181B] dark:text-[#F4F2ED] leading-relaxed">
            {finalSyn.closingFeedback}
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold text-[#18181B] dark:text-[#F4F2ED]">
                Síntese Ultracompacta Final
              </h2>
              <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">
                Árvore hierárquica com raízes em caixa alta, regras, exceções e diferenciais lógicos.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D6D3CD] dark:border-[#3A3732] bg-white dark:bg-[#141311] text-xs font-medium text-[#18181B] dark:text-[#F4F2ED] hover:border-[#18181B] dark:hover:border-[#F4F2ED] transition-colors cursor-pointer"
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D6D3CD] dark:border-[#3A3732] bg-white dark:bg-[#141311] text-xs font-medium text-[#18181B] dark:text-[#F4F2ED] hover:border-[#18181B] dark:hover:border-[#F4F2ED] transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>.txt</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadMd}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D6D3CD] dark:border-[#3A3732] bg-white dark:bg-[#141311] text-xs font-medium text-[#18181B] dark:text-[#F4F2ED] hover:border-[#18181B] dark:hover:border-[#F4F2ED] transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>.md</span>
              </button>
            </div>
          </div>

          <pre className="p-6 rounded-xl bg-[#18181B] dark:bg-[#0B0B0A] border border-transparent dark:border-[#2E2C28] text-[#FAF9F6] font-mono text-xs sm:text-[13px] leading-relaxed overflow-x-auto whitespace-pre">
            {finalSyn.asciiTree}
          </pre>
        </div>
      </div>
    </section>
  );
}
