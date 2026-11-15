import { useEffect, useState } from 'react';
import { ArrowRight, ChevronDown, ChevronUp, Loader2, Send, Target } from 'lucide-react';
import type {
  ConfidenceLevel,
  ErrorCause,
  OptionLetter,
  QuestionEvaluation,
  StrategicSynthesis,
  TrainerQuestion,
  TrainingSession,
} from '../types/trainer';
import { QuestionCard } from './QuestionCard';
import { LateralProgressPanel } from './LateralProgressPanel';

interface TrainingWorkbenchProps {
  session: TrainingSession;
  sessionDiscipline: string;
  generatingComparativeQuestionId?: string | null;
  onChangeAnswer: (roundNumber: number, questionId: string, value: string) => void;
  onChangeRationale: (roundNumber: number, questionId: string, value: string) => void;
  onSelectOption: (
    roundNumber: number,
    questionId: string,
    option: OptionLetter
  ) => void;
  onSelectConfidence: (
    roundNumber: number,
    questionId: string,
    confidence: ConfidenceLevel
  ) => void;
  onSelectErrorCause: (
    roundNumber: number,
    questionId: string,
    cause: ErrorCause
  ) => void;
  onRequestComparativeTable: (
    question: TrainerQuestion,
    evaluation: QuestionEvaluation
  ) => void;
  onSubmitRound: () => void;
  onAdvanceRound: () => void;
  onFinishEarly: () => void;
  isSubmitting: boolean;
  isAdvancing: boolean;
  isFinalizing: boolean;
  errorMessage: string | null;
}

const OPTION_LETTERS: OptionLetter[] = ['A', 'B', 'C', 'D', 'E'];

function StrategicSynthesisCard({ synthesis }: { synthesis: StrategicSynthesis }) {
  return (
    <section
      aria-label={synthesis.title}
      className="bg-[#F5F2EC] dark:bg-[#1C1B19] border border-[#D6D0C6] dark:border-[#36332E] rounded-xl p-6 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#44403C] dark:text-[#C2BCB2] font-semibold">
        <span>Síntese Estratégica · Checkpoint após Rodada {synthesis.afterRound}</span>
      </div>

      <h2 className="font-display text-xl font-semibold text-[#18181B] dark:text-[#EFECE6]">
        {synthesis.title}
      </h2>

      <p className="reading-measure text-[#18181B] dark:text-[#EFECE6]">
        {synthesis.focusSummary}
      </p>

      {synthesis.keyDefinitions.length > 0 && (
        <div className="pt-3 border-t border-[#E5E0D8] dark:border-[#36332E] space-y-2.5">
          <p className="text-xs font-semibold text-[#18181B] dark:text-[#EFECE6]">
            Definições objetivas para consolidar a base
          </p>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {synthesis.keyDefinitions.map((item, idx) => (
              <div
                key={`${item.term}-${idx}`}
                className="p-3.5 rounded-lg bg-white dark:bg-[#22201D] border border-[#E5E0D8] dark:border-[#36332E]"
              >
                <dt className="text-xs font-semibold text-[#18181B] dark:text-[#EFECE6]">
                  {item.term}
                </dt>
                <dd className="mt-1 text-xs text-[#44403C] dark:text-[#D0CAC0] leading-relaxed">
                  {item.definition}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {synthesis.adjacentInsights.length > 0 && (
        <div className="pt-2 space-y-1.5">
          <p className="text-xs font-semibold text-[#18181B] dark:text-[#EFECE6]">
            Complementos estratégicos adjacentes
          </p>
          <ul className="space-y-1 text-xs text-[#44403C] dark:text-[#D0CAC0] list-disc pl-4 max-w-[68ch]">
            {synthesis.adjacentInsights.map((insight, idx) => (
              <li key={idx} className="leading-relaxed">
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function summarizeRoundFormats(questions: TrainerQuestion[]): string {
  const counts = {
    mc: 0,
    tf: 0,
    caseItem: 0,
    open: 0,
  };
  for (const q of questions) {
    if (q.format === 'true_false') counts.tf += 1;
    else if (q.format === 'practical_case') counts.caseItem += 1;
    else if (q.format === 'multiple_choice' && q.options.length > 0) counts.mc += 1;
    else counts.open += 1;
  }
  const parts: string[] = [];
  if (counts.mc > 0) parts.push(`${counts.mc} múltipla escolha`);
  if (counts.tf > 0) parts.push(`${counts.tf} certo/errado`);
  if (counts.caseItem > 0) parts.push(`${counts.caseItem} caso prático`);
  if (counts.open > 0) parts.push(`${counts.open} aberta${counts.open > 1 ? 's' : ''}`);
  return parts.join(' · ') || `${questions.length} questões`;
}

export function TrainingWorkbench({
  session,
  sessionDiscipline,
  generatingComparativeQuestionId,
  onChangeAnswer,
  onChangeRationale,
  onSelectOption,
  onSelectConfidence,
  onSelectErrorCause,
  onRequestComparativeTable,
  onSubmitRound,
  onAdvanceRound,
  onFinishEarly,
  isSubmitting,
  isAdvancing,
  isFinalizing,
  errorMessage,
}: TrainingWorkbenchProps) {
  const [showPastRounds, setShowPastRounds] = useState(false);
  const [focusedQuestionId, setFocusedQuestionId] = useState<string | null>(null);

  const activeRound = session.rounds[session.rounds.length - 1];
  const pastRounds = session.rounds.slice(0, -1);

  const activeQuestionIds = activeRound?.questions.map((q) => q.id).join('|') ?? '';

  // Keep focused question synced to first question whenever a new round loads
  useEffect(() => {
    if (activeRound && activeRound.questions.length > 0) {
      setFocusedQuestionId(activeRound.questions[0].id);
    }
  }, [activeRound?.roundNumber, activeQuestionIds]);

  const isEvaluated = Boolean(activeRound && activeRound.evaluations.length > 0);
  const allAnswered = Boolean(
    activeRound &&
      activeRound.questions.every((q) => {
        const hasAnswer =
          q.options.length > 0
            ? Boolean(q.userSelectedOption)
            : q.userAnswer.trim().length > 0;
        return hasAnswer && Boolean(q.confidence);
      })
  );

  // Keyboard shortcuts: 1-5 (options A-E), C/D/X (confidence), Enter (submit or advance)
  useEffect(() => {
    if (!activeRound) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // Never hijack shortcuts while a modal is open
      if (document.querySelector('[role="dialog"]')) return;

      // Never hijack shortcuts when typing inside inputs, textareas, selects, or contenteditable
      const target = e.target as HTMLElement | null;
      const activeEl = document.activeElement as HTMLElement | null;
      const isTextControl = (el: HTMLElement | null) => {
        if (!el) return false;
        const tag = el.tagName;
        return (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          el.isContentEditable
        );
      };
      if (isTextControl(target) || isTextControl(activeEl)) {
        return;
      }

      if (e.key === 'Enter') {
        const isRegularButton =
          activeEl?.tagName === 'BUTTON' &&
          activeEl.getAttribute('role') !== 'radio';
        if (isRegularButton) return;

        if (!isEvaluated && allAnswered && !isSubmitting && !isAdvancing && !isFinalizing) {
          e.preventDefault();
          onSubmitRound();
        } else if (isEvaluated && !isAdvancing && !isFinalizing && !isSubmitting) {
          e.preventDefault();
          onAdvanceRound();
        }
        return;
      }

      if (isEvaluated || isSubmitting || isAdvancing || isFinalizing) return;

      const targetQuestion =
        activeRound.questions.find((q) => q.id === focusedQuestionId) ??
        activeRound.questions[0];
      if (!targetQuestion) return;

      if (['1', '2', '3', '4', '5'].includes(e.key)) {
        if (targetQuestion.options.length > 0) {
          const optIdx = Number(e.key) - 1;
          const optLetter = OPTION_LETTERS[optIdx];
          if (optLetter && targetQuestion.options.some((o) => o.label === optLetter)) {
            e.preventDefault();
            onSelectOption(activeRound.roundNumber, targetQuestion.id, optLetter);
          }
        }
        return;
      }

      const lower = e.key.toLowerCase();
      if (lower === 'c') {
        e.preventDefault();
        onSelectConfidence(activeRound.roundNumber, targetQuestion.id, 'certain');
      } else if (lower === 'd') {
        e.preventDefault();
        onSelectConfidence(activeRound.roundNumber, targetQuestion.id, 'unsure');
      } else if (lower === 'x') {
        e.preventDefault();
        onSelectConfidence(activeRound.roundNumber, targetQuestion.id, 'guess');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeRound,
    focusedQuestionId,
    isEvaluated,
    allAnswered,
    isSubmitting,
    isAdvancing,
    isFinalizing,
    onSelectOption,
    onSelectConfidence,
    onSubmitRound,
    onAdvanceRound,
  ]);

  if (!activeRound) {
    return null;
  }

  const roundErrorsCount = activeRound.evaluations.filter(
    (e) => e.verdict !== 'correct' || e.weakPointTriggered
  ).length;
  const luckyGuessesInRound = activeRound.evaluations.filter(
    (e) => e.isLuckyGuess
  ).length;

  const latestSynthesis =
    !activeRound.isOvertime &&
    (activeRound.roundNumber === 4 ||
      activeRound.roundNumber === 7 ||
      activeRound.roundNumber === 10)
      ? session.strategicSyntheses.find(
          (s) => s.afterRound === activeRound.roundNumber - 1
        )
      : undefined;

  const isRound10 = !activeRound.isOvertime && activeRound.roundNumber === 10;
  const unresolvedAfterOvertime = session.activeWeakPoints.filter((wp) => !wp.resolved).length;

  let nextActionLabel = `Avançar para Rodada ${activeRound.roundNumber + 1}`;
  if (isEvaluated) {
    if (isRound10) {
      nextActionLabel =
        roundErrorsCount >= 2
          ? 'Iniciar Prorrogação (Sanar Erros)'
          : 'Concluir e Gerar Árvore Final';
    } else if (activeRound.isOvertime) {
      nextActionLabel =
        unresolvedAfterOvertime > 0 && roundErrorsCount > 0
          ? `Continuar Prorrogação (Rodada ${activeRound.roundNumber + 1})`
          : 'Concluir Prorrogação e Gerar Árvore Final';
    } else if (
      activeRound.roundNumber === 3 ||
      activeRound.roundNumber === 6 ||
      activeRound.roundNumber === 9
    ) {
      nextActionLabel = `Gerar Síntese Estratégica e Rodada ${activeRound.roundNumber + 1}`;
    }
  }

  const formatSummary = summarizeRoundFormats(activeRound.questions);

  return (
    <section className="max-w-[1280px] mx-auto px-4 sm:px-8 py-6 sm:py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Mobile/Tablet Collapsible Session Panel */}
        <div className="lg:hidden">
          <LateralProgressPanel
            session={session}
            onFinishEarly={onFinishEarly}
            isFinalizing={isFinalizing}
          />
        </div>

        <div className="lg:col-span-8 space-y-6">
          <div className="pb-4 border-b border-[#E5E0D8] dark:border-[#36332E] flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1.5">
              {session.surgicalFocus?.label && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-950/35 border border-[#D6D0C6] dark:border-[#45413B] text-xs font-semibold text-[#92400E] dark:text-[#FBBF24]">
                  <Target className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{session.surgicalFocus.label}</span>
                </div>
              )}

              <p className="text-xs font-medium text-[#44403C] dark:text-[#C2BCB2] tabular-nums">
                {activeRound.isOvertime
                  ? `Prorrogação · Rodada ${activeRound.roundNumber}`
                  : `Rodada ${String(activeRound.roundNumber).padStart(2, '0')} de 10`}{' '}
                · {activeRound.difficultyLabel}
              </p>
              <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#18181B] dark:text-[#EFECE6]">
                {activeRound.isOvertime
                  ? 'Consolidação exclusiva de pontos fracos'
                  : session.syllabus.find((s) => s.roundNumber === activeRound.roundNumber)
                      ?.title || session.title}
              </h1>
            </div>

            <span className="text-xs font-mono tabular-nums text-[#44403C] dark:text-[#C2BCB2]">
              {formatSummary}
            </span>
          </div>

          {latestSynthesis && <StrategicSynthesisCard synthesis={latestSynthesis} />}

          {errorMessage && (
            <div
              role="alert"
              className="p-4 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-sm text-[#B91C1C] dark:text-red-300"
            >
              {errorMessage}
            </div>
          )}

          <div className="space-y-4">
            {activeRound.questions.map((question, idx) => {
              const evaluation = activeRound.evaluations.find(
                (e) => e.questionId === question.id
              );
              const isFocused =
                focusedQuestionId === question.id ||
                (!focusedQuestionId && idx === 0);
              return (
                <QuestionCard
                  key={question.id}
                  index={idx}
                  question={question}
                  evaluation={evaluation}
                  isEvaluated={isEvaluated}
                  isFocused={isFocused}
                  disabled={isSubmitting || isAdvancing}
                  sessionDiscipline={sessionDiscipline}
                  isGeneratingComparative={generatingComparativeQuestionId === question.id}
                  onFocusQuestion={() => setFocusedQuestionId(question.id)}
                  onChangeAnswer={(qId, val) =>
                    onChangeAnswer(activeRound.roundNumber, qId, val)
                  }
                  onChangeRationale={(qId, val) =>
                    onChangeRationale(activeRound.roundNumber, qId, val)
                  }
                  onSelectOption={(qId, opt) =>
                    onSelectOption(activeRound.roundNumber, qId, opt)
                  }
                  onSelectConfidence={(qId, conf) =>
                    onSelectConfidence(activeRound.roundNumber, qId, conf)
                  }
                  onSelectErrorCause={(qId, cause) =>
                    onSelectErrorCause(activeRound.roundNumber, qId, cause)
                  }
                  onRequestComparativeTable={onRequestComparativeTable}
                  onShortcutSubmit={() => {
                    if (!isEvaluated && allAnswered && !isSubmitting) {
                      onSubmitRound();
                    }
                  }}
                />
              );
            })}
          </div>

          {isEvaluated && activeRound.roundSummary && (
            <div className="p-5 rounded-xl bg-[#F5F2EC] dark:bg-[#1C1B19] border border-[#E5E0D8] dark:border-[#36332E] space-y-2">
              <p className="text-xs font-semibold text-[#18181B] dark:text-[#EFECE6]">
                Resumo da avaliação — Rodada {activeRound.roundNumber}
              </p>
              <p className="reading-measure text-[#44403C] dark:text-[#D0CAC0]">
                {activeRound.roundSummary}
              </p>
              {luckyGuessesInRound > 0 && (
                <p className="text-xs font-medium text-[#92400E] dark:text-[#FBBF24]">
                  Filtro de chutes: {luckyGuessesInRound} acerto(s) marcado(s) como chute foram encaminhados para reforço com novo cenário na próxima rodada.
                </p>
              )}
              {isRound10 && (
                <p className="text-xs font-medium text-[#18181B] dark:text-[#EFECE6] pt-1">
                  {roundErrorsCount >= 2
                    ? `Foram identificados ${roundErrorsCount} ponto(s) frágil(is) na Rodada 10 (erros ou chutes). Conforme a regra do treino, iniciaremos uma prorrogação curta exclusiva para consolidá-los.`
                    : roundErrorsCount === 1
                      ? 'Apenas 1 desvio na Rodada 10. Você atingiu o critério de conclusão e já pode gerar sua Árvore Hierárquica Final.'
                      : 'Desempenho integral com certeza na Rodada 10. Você já pode concluir o treino e gerar sua Árvore Hierárquica Final.'}
                </p>
              )}
            </div>
          )}

          <div className="pt-2 flex flex-wrap items-center justify-between gap-4">
            {!isEvaluated ? (
              <>
                <p className="text-xs text-[#44403C] dark:text-[#C2BCB2]">
                  Atalhos:{' '}
                  <kbd className="px-1.5 py-0.5 rounded border border-[#D6D0C6] dark:border-[#45413B] bg-white dark:bg-[#22201D] font-mono text-[11px]">
                    1–5
                  </kbd>{' '}
                  alternativa ·{' '}
                  <kbd className="px-1.5 py-0.5 rounded border border-[#D6D0C6] dark:border-[#45413B] bg-white dark:bg-[#22201D] font-mono text-[11px]">
                    C/D/X
                  </kbd>{' '}
                  confiança ·{' '}
                  <kbd className="px-1.5 py-0.5 rounded border border-[#D6D0C6] dark:border-[#45413B] bg-white dark:bg-[#22201D] font-mono text-[11px]">
                    Enter
                  </kbd>{' '}
                  enviar
                </p>
                <button
                  type="button"
                  disabled={!allAnswered || isSubmitting}
                  onClick={onSubmitRound}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#B45309] dark:bg-[#F59E0B] text-[#FAF8F5] dark:text-[#141312] text-sm font-semibold hover:bg-[#92400E] dark:hover:bg-[#FBBF24] transition-colors cursor-pointer disabled:opacity-40"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      <span>Avaliando respostas...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" aria-hidden="true" />
                      <span>Enviar Respostas da Rodada</span>
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                <span className="text-xs font-mono tabular-nums text-[#44403C] dark:text-[#C2BCB2]">
                  {activeRound.questions.length - roundErrorsCount} de{' '}
                  {activeRound.questions.length} corretas nesta rodada
                </span>
                <button
                  type="button"
                  disabled={isAdvancing || isFinalizing}
                  onClick={onAdvanceRound}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#B45309] dark:bg-[#F59E0B] text-[#FAF8F5] dark:text-[#141312] text-sm font-semibold hover:bg-[#92400E] dark:hover:bg-[#FBBF24] transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isAdvancing || isFinalizing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      <span>
                        {isRound10 && roundErrorsCount < 2
                          ? 'Gerando Árvore Hierárquica...'
                          : 'Preparando próxima etapa...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <span>{nextActionLabel}</span>
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                      <kbd
                        aria-hidden="true"
                        className="hidden sm:inline font-mono text-[10px] opacity-80 ml-1"
                      >
                        Enter
                      </kbd>
                    </>
                  )}
                </button>
              </>
            )}
          </div>

          {pastRounds.length > 0 && (
            <div className="pt-8 border-t border-[#E5E0D8] dark:border-[#36332E]">
              <button
                type="button"
                aria-expanded={showPastRounds}
                onClick={() => setShowPastRounds((prev) => !prev)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#44403C] dark:text-[#C2BCB2] hover:text-[#18181B] dark:hover:text-[#EFECE6] cursor-pointer"
              >
                {showPastRounds ? (
                  <ChevronUp className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <ChevronDown className="w-4 h-4" aria-hidden="true" />
                )}
                <span>
                  {showPastRounds
                    ? 'Ocultar rodadas anteriores'
                    : `Consultar rodadas anteriores (${pastRounds.length})`}
                </span>
              </button>

              {showPastRounds && (
                <div className="mt-4 space-y-6">
                  {[...pastRounds].reverse().map((round) => (
                    <div
                      key={round.roundNumber}
                      className="p-5 rounded-xl bg-[#F5F2EC] dark:bg-[#1C1B19] border border-[#E5E0D8] dark:border-[#36332E] space-y-4"
                    >
                      <div className="flex items-center justify-between text-xs text-[#44403C] dark:text-[#C2BCB2]">
                        <span className="font-semibold text-[#18181B] dark:text-[#EFECE6]">
                          Rodada {round.roundNumber} · {round.difficultyLabel}
                        </span>
                        <span className="font-mono tabular-nums">
                          {
                            round.evaluations.filter((e) => e.verdict === 'correct')
                              .length
                          }
                          /{round.questions.length} acertos
                        </span>
                      </div>
                      <div className="space-y-3">
                        {round.questions.map((q, qIdx) => {
                          const ev = round.evaluations.find(
                            (e) => e.questionId === q.id
                          );
                          return (
                            <QuestionCard
                              key={q.id}
                              index={qIdx}
                              question={q}
                              evaluation={ev}
                              isEvaluated={true}
                              disabled={true}
                              sessionDiscipline={sessionDiscipline}
                              isGeneratingComparative={generatingComparativeQuestionId === q.id}
                              onChangeAnswer={() => {}}
                              onSelectOption={() => {}}
                              onSelectConfidence={() => {}}
                              onSelectErrorCause={(qId, cause) =>
                                onSelectErrorCause(round.roundNumber, qId, cause)
                              }
                              onRequestComparativeTable={onRequestComparativeTable}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Desktop Sticky Session Panel */}
        <div className="hidden lg:block lg:col-span-4">
          <LateralProgressPanel
            session={session}
            onFinishEarly={onFinishEarly}
            isFinalizing={isFinalizing}
          />
        </div>
      </div>
    </section>
  );
}
