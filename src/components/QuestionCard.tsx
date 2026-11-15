import { AlertTriangle, CheckCircle2, Dices, HelpCircle, ShieldCheck, XCircle } from 'lucide-react';
import type {
  ConfidenceLevel,
  OptionLetter,
  QuestionEvaluation,
  TrainerQuestion,
  Verdict,
} from '../types/trainer';

interface QuestionCardProps {
  index: number;
  question: TrainerQuestion;
  evaluation?: QuestionEvaluation;
  isEvaluated: boolean;
  disabled: boolean;
  onChangeAnswer: (questionId: string, value: string) => void;
  onSelectOption: (questionId: string, option: OptionLetter) => void;
  onSelectConfidence: (questionId: string, confidence: ConfidenceLevel) => void;
  onShortcutSubmit?: () => void;
}

const CONFIDENCE_OPTIONS: Array<{
  value: ConfidenceLevel;
  label: string;
  Icon: typeof ShieldCheck;
}> = [
  { value: 'certain', label: 'Certeza', Icon: ShieldCheck },
  { value: 'unsure', label: 'Dúvida', Icon: HelpCircle },
  { value: 'guess', label: 'Chute', Icon: Dices },
];

const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  certain: 'Certeza',
  unsure: 'Dúvida',
  guess: 'Chute',
};

const VERDICT_META: Record<
  Verdict,
  { label: string; colorClass: string; bgClass: string; Icon: typeof CheckCircle2 }
> = {
  correct: {
    label: 'Correto',
    colorClass: 'text-[#047857] dark:text-[#34D399]',
    bgClass:
      'bg-emerald-50/70 dark:bg-emerald-950/35 border-emerald-200 dark:border-emerald-800/70',
    Icon: CheckCircle2,
  },
  partial: {
    label: 'Parcial · Entra em reteste',
    colorClass: 'text-[#B45309] dark:text-[#FBBF24]',
    bgClass:
      'bg-amber-50/70 dark:bg-amber-950/35 border-amber-200 dark:border-amber-800/70',
    Icon: AlertTriangle,
  },
  incorrect: {
    label: 'Incorreto · Entra em reteste',
    colorClass: 'text-[#B91C1C] dark:text-[#F87171]',
    bgClass:
      'bg-red-50/70 dark:bg-red-950/35 border-red-200 dark:border-red-800/70',
    Icon: XCircle,
  },
};

export function QuestionCard({
  index,
  question,
  evaluation,
  isEvaluated,
  disabled,
  onChangeAnswer,
  onSelectOption,
  onSelectConfidence,
  onShortcutSubmit,
}: QuestionCardProps) {
  const isMultipleChoice =
    question.format === 'multiple_choice' && question.options.length > 0;

  const submittedConfidence = (evaluation?.confidenceAtSubmit ||
    question.confidence ||
    '') as ConfidenceLevel | '';
  const isLuckyGuess =
    Boolean(evaluation?.isLuckyGuess) ||
    (evaluation?.verdict === 'correct' && submittedConfidence === 'guess');
  const isConfidentError =
    Boolean(evaluation?.isConfidentError) ||
    (evaluation !== undefined &&
      evaluation.verdict !== 'correct' &&
      submittedConfidence === 'certain');

  const baseVerdictMeta = evaluation ? VERDICT_META[evaluation.verdict] : null;
  let verdictLabel = baseVerdictMeta?.label || '';
  let verdictColorClass = baseVerdictMeta?.colorClass || '';
  let verdictBgClass = baseVerdictMeta?.bgClass || '';
  let VerdictIcon = baseVerdictMeta?.Icon;

  if (evaluation && isLuckyGuess) {
    verdictLabel = 'Acerto por chute · Entra em reforço';
    verdictColorClass = 'text-[#B45309] dark:text-[#FBBF24]';
    verdictBgClass =
      'bg-amber-50/70 dark:bg-amber-950/35 border-amber-200 dark:border-amber-800/70';
    VerdictIcon = AlertTriangle;
  } else if (
    evaluation &&
    evaluation.verdict === 'correct' &&
    submittedConfidence === 'unsure'
  ) {
    verdictLabel = 'Correto (com dúvida)';
  } else if (evaluation && isConfidentError) {
    verdictLabel =
      evaluation.verdict === 'partial'
        ? 'Parcial com alta confiança · Entra em reteste'
        : 'Incorreto com certeza · Armadilha conceitual';
  }

  return (
    <article className="bg-white dark:bg-[#1A1917] border border-[#E5E2DC] dark:border-[#2E2C28] rounded-xl p-6 transition-colors">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#57534E] dark:text-[#A8A29E]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono font-medium tabular-nums text-[#18181B] dark:text-[#F4F2ED]">
            Pergunta {String(index + 1).padStart(2, '0')}
          </span>
          <span aria-hidden="true">·</span>
          <span>{question.subtopic}</span>
          <span aria-hidden="true">·</span>
          <span>{isMultipleChoice ? 'Múltipla escolha A–E' : question.questionType}</span>
          <span aria-hidden="true">·</span>
          <span
            className={
              question.isRetest ? 'font-semibold text-[#B45309] dark:text-[#F59E0B]' : ''
            }
          >
            {question.isRetest ? 'Reteste de ponto fraco' : 'Tópico novo'}
          </span>
        </div>

        {isEvaluated && submittedConfidence && (
          <span className="text-xs font-medium text-[#57534E] dark:text-[#A8A29E]">
            Confiança: {CONFIDENCE_LABELS[submittedConfidence]}
          </span>
        )}
      </div>

      <h3 className="mt-3 text-base sm:text-[17px] font-medium text-[#18181B] dark:text-[#F4F2ED] leading-relaxed">
        {question.prompt}
      </h3>

      {isMultipleChoice ? (
        <div
          className="mt-4 space-y-2.5"
          role="radiogroup"
          aria-label={`Alternativas da pergunta ${index + 1}`}
        >
          {question.options.map((opt) => {
            const isSelected = question.userSelectedOption === opt.label;
            const isCorrectOption =
              isEvaluated && evaluation?.correctOption === opt.label;
            const isWrongSelection =
              isEvaluated && isSelected && evaluation?.correctOption !== opt.label;

            let cardClasses =
              'border-[#D6D3CD] dark:border-[#34312C] bg-[#FAF9F6] dark:bg-[#141311] hover:border-[#B45309] dark:hover:border-[#F59E0B]';
            if (!isEvaluated && isSelected) {
              cardClasses =
                'border-[#B45309] dark:border-[#F59E0B] bg-amber-50/70 dark:bg-amber-950/35';
            } else if (isCorrectOption) {
              cardClasses =
                'border-emerald-500 dark:border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/35';
            } else if (isWrongSelection) {
              cardClasses =
                'border-red-400 dark:border-red-500 bg-red-50/70 dark:bg-red-950/35';
            }

            return (
              <button
                key={opt.label}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={disabled || isEvaluated}
                onClick={() => onSelectOption(question.id, opt.label)}
                className={`w-full text-left p-3.5 rounded-lg border transition-colors flex items-start gap-3.5 min-h-[44px] ${
                  disabled || isEvaluated ? 'cursor-default' : 'cursor-pointer'
                } ${cardClasses}`}
              >
                <span
                  className={`font-mono text-xs font-semibold w-7 h-7 rounded-md flex items-center justify-center shrink-0 border ${
                    isCorrectOption
                      ? 'bg-[#047857] text-white border-[#047857]'
                      : isWrongSelection
                        ? 'bg-[#B91C1C] text-white border-[#B91C1C]'
                        : isSelected
                          ? 'bg-[#B45309] dark:bg-[#D97706] text-white border-[#B45309] dark:border-[#D97706]'
                          : 'bg-white dark:bg-[#1E1D1A] text-[#18181B] dark:text-[#F4F2ED] border-[#D6D3CD] dark:border-[#3A3732]'
                  }`}
                >
                  {opt.label}
                </span>
                <div className="flex-1 space-y-1">
                  <p className="text-sm text-[#18181B] dark:text-[#F4F2ED] leading-relaxed">
                    {opt.text}
                  </p>
                  {isEvaluated && (isCorrectOption || isWrongSelection) && (
                    <p
                      className={`text-[11px] font-semibold ${
                        isCorrectOption
                          ? 'text-[#047857] dark:text-[#34D399]'
                          : 'text-[#B91C1C] dark:text-[#F87171]'
                      }`}
                    >
                      {isCorrectOption
                        ? isSelected
                          ? 'Sua escolha · Resposta correta'
                          : 'Resposta correta'
                        : 'Sua escolha · Incorreta'}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      ) : !isEvaluated ? (
        <div className="mt-4">
          <label htmlFor={`answer-${question.id}`} className="sr-only">
            Sua resposta para a pergunta {index + 1}
          </label>
          <textarea
            id={`answer-${question.id}`}
            rows={3}
            disabled={disabled}
            value={question.userAnswer}
            onChange={(e) => onChangeAnswer(question.id, e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && onShortcutSubmit) {
                e.preventDefault();
                onShortcutSubmit();
              }
            }}
            placeholder="Escreva sua resposta direta e objetiva..."
            className="w-full rounded-lg border border-[#D6D3CD] dark:border-[#3A3732] bg-[#FAF9F6] dark:bg-[#111110] px-4 py-3 text-[15px] text-[#18181B] dark:text-[#F4F2ED] placeholder:text-[#78716C] focus:bg-white dark:focus:bg-[#161513] focus:border-[#B45309] dark:focus:border-[#F59E0B] focus:outline-none transition-colors disabled:opacity-60"
          />
        </div>
      ) : (
        <div className="mt-5 p-4 rounded-lg bg-[#FAF9F6] dark:bg-[#141311] border border-[#E5E2DC] dark:border-[#2E2C28]">
          <p className="text-xs font-medium text-[#57534E] dark:text-[#A8A29E]">
            Sua resposta
          </p>
          <p className="mt-1 text-sm text-[#18181B] dark:text-[#F4F2ED] leading-relaxed whitespace-pre-wrap">
            {question.userAnswer.trim() || 'Não respondida'}
          </p>
        </div>
      )}

      {!isEvaluated && (
        <div className="mt-4 pt-3 border-t border-[#E5E2DC] dark:border-[#2E2C28] flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-medium text-[#57534E] dark:text-[#A8A29E]">
            Grau de confiança nesta resposta:
          </span>
          <div
            role="radiogroup"
            aria-label={`Confiança na pergunta ${index + 1}`}
            className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#F3F1EC] dark:bg-[#21201D] border border-[#E5E2DC] dark:border-[#2E2C28]"
          >
            {CONFIDENCE_OPTIONS.map(({ value, label, Icon }) => {
              const active = question.confidence === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={disabled}
                  onClick={() => onSelectConfidence(question.id, value)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 ${
                    active
                      ? value === 'guess'
                        ? 'bg-[#B45309] dark:bg-[#D97706] text-white'
                        : value === 'unsure'
                          ? 'bg-[#18181B] dark:bg-[#F4F2ED] text-[#FAF9F6] dark:text-[#111110]'
                          : 'bg-[#047857] text-white'
                      : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#18181B] dark:hover:text-[#F4F2ED]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isEvaluated && evaluation && VerdictIcon && (
        <div className={`mt-4 p-4 rounded-lg border space-y-3 ${verdictBgClass}`}>
          <div className={`flex items-center gap-2 text-sm font-semibold ${verdictColorClass}`}>
            <VerdictIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{verdictLabel}</span>
          </div>

          <p className="text-sm text-[#18181B] dark:text-[#F4F2ED] leading-relaxed">
            {evaluation.feedback}
          </p>

          <div className="pt-3 border-t border-black/10 dark:border-white/10 space-y-2">
            <p className="text-xs text-[#18181B] dark:text-[#F4F2ED] leading-relaxed">
              <span className="font-semibold">Resposta esperada: </span>
              {evaluation.expectedAnswer}
            </p>
            <p className="text-xs text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
              <span className="font-semibold text-[#18181B] dark:text-[#F4F2ED]">
                Definição do conceito ({question.targetConcept}):{' '}
              </span>
              {evaluation.conceptDefinition}
            </p>
          </div>
        </div>
      )}
    </article>
  );
}
