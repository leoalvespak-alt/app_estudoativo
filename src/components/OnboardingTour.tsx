import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Compass, X } from 'lucide-react';

export interface TourStep {
  id: string;
  selector: string;
  title: string;
  description: string;
  practicalTip: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'sources',
    selector: '[data-tour="scope-sources"]',
    title: 'Escolha a fonte da sua sessão',
    description:
      'Alterne entre Tema Livre (com busca automática na sua base), Base de Estudos (Concursos) para selecionar leis e apostilas exatas, ou Texto Base para colar suas anotações.',
    practicalTip:
      'Para estudar legislação seca ou normas recentes de concurso, selecione os materiais na aba Base de Estudos.',
  },
  {
    id: 'form',
    selector: '[data-tour="scope-form"]',
    title: 'Defina o escopo e escolha como iniciar',
    description:
      'Informe o assunto do edital ou filtre os documentos do catálogo. Ao clicar em Definir Escopo e Avançar, você escolhe entre receber uma Aula Prévia concisa ou ir direto para a Rodada 1.',
    practicalTip:
      'Assunto novo ou denso? Comece com a Aula Prévia. Assunto já estudado? Vá direto ao treino.',
  },
  {
    id: 'progress',
    selector: '[data-tour="nav-progress"]',
    title: 'Aba Progresso e Banco de Pontos Fracos',
    description:
      'Acompanhe sua Retenção Real (excluindo chutes), veja a evolução por disciplina e dispare treinos sob demanda focados apenas nos conceitos em que você errou ou chutou.',
    practicalTip:
      'Use o botão "Treinar Pontos Fracos" em qualquer disciplina para revisar exatamente suas lacunas.',
  },
  {
    id: 'library',
    selector: '[data-tour="nav-library"]',
    title: 'Biblioteca de Sínteses e Árvores',
    description:
      'Todas as Aulas Prévias, Sínteses Estratégicas (rodadas 3, 6 e 9) e Árvores finais geradas nas suas sessões ficam salvas e prontas para copiar nesta aba.',
    practicalTip:
      'Ótimo lugar para fazer uma revisão rápida de 10 minutos na véspera da prova.',
  },
  {
    id: 'history',
    selector: '[data-tour="nav-history"]',
    title: 'Histórico salvo na sua conta',
    description:
      'Retome sessões pausadas exatamente de onde parou ou consulte rodadas já concluídas de qualquer dispositivo entrando com o mesmo nome de usuário.',
    practicalTip:
      'Seus rascunhos, respostas e avaliações ficam salvos automaticamente.',
  },
  {
    id: 'utility',
    selector: '[data-tour="utility-guide"]',
    title: 'Atalho permanente para Guia e Tour',
    description:
      'Sempre que quiser reler como o método funciona, revisar a tabela de confiança ou refazer este tour guiado, clique em Como funciona · Tour.',
    practicalTip:
      'Tudo pronto — agora escolha seu primeiro tema e comece a Rodada 1!',
  },
];

interface OnboardingTourProps {
  isOpen: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

interface SpotlightGeometry {
  top: number;
  left: number;
  width: number;
  height: number;
  viewportW: number;
  viewportH: number;
}

export function OnboardingTour({
  isOpen,
  onComplete,
  onSkip,
}: OnboardingTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [geometry, setGeometry] = useState<SpotlightGeometry | null>(null);

  const availableSteps = useMemo(() => {
    if (!isOpen) return TOUR_STEPS;
    const matched = TOUR_STEPS.filter((s) => Boolean(document.querySelector(s.selector)));
    return matched.length > 0 ? matched : TOUR_STEPS;
  }, [isOpen]);

  const safeIndex = Math.min(stepIndex, Math.max(0, availableSteps.length - 1));
  const currentStep = availableSteps[safeIndex];

  useEffect(() => {
    if (isOpen) {
      setStepIndex(0);
    }
  }, [isOpen]);

  const measureTarget = useCallback(() => {
    if (!isOpen || !currentStep) return;
    const el = document.querySelector(currentStep.selector) as HTMLElement | null;
    if (!el) {
      setGeometry(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    const pad = 8;
    setGeometry({
      top: Math.max(8, rect.top - pad),
      left: Math.max(8, rect.left - pad),
      width: Math.min(window.innerWidth - 16, rect.width + pad * 2),
      height: Math.min(window.innerHeight - 16, rect.height + pad * 2),
      viewportW: window.innerWidth,
      viewportH: window.innerHeight,
    });
  }, [isOpen, currentStep]);

  useEffect(() => {
    if (!isOpen || !currentStep) return;
    const el = document.querySelector(currentStep.selector) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }

    measureTarget();
    const t1 = window.setTimeout(measureTarget, 140);
    const t2 = window.setTimeout(measureTarget, 360);

    window.addEventListener('resize', measureTarget);
    window.addEventListener('scroll', measureTarget, true);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener('resize', measureTarget);
      window.removeEventListener('scroll', measureTarget, true);
    };
  }, [isOpen, currentStep, measureTarget]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onSkip();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (safeIndex >= availableSteps.length - 1) {
          onComplete();
        } else {
          setStepIndex((prev) => Math.min(availableSteps.length - 1, prev + 1));
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setStepIndex((prev) => Math.max(0, prev - 1));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, safeIndex, availableSteps.length, onComplete, onSkip]);

  if (!isOpen || !currentStep) return null;

  const isLastStep = safeIndex === availableSteps.length - 1;
  const isFirstStep = safeIndex === 0;

  const cardWidth = geometry ? Math.min(390, geometry.viewportW - 32) : 360;
  const estimatedCardHeight = 250;

  let cardTop = 96;
  let cardLeft = 16;

  if (geometry) {
    const spaceBelow = geometry.viewportH - (geometry.top + geometry.height);
    const spaceAbove = geometry.top;

    if (spaceBelow >= estimatedCardHeight + 16) {
      cardTop = geometry.top + geometry.height + 14;
    } else if (spaceAbove >= estimatedCardHeight + 16) {
      cardTop = Math.max(16, geometry.top - estimatedCardHeight - 14);
    } else {
      cardTop = Math.max(
        16,
        Math.min(geometry.viewportH - estimatedCardHeight - 16, geometry.viewportH / 2 - estimatedCardHeight / 2)
      );
    }

    const centeredLeft = geometry.left + geometry.width / 2 - cardWidth / 2;
    cardLeft = Math.max(
      16,
      Math.min(geometry.viewportW - cardWidth - 16, centeredLeft)
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-step-title"
      className="fixed inset-0 z-50"
    >
      {!geometry && (
        <div
          className="fixed inset-0 bg-[#141312]/70"
          onClick={onSkip}
          aria-hidden="true"
        />
      )}

      {geometry && (
        <>
          <div
            className="fixed inset-0"
            onClick={onSkip}
            aria-hidden="true"
          />

          <div
            aria-hidden="true"
            style={{
              top: `${geometry.top}px`,
              left: `${geometry.left}px`,
              width: `${geometry.width}px`,
              height: `${geometry.height}px`,
              boxShadow: '0 0 0 9999px rgba(20, 19, 18, 0.72)',
            }}
            className="fixed rounded-xl border-2 border-[#F59E0B] pointer-events-none transition-all duration-200"
          />
        </>
      )}

      <div
        style={{
          top: `${cardTop}px`,
          left: `${cardLeft}px`,
          width: `${cardWidth}px`,
        }}
        className="fixed z-[60] bg-white dark:bg-[#22201D] border border-[#E5E0D8] dark:border-[#45413B] rounded-xl p-5 shadow-xl space-y-4"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-[#44403C] dark:text-[#C2BCB2] tabular-nums">
            <Compass className="w-3.5 h-3.5 text-[#B45309] dark:text-[#F59E0B]" aria-hidden="true" />
            <span>
              Tour guiado · Passo {safeIndex + 1} de {availableSteps.length}
            </span>
          </span>

          <button
            type="button"
            onClick={onSkip}
            aria-label="Fechar tour guiado"
            className="p-1 rounded-md text-[#44403C] dark:text-[#C2BCB2] hover:text-[#18181B] dark:hover:text-[#EFECE6] cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-2">
          <h2
            id="tour-step-title"
            className="font-display text-lg font-semibold text-[#18181B] dark:text-[#EFECE6] leading-snug"
          >
            {currentStep.title}
          </h2>
          <p className="text-sm text-[#44403C] dark:text-[#D0CAC0] leading-relaxed">
            {currentStep.description}
          </p>
          <p className="text-xs text-[#18181B] dark:text-[#EFECE6] bg-[#F5F2EC] dark:bg-[#1C1B19] border border-[#E5E0D8] dark:border-[#36332E] rounded-lg px-3 py-2 leading-relaxed">
            {currentStep.practicalTip}
          </p>
        </div>

        <div className="pt-2 border-t border-[#E5E0D8] dark:border-[#36332E] flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onSkip}
            className="text-xs font-medium text-[#44403C] dark:text-[#C2BCB2] hover:text-[#18181B] dark:hover:text-[#EFECE6] underline underline-offset-4 cursor-pointer"
          >
            Pular tour
          </button>

          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <button
                type="button"
                onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#D6D0C6] dark:border-[#45413B] text-xs font-medium text-[#18181B] dark:text-[#EFECE6] hover:border-[#B45309] dark:hover:border-[#F59E0B] cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Anterior</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (isLastStep) {
                  onComplete();
                } else {
                  setStepIndex((prev) => Math.min(availableSteps.length - 1, prev + 1));
                }
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#B45309] dark:bg-[#F59E0B] text-[#FAF8F5] dark:text-[#141312] text-xs font-semibold hover:bg-[#92400E] dark:hover:bg-[#FBBF24] transition-colors cursor-pointer"
            >
              <span>{isLastStep ? 'Concluir tour' : 'Próximo'}</span>
              {isLastStep ? (
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
