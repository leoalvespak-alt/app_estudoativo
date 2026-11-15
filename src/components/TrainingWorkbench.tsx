import { useState } from 'react';
import { ArrowRight, ChevronDown, ChevronUp, Loader2, Send } from 'lucide-react';
import type {
  ConfidenceLevel,
  OptionLetter,
  StrategicSynthesis,
  TrainingSession,
} from '../types/trainer';
import { QuestionCard } from './QuestionCard';
import { LateralProgressPanel } from './LateralProgressPanel';

interface TrainingWorkbenchProps {
  session: TrainingSession;
  onChangeAnswer: (roundNumber: number, questionId: string, value: string) => void;
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
  onSubmitRound: () => void;
  onAdvanceRound: () => void;
  onFinishEarly: () => void;
  isSubmitting: boolean;
  isAdvancing: boolean;
  isFinalizing: boolean;
  errorMessage: string | null;
}

function StrategicSynthesisCard({ synthesis }: { synthesis: StrategicSynthesis }) {
  return (
    <section
      aria-label={synthesis.title}
      className="bg-amber-50/50 dark:bg-amber-950/25 border border-[#B45309]/40 dark:border-[#F59E0B]/40 rounded-xl p-6 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#B45309] dark:text-[#F59E0B] font-semibold">
        <span>Síntese Estratégica · Checkpoint após Rodada {synthesis.afterRound}</span>
      </div>

      <h2 className="font-display text-xl font-semibold text-[#18181B] dark:text-[#F4F2ED]">
        {synthesis.title}
      </h2>

      <p className="text-sm sm:text-[15px] text-[#18181B] dark:text-[#F4F2ED] leading-relaxed">
        {synthesis.focusSummary}
      </p>

      {synthesis.keyDefinitions.length > 0 && (
        <div className="pt-3 border-t border-[#B45309]/20 dark:border-[#F59E0B]/20 space-y-2.5">
          <p className="text-xs font-semibold text-[#18181B] dark:text-[#F4F2ED]">
            Definições objetivas para consolidar a base
          </p>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {synthesis.keyDefinitions.map((item, idx) => (
              <div
                key={`${item.term}-${idx}`}
                className="p-3.5 rounded-lg bg-white dark:bg-[#1A1917] border border-[#E5E2DC] dark:border-[#2E2C28]"
              >
                <dt className="text-xs font-semibold text-[#18181B] dark:text-[#F4F2ED]">
                  {item.term}
                </dt>
                <dd className="mt-1 text-xs text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
                  {item.definition}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {synthesis.adjacentInsights.length > 0 && (
        <div className="pt-2 space-y-1.5">
          <p className="text-xs font-semibold text-[#18181B] dark:text-[#F4F2ED]">
            Complementos estratégicos adjacentes
          </p>
          <ul className="space-y-1 text-xs text-[#57534E] dark:text-[#A8A29E] list-disc pl-4">
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

export function TrainingWorkbench({
  session,
  onChangeAnswer,
  onSelectOption,
  onSelectConfidence,
  onSubmitRound,
  onAdvanceRound,
  onFinishEarly,
  isSubmitting,
  isAdvancing,
  isFinalizing,
  errorMessage,
}: TrainingWorkbenchProps) {
  const [showPastRounds, setShowPastRounds] = useState(false);

  const activeRound = session.rounds[session.rounds.length - 1];
  const pastRounds = session.rounds.slice(0, -1);

  if (!activeRound) {
    return null;
  }

  const isEvaluated = activeRound.evaluations.length > 0;
  const allAnswered = activeRound.questions.every((q) => {
    const hasAnswer =
      q.format === 'multiple_choice' && q.options.length > 0
        ? Boolean(q.userSelectedOption)
        : q.userAnswer.trim().length > 0;
    return hasAnswer && Boolean(q.confidence);
  });
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

  const mcCount = activeRound.questions.filter(
    (q) => q.format === 'multiple_choice' && q.options.length > 0
  ).length;
  const openCount = activeRound.questions.length - mcCount;

  return (
    <section className="max-w-[1280px] mx-auto px-4 sm:px-8 py-8 sm:py-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 space-y-6">
          <div className="pb-4 border-b border-[#E5E2DC] dark:border-[#2E2C28] flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-[#57534E] dark:text-[#A8A29E]">
                {activeRound.isOvertime
                  ? `Prorrogação · Rodada ${activeRound.roundNumber}`
                  : `Rodada ${String(activeRound.roundNumber).padStart(2, '0')} de 10`}{' '}
                · {activeRound.difficultyLabel}
              </p>
              <h1 className="mt-1 font-display text-2xl sm:text-3xl font-semibold text-[#18181B] dark:text-[#F4F2ED]">
                {activeRound.isOvertime
                  ? 'Consolidação exclusiva de pontos fracos'
                  : session.syllabus.find((s) => s.roundNumber === activeRound.roundNumber)
                      ?.title || session.title}
              </h1>
            </div>

            <span className="text-xs font-mono tabular-nums text-[#57534E] dark:text-[#A8A29E]">
              {mcCount > 0 && openCount > 0
                ? `${mcCount} múltipla escolha · ${openCount} abertas`
                : mcCount > 0
                  ? `${mcCount} múltipla escolha`
                  : `${openCount} perguntas abertas`}
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
              return (
                <QuestionCard
                  key={question.id}
                  index={idx}
                  question={question}
                  evaluation={evaluation}
                  isEvaluated={isEvaluated}
                  disabled={isSubmitting || isAdvancing}
                  onChangeAnswer={(qId, val) =>
                    onChangeAnswer(activeRound.roundNumber, qId, val)
                  }
                  onSelectOption={(qId, opt) =>
                    onSelectOption(activeRound.roundNumber, qId, opt)
                  }
                  onSelectConfidence={(qId, conf) =>
                    onSelectConfidence(activeRound.roundNumber, qId, conf)
                  }
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
            <div className="p-5 rounded-xl bg-[#F3F1EC] dark:bg-[#21201D] border border-[#E5E2DC] dark:border-[#2E2C28] space-y-2">
              <p className="text-xs font-semibold text-[#18181B] dark:text-[#F4F2ED]">
                Resumo da avaliação — Rodada {activeRound.roundNumber}
              </p>
              <p className="text-sm text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
                {activeRound.roundSummary}
              </p>
              {luckyGuessesInRound > 0 && (
                <p className="text-xs font-medium text-[#B45309] dark:text-[#F59E0B]">
                  Filtro de chutes: {luckyGuessesInRound} acerto(s) marcado(s) como chute foram encaminhados para reforço.
                </p>
              )}
              {isRound10 && (
                <p className="text-xs font-medium text-[#B45309] dark:text-[#F59E0B] pt-1">
                  {roundErrorsCount >= 2
                    ? `Foram identificados ${roundErrorsCount} ponto(s) frágil(is) na Rodada 10 (erros ou chutes). Conforme a regra do treino, iniciaremos uma prorrogação curta exclusiva para consolidá-los.`
                    : roundErrorsCount === 1
                      ? 'Apenas 1 desvio na Rodada 10. Você atingiu o critério de conclusão e já pode gerar sua Síntese Ultracompacta Final.'
                      : 'Desempenho integral com certeza na Rodada 10. Você já pode concluir o treino e gerar sua Síntese Ultracompacta Final.'}
                </p>
              )}
            </div>
          )}

          <div className="pt-2 flex flex-wrap items-center justify-between gap-4">
            {!isEvaluated ? (
              <>
                <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">
                  Responda e marque o nível de confiança em todas as perguntas antes de enviar. Pressione{' '}
                  <kbd className="px-1.5 py-0.5 rounded border border-[#D6D3CD] dark:border-[#3A3732] bg-white dark:bg-[#1A1917] font-mono text-[11px]">
                    Ctrl/Cmd + Enter
                  </kbd>{' '}
                  para enviar.
                </p>
                <button
                  type="button"
                  disabled={!allAnswered || isSubmitting}
                  onClick={onSubmitRound}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#B45309] dark:bg-[#D97706] text-white text-sm font-semibold hover:bg-[#92400E] transition-colors cursor-pointer disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B45309]"
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
                <span className="text-xs font-mono tabular-nums text-[#57534E] dark:text-[#A8A29E]">
                  {activeRound.questions.length - roundErrorsCount} de{' '}
                  {activeRound.questions.length} corretas nesta rodada
                </span>
                <button
                  type="button"
                  disabled={isAdvancing || isFinalizing}
                  onClick={onAdvanceRound}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#18181B] dark:bg-[#F4F2ED] text-[#FAF9F6] dark:text-[#111110] text-sm font-semibold hover:bg-[#27272A] dark:hover:bg-[#E5E2DC] transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B45309]"
                >
                  {isAdvancing || isFinalizing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      <span>
                        {isRound10 && roundErrorsCount < 2
                          ? 'Gerando Árvore Ultracompacta...'
                          : 'Preparando próxima etapa...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <span>{nextActionLabel}</span>
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </>
                  )}
                </button>
              </>
            )}
          </div>

          {pastRounds.length > 0 && (
            <div className="pt-8 border-t border-[#E5E2DC] dark:border-[#2E2C28]">
              <button
                type="button"
                onClick={() => setShowPastRounds((prev) => !prev)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#57534E] dark:text-[#A8A29E] hover:text-[#18181B] dark:hover:text-[#F4F2ED] cursor-pointer"
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
                      className="p-5 rounded-xl bg-[#F3F1EC] dark:bg-[#21201D] border border-[#E5E2DC] dark:border-[#2E2C28] space-y-4"
                    >
                      <div className="flex items-center justify-between text-xs text-[#57534E] dark:text-[#A8A29E]">
                        <span className="font-semibold text-[#18181B] dark:text-[#F4F2ED]">
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
                              onChangeAnswer={() => {}}
                              onSelectOption={() => {}}
                              onSelectConfidence={() => {}}
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

        <div className="lg:col-span-4">
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
