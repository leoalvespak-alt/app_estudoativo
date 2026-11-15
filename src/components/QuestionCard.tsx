import { useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Columns3,
  Dices,
  HelpCircle,
  Loader2,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { fetchTheorySummary } from '../lib/api';
import { ERROR_CAUSE_LABELS } from '../lib/progressAnalytics';
import type {
  ConfidenceLevel,
  ErrorCause,
  OptionLetter,
  QuestionEvaluation,
  TheorySummaryContent,
  TrainerQuestion,
  Verdict,
} from '../types/trainer';

interface QuestionCardProps {
  index: number;
  question: TrainerQuestion;
  evaluation?: QuestionEvaluation;
  isEvaluated: boolean;
  isFocused?: boolean;
  disabled: boolean;
  sessionDiscipline?: string;
  isGeneratingComparative?: boolean;
  onFocusQuestion?: () => void;
  onChangeAnswer: (questionId: string, value: string) => void;
  onChangeRationale?: (questionId: string, value: string) => void;
  onSelectOption: (questionId: string, option: OptionLetter) => void;
  onSelectConfidence: (questionId: string, confidence: ConfidenceLevel) => void;
  onSelectErrorCause?: (questionId: string, cause: ErrorCause) => void;
  onRequestComparativeTable?: (
    question: TrainerQuestion,
    evaluation: QuestionEvaluation
  ) => void;
  onShortcutSubmit?: () => void;
}

const CONFIDENCE_OPTIONS: Array<{
  value: ConfidenceLevel;
  label: string;
  shortcutKey: string;
  Icon: typeof ShieldCheck;
}> = [
  { value: 'certain', label: 'Certeza', shortcutKey: 'C', Icon: ShieldCheck },
  { value: 'unsure', label: 'Dúvida', shortcutKey: 'D', Icon: HelpCircle },
  { value: 'guess', label: 'Chute', shortcutKey: 'X', Icon: Dices },
];

const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  certain: 'Certeza',
  unsure: 'Dúvida',
  guess: 'Chute',
};

const ERROR_CAUSE_ORDER: ErrorCause[] = [
  'lack_of_theory',
  'rushed_reading',
  'concept_confusion',
  'detail_slip',
];

const VERDICT_META: Record<
  Verdict,
  { label: string; colorClass: string; bgClass: string; Icon: typeof CheckCircle2 }
> = {
  correct: {
    label: 'Correto',
    colorClass: 'text-[#047857] dark:text-[#34D399]',
    bgClass:
      'bg-emerald-50/75 dark:bg-emerald-950/30 border-emerald-300/80 dark:border-emerald-800/70',
    Icon: CheckCircle2,
  },
  partial: {
    label: 'Parcial · Entra em reteste',
    colorClass: 'text-[#92400E] dark:text-[#FBBF24]',
    bgClass:
      'bg-[#F5F2EC] dark:bg-[#282522] border-[#D6D0C6] dark:border-[#45413B]',
    Icon: AlertTriangle,
  },
  incorrect: {
    label: 'Incorreto · Entra em reteste',
    colorClass: 'text-[#B91C1C] dark:text-[#F87171]',
    bgClass:
      'bg-red-50/75 dark:bg-red-950/30 border-red-300/80 dark:border-red-800/70',
    Icon: XCircle,
  },
};

function getFormatLabel(question: TrainerQuestion): string {
  if (question.format === 'true_false') {
    return 'Certo ou Errado';
  }
  if (question.format === 'practical_case') {
    return question.options.length > 0
      ? 'Mini-caso prático · A–E'
      : 'Mini-caso prático · Resposta curta';
  }
  if (question.format === 'multiple_choice' && question.options.length > 0) {
    return 'Múltipla escolha A–E';
  }
  return question.questionType || 'Pergunta aberta';
}

export function QuestionCard({
  index,
  question,
  evaluation,
  isEvaluated,
  isFocused = false,
  disabled,
  sessionDiscipline,
  isGeneratingComparative = false,
  onFocusQuestion,
  onChangeAnswer,
  onChangeRationale,
  onSelectOption,
  onSelectConfidence,
  onSelectErrorCause,
  onRequestComparativeTable,
  onShortcutSubmit,
}: QuestionCardProps) {
  const [showFullRationale, setShowFullRationale] = useState(false);
  const [showTheoryPanel, setShowTheoryPanel] = useState(false);
  const [theorySummary, setTheorySummary] = useState<TheorySummaryContent | null>(null);
  const [isLoadingTheory, setIsLoadingTheory] = useState(false);
  const [theoryError, setTheoryError] = useState<string | null>(null);

  const hasOptions = question.options.length > 0;
  const formatLabel = getFormatLabel(question);

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

  const needsErrorClassification = Boolean(
    isEvaluated &&
      evaluation &&
      (evaluation.verdict !== 'correct' || isLuckyGuess)
  );

  const baseVerdictMeta = evaluation ? VERDICT_META[evaluation.verdict] : null;
  let verdictLabel = baseVerdictMeta?.label || '';
  let verdictColorClass = baseVerdictMeta?.colorClass || '';
  let verdictBgClass = baseVerdictMeta?.bgClass || '';
  let VerdictIcon = baseVerdictMeta?.Icon;

  if (evaluation && isLuckyGuess) {
    verdictLabel = 'Acerto por chute · Entra em reforço';
    verdictColorClass = 'text-[#92400E] dark:text-[#FBBF24]';
    verdictBgClass =
      'bg-[#F5F2EC] dark:bg-[#282522] border-[#D6D0C6] dark:border-[#45413B]';
    VerdictIcon = Dices;
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

  const handleToggleTheorySummary = async () => {
    if (showTheoryPanel) {
      setShowTheoryPanel(false);
      return;
    }
    setShowTheoryPanel(true);
    if (theorySummary || isLoadingTheory) return;

    setIsLoadingTheory(true);
    setTheoryError(null);
    try {
      const result = await fetchTheorySummary({
        discipline: sessionDiscipline,
        concept: question.targetConcept || question.subtopic,
        subtopic: question.subtopic,
        expectedAnswer: evaluation?.expectedAnswer,
      });
      setTheorySummary(result);
    } catch (err) {
      setTheoryError(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar o resumo teórico agora.'
      );
    } finally {
      setIsLoadingTheory(false);
    }
  };

  return (
    <article
      onMouseDown={onFocusQuestion}
      onFocusCapture={onFocusQuestion}
      className={`bg-white dark:bg-[#22201D] border rounded-xl p-5 sm:p-6 transition-colors ${
        isFocused && !isEvaluated
          ? 'border-[#44403C] dark:border-[#9CA3AF]/60 ring-1 ring-[#44403C]/15 dark:ring-[#C2BCB2]/20'
          : 'border-[#E5E0D8] dark:border-[#36332E]'
      }`}
    >
      {question.isRetest && (
        <div className="mb-3 inline-flex flex-wrap items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-950/35 border border-[#D6D0C6] dark:border-[#45413B] text-xs font-semibold text-[#92400E] dark:text-[#FBBF24]">
          <RefreshCw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Reteste de fixação com novo cenário</span>
          {question.retestRule && (
            <span className="font-normal text-[#44403C] dark:text-[#D0CAC0]">
              · Regra: {question.retestRule}
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#44403C] dark:text-[#C2BCB2]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono font-semibold tabular-nums text-[#18181B] dark:text-[#EFECE6]">
            Pergunta {String(index + 1).padStart(2, '0')}
          </span>
          <span aria-hidden="true">·</span>
          <span>{question.subtopic}</span>
          <span aria-hidden="true">·</span>
          <span>{formatLabel}</span>
          {!question.isRetest && (
            <>
              <span aria-hidden="true">·</span>
              <span>Tópico novo</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isEvaluated && isFocused && (
            <span className="hidden sm:inline text-[11px] font-medium text-[#44403C] dark:text-[#C2BCB2]">
              Atalhos ativos
            </span>
          )}
          {isEvaluated && submittedConfidence && (
            <span className="text-xs font-medium text-[#44403C] dark:text-[#C2BCB2]">
              Confiança: {CONFIDENCE_LABELS[submittedConfidence]}
            </span>
          )}
        </div>
      </div>

      <h3 className="mt-3 reading-measure font-medium text-[#18181B] dark:text-[#EFECE6]">
        {question.prompt}
      </h3>

      {hasOptions ? (
        <div
          className="mt-4 space-y-2.5"
          role="radiogroup"
          aria-label={`Alternativas da pergunta ${index + 1}`}
        >
          {question.options.map((opt, optIdx) => {
            const isSelected = question.userSelectedOption === opt.label;
            const isCorrectOption =
              isEvaluated && evaluation?.correctOption === opt.label;
            const isWrongSelection =
              isEvaluated && isSelected && evaluation?.correctOption !== opt.label;

            let cardClasses =
              'border-[#D6D0C6] dark:border-[#45413B] bg-[#FAF8F5] dark:bg-[#1C1B19] hover:border-[#B45309] dark:hover:border-[#F59E0B]';
            if (!isEvaluated && isSelected) {
              cardClasses =
                'border-[#B45309] dark:border-[#F59E0B] bg-amber-50/75 dark:bg-[#282522]';
            } else if (isCorrectOption) {
              cardClasses =
                'border-emerald-500 dark:border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30';
            } else if (isWrongSelection) {
              cardClasses =
                'border-red-400 dark:border-red-500 bg-red-50/70 dark:bg-red-950/30';
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
                      ? 'bg-[#047857] text-[#FAF8F5] border-[#047857]'
                      : isWrongSelection
                        ? 'bg-[#B91C1C] text-[#FAF8F5] border-[#B91C1C]'
                        : isSelected
                          ? 'bg-[#B45309] dark:bg-[#F59E0B] text-[#FAF8F5] dark:text-[#141312] border-[#B45309] dark:border-[#F59E0B]'
                          : 'bg-white dark:bg-[#22201D] text-[#18181B] dark:text-[#EFECE6] border-[#D6D0C6] dark:border-[#45413B]'
                  }`}
                >
                  {opt.label}
                </span>
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-[15px] text-[#18181B] dark:text-[#EFECE6] leading-relaxed max-w-[65ch]">
                    {opt.text}
                  </p>
                  {isEvaluated && (isCorrectOption || isWrongSelection) && (
                    <p
                      className={`text-xs font-semibold ${
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

                {!isEvaluated && (
                  <kbd
                    aria-hidden="true"
                    className="hidden sm:inline-flex items-center justify-center px-1.5 py-0.5 rounded border border-[#D6D0C6] dark:border-[#45413B] bg-white dark:bg-[#22201D] font-mono text-[11px] text-[#44403C] dark:text-[#C2BCB2] tabular-nums shrink-0 mt-0.5"
                  >
                    {optIdx + 1}
                  </kbd>
                )}
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
            placeholder={
              question.format === 'practical_case'
                ? 'Escreva em poucas linhas a solução jurídica ou técnica para este caso...'
                : 'Escreva sua resposta direta e objetiva...'
            }
            className="w-full rounded-lg border border-[#D6D0C6] dark:border-[#45413B] bg-[#FAF8F5] dark:bg-[#141312] px-4 py-3 text-base text-[#18181B] dark:text-[#EFECE6] placeholder:text-[#57534E] dark:placeholder:text-[#A8A29E] focus:bg-white dark:focus:bg-[#1C1B19] focus:border-[#B45309] dark:focus:border-[#F59E0B] focus:outline-none transition-colors disabled:opacity-60 leading-[1.6]"
          />
        </div>
      ) : (
        <div className="mt-4 p-4 rounded-lg bg-[#FAF8F5] dark:bg-[#1C1B19] border border-[#E5E0D8] dark:border-[#36332E]">
          <p className="text-xs font-medium text-[#44403C] dark:text-[#C2BCB2]">
            Sua resposta
          </p>
          <p className="mt-1 reading-measure text-[#18181B] dark:text-[#EFECE6] whitespace-pre-wrap">
            {question.userAnswer.trim() || 'Não respondida'}
          </p>
        </div>
      )}

      {!isEvaluated && onChangeRationale && (
        <div className="mt-3">
          <label htmlFor={`rationale-${question.id}`} className="sr-only">
            Motivo da escolha na pergunta {index + 1} (opcional)
          </label>
          <input
            id={`rationale-${question.id}`}
            type="text"
            maxLength={280}
            disabled={disabled}
            value={question.userRationale || ''}
            onChange={(e) => onChangeRationale(question.id, e.target.value)}
            placeholder="Explique em poucas palavras o motivo da sua escolha (opcional)"
            className="w-full rounded-lg border border-[#E5E0D8] dark:border-[#36332E] bg-[#FAF8F5] dark:bg-[#1C1B19] px-3.5 py-2 text-xs sm:text-sm text-[#18181B] dark:text-[#EFECE6] placeholder:text-[#57534E] dark:placeholder:text-[#A8A29E] focus:bg-white dark:focus:bg-[#141312] focus:border-[#B45309] dark:focus:border-[#F59E0B] focus:outline-none transition-colors disabled:opacity-60"
          />
        </div>
      )}

      {!isEvaluated && (
        <div className="mt-4 pt-3 border-t border-[#E5E0D8] dark:border-[#36332E] flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-medium text-[#44403C] dark:text-[#C2BCB2]">
            Grau de confiança nesta resposta:
          </span>
          <div
            role="radiogroup"
            aria-label={`Confiança na pergunta ${index + 1}`}
            className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#F5F2EC] dark:bg-[#1C1B19] border border-[#E5E0D8] dark:border-[#36332E]"
          >
            {CONFIDENCE_OPTIONS.map(({ value, label, shortcutKey, Icon }) => {
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
                        ? 'bg-[#B45309] dark:bg-[#F59E0B] text-[#FAF8F5] dark:text-[#141312]'
                        : value === 'unsure'
                          ? 'bg-[#18181B] dark:bg-[#EFECE6] text-[#FAF8F5] dark:text-[#141312]'
                          : 'bg-[#047857] text-[#FAF8F5]'
                      : 'text-[#44403C] dark:text-[#D0CAC0] hover:text-[#18181B] dark:hover:text-[#EFECE6]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{label}</span>
                  <kbd
                    aria-hidden="true"
                    className={`hidden sm:inline font-mono text-[10px] px-1 rounded ${
                      active
                        ? 'opacity-85'
                        : 'text-[#57534E] dark:text-[#C2BCB2]'
                    }`}
                  >
                    {shortcutKey}
                  </kbd>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isEvaluated && evaluation && VerdictIcon && (
        <div className={`mt-4 p-4 sm:p-5 rounded-lg border space-y-3 ${verdictBgClass}`}>
          <div className={`flex items-center gap-2 text-sm font-semibold ${verdictColorClass}`}>
            <VerdictIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{verdictLabel}</span>
          </div>

          <p className="reading-measure text-[#18181B] dark:text-[#EFECE6]">
            {evaluation.feedback}
          </p>

          {(question.userRationale?.trim() || evaluation.rationaleFeedback) && (
            <div className="p-3.5 rounded-lg bg-white/80 dark:bg-[#1C1B19]/80 border border-black/10 dark:border-white/10 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#18181B] dark:text-[#EFECE6]">
                <MessageSquareText className="w-3.5 h-3.5 text-[#B45309] dark:text-[#F59E0B]" aria-hidden="true" />
                <span>Análise do seu raciocínio</span>
              </div>
              {question.userRationale?.trim() && (
                <p className="text-xs text-[#44403C] dark:text-[#C2BCB2] italic">
                  Você escreveu: “{question.userRationale.trim()}”
                </p>
              )}
              {evaluation.rationaleFeedback && (
                <p className="text-sm text-[#18181B] dark:text-[#EFECE6] reading-measure">
                  {evaluation.rationaleFeedback}
                </p>
              )}
            </div>
          )}

          {needsErrorClassification && onSelectErrorCause && (
            <div className="pt-3 border-t border-black/10 dark:border-white/10 space-y-2.5">
              <p className="text-xs font-semibold text-[#18181B] dark:text-[#EFECE6]">
                Qual foi a principal causa deste erro ou chute?
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ERROR_CAUSE_ORDER.map((cause) => {
                  const selected = evaluation.errorCause === cause;
                  return (
                    <button
                      key={cause}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => onSelectErrorCause(question.id, cause)}
                      className={`text-left px-3 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                        selected
                          ? 'bg-[#B45309] dark:bg-[#F59E0B] text-[#FAF8F5] dark:text-[#141312] border-[#B45309] dark:border-[#F59E0B]'
                          : 'bg-white dark:bg-[#1C1B19] text-[#18181B] dark:text-[#EFECE6] border-[#D6D0C6] dark:border-[#45413B] hover:border-[#B45309] dark:hover:border-[#F59E0B]'
                      }`}
                    >
                      {ERROR_CAUSE_LABELS[cause]}
                    </button>
                  );
                })}
              </div>

              {evaluation.errorCause === 'lack_of_theory' && (
                <div className="pt-1 space-y-2">
                  <button
                    type="button"
                    aria-expanded={showTheoryPanel}
                    onClick={handleToggleTheorySummary}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D6D0C6] dark:border-[#45413B] bg-white dark:bg-[#1C1B19] text-xs font-semibold text-[#B45309] dark:text-[#F59E0B] hover:border-[#B45309] dark:hover:border-[#F59E0B] cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>
                      {showTheoryPanel
                        ? 'Ocultar explicação teórica resumida'
                        : 'Ver explicação teórica resumida'}
                    </span>
                  </button>

                  {showTheoryPanel && (
                    <div className="p-3.5 rounded-lg bg-white dark:bg-[#1C1B19] border border-[#E5E0D8] dark:border-[#36332E] space-y-2 text-xs">
                      {isLoadingTheory ? (
                        <div className="flex items-center gap-2 text-[#44403C] dark:text-[#C2BCB2]">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                          <span>Montando explicação objetiva da regra...</span>
                        </div>
                      ) : theoryError ? (
                        <p className="text-[#B91C1C] dark:text-[#F87171]">{theoryError}</p>
                      ) : theorySummary ? (
                        <div className="space-y-2 reading-measure">
                          <div>
                            <p className="font-semibold text-[#18181B] dark:text-[#EFECE6]">
                              Regra central ({theorySummary.concept})
                            </p>
                            <p className="text-[#44403C] dark:text-[#D0CAC0]">
                              {theorySummary.coreRule}
                            </p>
                          </div>
                          <div>
                            <p className="font-semibold text-[#18181B] dark:text-[#EFECE6]">
                              Aplicação prática
                            </p>
                            <p className="text-[#44403C] dark:text-[#D0CAC0]">
                              {theorySummary.practicalExample}
                            </p>
                          </div>
                          <div>
                            <p className="font-semibold text-[#18181B] dark:text-[#EFECE6]">
                              Pegadinha frequente
                            </p>
                            <p className="text-[#44403C] dark:text-[#D0CAC0]">
                              {theorySummary.commonTrap}
                            </p>
                          </div>
                          <div>
                            <p className="font-semibold text-[#B45309] dark:text-[#F59E0B]">
                              Âncora de memorização
                            </p>
                            <p className="text-[#18181B] dark:text-[#EFECE6]">
                              {theorySummary.memoryAnchor}
                            </p>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              )}

              {evaluation.errorCause === 'concept_confusion' && onRequestComparativeTable && (
                <div className="pt-1">
                  <button
                    type="button"
                    disabled={isGeneratingComparative}
                    onClick={() => onRequestComparativeTable(question, evaluation)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D6D0C6] dark:border-[#45413B] bg-white dark:bg-[#1C1B19] text-xs font-semibold text-[#B45309] dark:text-[#F59E0B] hover:border-[#B45309] dark:hover:border-[#F59E0B] cursor-pointer disabled:opacity-50"
                  >
                    {isGeneratingComparative ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                        <span>Gerando quadro comparativo...</span>
                      </>
                    ) : (
                      <>
                        <Columns3 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Gerar quadro comparativo</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="pt-2 border-t border-black/10 dark:border-white/10">
            <button
              type="button"
              aria-expanded={showFullRationale}
              onClick={() => setShowFullRationale((prev) => !prev)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#B45309] dark:text-[#F59E0B] hover:underline underline-offset-4 cursor-pointer"
            >
              {showFullRationale ? (
                <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>
                {showFullRationale
                  ? 'Ocultar fundamentação teórica completa'
                  : 'Ver fundamentação teórica completa'}
              </span>
            </button>

            {showFullRationale && (
              <div className="mt-3 space-y-3 pt-2">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-[#18181B] dark:text-[#EFECE6]">
                    Resposta esperada
                  </p>
                  <p className="reading-measure text-[#18181B] dark:text-[#EFECE6]">
                    {evaluation.expectedAnswer}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-[#18181B] dark:text-[#EFECE6]">
                    Definição do conceito ({question.targetConcept})
                  </p>
                  <p className="reading-measure text-[#44403C] dark:text-[#D0CAC0]">
                    {evaluation.conceptDefinition}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
