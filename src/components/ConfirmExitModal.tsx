import { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmExitModalProps {
  isOpen: boolean;
  sessionTitle: string;
  onCancel: () => void;
  onConfirmExit: () => void;
}

export function ConfirmExitModal({
  isOpen,
  sessionTitle,
  onCancel,
  onConfirmExit,
}: ConfirmExitModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-exit-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-md bg-[#FAF8F5] dark:bg-[#22201D] border border-[#E5E0D8] dark:border-[#36332E] rounded-xl p-6 space-y-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 text-[#18181B] dark:text-[#EFECE6]">
            <AlertTriangle className="w-5 h-5 text-[#B45309] dark:text-[#F59E0B] shrink-0" aria-hidden="true" />
            <h2
              id="confirm-exit-title"
              className="font-display text-lg font-semibold leading-snug"
            >
              Pausar sessão de estudo?
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Fechar aviso"
            className="p-1 rounded-md text-[#44403C] dark:text-[#C2BCB2] hover:text-[#18181B] dark:hover:text-[#EFECE6] cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <p className="text-sm text-[#44403C] dark:text-[#C2BCB2] leading-relaxed">
          Seu progresso e rascunhos da sessão <strong className="text-[#18181B] dark:text-[#EFECE6]">{sessionTitle}</strong> ficam salvos para você retomar depois na aba Histórico.
        </p>

        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-[#E5E0D8] dark:border-[#36332E]">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-[#B45309] dark:bg-[#F59E0B] text-[#FAF8F5] dark:text-[#141312] text-xs font-semibold hover:bg-[#92400E] dark:hover:bg-[#FBBF24] transition-colors cursor-pointer"
          >
            Continuar estudando
          </button>
          <button
            type="button"
            onClick={onConfirmExit}
            className="px-4 py-2 rounded-lg border border-[#D6D0C6] dark:border-[#45413B] bg-white dark:bg-[#1C1B19] text-xs font-semibold text-[#18181B] dark:text-[#EFECE6] hover:border-[#B45309] dark:hover:border-[#F59E0B] transition-colors cursor-pointer"
          >
            Pausar e sair
          </button>
        </div>
      </div>
    </div>
  );
}
