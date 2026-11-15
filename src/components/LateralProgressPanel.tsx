import { useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Dices,
  ExternalLink,
  Flag,
  HelpCircle,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import type { TrainingSession } from '../types/trainer';

interface LateralProgressPanelProps {
  session: TrainingSession;
  onFinishEarly: () => void;
  isFinalizing: boolean;
}

export function LateralProgressPanel({
  session,
  onFinishEarly,
  isFinalizing,
}: LateralProgressPanelProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const evaluatedRounds = session.rounds.filter((r) => r.evaluations.length > 0);
  let totalQuestionsAnswered = 0;
  let totalCorrect = 0;
  let certainCorrect = 0;
  let unsureHits = 0;
  let guessHits = 0;

  for (const r of evaluatedRounds) {
    for (const q of r.questions) {
      const ev = r.evaluations.find((e) => e.questionId === q.id);
      if (!ev) continue;
      totalQuestionsAnswered += 1;
      const conf = ev.confidenceAtSubmit || q.confidence || '';
      if (ev.verdict === 'correct') {
        totalCorrect += 1;
        if (conf === 'guess' || ev.isLuckyGuess) {
          guessHits += 1;
        } else if (conf === 'unsure') {
          unsureHits += 1;
        } else {
          certainCorrect += 1;
        }
      }
    }
  }

  const accuracyPct =
    totalQuestionsAnswered > 0 ? Math.round((totalCorrect / totalQuestionsAnswered) * 100) : 0;

  const activeWeakPoints = session.activeWeakPoints.filter((wp) => !wp.resolved);
  const resolvedWeakPoints = session.activeWeakPoints.filter((wp) => wp.resolved);

  const roundLabel =
    session.status === 'overtime'
      ? `P${session.currentRound - 10}`
      : `${String(Math.min(session.currentRound, 10)).padStart(2, '0')}/10`;

  return (
    <aside className="bg-[#F5F2EC] dark:bg-[#1C1B19] border border-[#E5E0D8] dark:border-[#36332E] rounded-xl p-4 sm:p-6 lg:sticky lg:top-16">
      {/* Mobile / Tablet Collapsible Summary Bar */}
      <button
        type="button"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((prev) => !prev)}
        className="w-full flex lg:hidden items-center justify-between gap-3 text-left cursor-pointer"
      >
        <div className="min-w-0">
          <p className="text-xs font-medium text-[#44403C] dark:text-[#C2BCB2]">
            Painel da Sessão
          </p>
          <p className="text-sm font-semibold text-[#18181B] dark:text-[#EFECE6] tabular-nums truncate">
            Rodada {roundLabel} · {totalQuestionsAnswered > 0 ? `${accuracyPct}% acertos` : 'Sem correção'} · {activeWeakPoints.length} em reteste
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#B45309] dark:text-[#F59E0B] shrink-0">
          <span>{mobileOpen ? 'Ocultar' : 'Detalhes'}</span>
          {mobileOpen ? (
            <ChevronUp className="w-4 h-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-4 h-4" aria-hidden="true" />
          )}
        </span>
      </button>

      <div className={`${mobileOpen ? 'block mt-5 pt-4 border-t border-[#E5E0D8] dark:border-[#36332E]' : 'hidden'} lg:block lg:mt-0 lg:pt-0 lg:border-t-0 space-y-6`}>
        <div className="pb-5 border-b border-[#E5E0D8] dark:border-[#36332E]">
          <p className="hidden lg:block text-xs font-medium text-[#44403C] dark:text-[#C2BCB2]">
            Painel da Sessão
          </p>
          <h2 className="mt-0 lg:mt-1 font-display text-lg font-semibold text-[#18181B] dark:text-[#EFECE6]">
            {session.title}
          </h2>
          {session.surgicalFocus?.label && (
            <p className="mt-1 text-xs font-medium text-[#B45309] dark:text-[#F59E0B]">
              {session.surgicalFocus.label}
            </p>
          )}

          <div className="mt-4 grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-lg bg-[#FAF8F5] dark:bg-[#22201D] border border-[#E5E0D8] dark:border-[#36332E]">
              <p className="text-[11px] text-[#44403C] dark:text-[#C2BCB2]">Rodada</p>
              <p className="mt-0.5 font-mono text-base font-semibold tabular-nums text-[#18181B] dark:text-[#EFECE6]">
                {roundLabel}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[#FAF8F5] dark:bg-[#22201D] border border-[#E5E0D8] dark:border-[#36332E]">
              <p className="text-[11px] text-[#44403C] dark:text-[#C2BCB2]">Acertos</p>
              <p className="mt-0.5 font-mono text-base font-semibold tabular-nums text-[#18181B] dark:text-[#EFECE6]">
                {totalQuestionsAnswered > 0 ? `${accuracyPct}%` : '—'}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[#FAF8F5] dark:bg-[#22201D] border border-[#E5E0D8] dark:border-[#36332E]">
              <p className="text-[11px] text-[#44403C] dark:text-[#C2BCB2]">Em reteste</p>
              <p className="mt-0.5 font-mono text-base font-semibold tabular-nums text-[#18181B] dark:text-[#EFECE6]">
                {activeWeakPoints.length}
              </p>
            </div>
          </div>

          {totalQuestionsAnswered > 0 && (
            <div className="mt-3 pt-3 border-t border-[#E5E0D8] dark:border-[#36332E] grid grid-cols-3 gap-2 text-[11px] tabular-nums">
              <div className="flex items-center gap-1 text-[#047857] dark:text-[#34D399]">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Certeza: {certainCorrect}</span>
              </div>
              <div className="flex items-center gap-1 text-[#44403C] dark:text-[#D0CAC0]">
                <HelpCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Dúvida: {unsureHits}</span>
              </div>
              <div className="flex items-center gap-1 text-[#92400E] dark:text-[#FBBF24]">
                <Dices className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Chute: {guessHits}</span>
              </div>
            </div>
          )}
        </div>

        <div className="pb-5 border-b border-[#E5E0D8] dark:border-[#36332E] space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[#18181B] dark:text-[#EFECE6]">
              Pontos Fracos Ativos
            </h3>
            <span className="text-xs font-mono tabular-nums text-[#44403C] dark:text-[#C2BCB2]">
              {activeWeakPoints.length} ativos · {resolvedWeakPoints.length} sanados
            </span>
          </div>

          {activeWeakPoints.length === 0 ? (
            <p className="text-xs text-[#44403C] dark:text-[#C2BCB2] leading-relaxed">
              Nenhum ponto fraco pendente no momento. Conceitos errados ou acertados no chute aparecerão aqui e voltarão na próxima rodada.
            </p>
          ) : (
            <ul className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {activeWeakPoints.map((wp) => (
                <li
                  key={wp.id}
                  className="p-3 rounded-lg bg-white dark:bg-[#22201D] border border-[#E5E0D8] dark:border-[#36332E] space-y-1"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-[#18181B] dark:text-[#EFECE6]">
                      {wp.concept}
                    </span>
                    <span className="font-mono tabular-nums text-[#44403C] dark:text-[#C2BCB2] shrink-0">
                      R{wp.missedInRound}
                    </span>
                  </div>
                  <p className="text-xs text-[#44403C] dark:text-[#C2BCB2] leading-relaxed">
                    {wp.definition}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[#18181B] dark:text-[#EFECE6]">
              Mapa do Escopo (10 Rodadas)
            </h3>
          </div>

          <ol className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
            {session.syllabus.map((plan) => {
              const isCurrent =
                session.currentRound === plan.roundNumber && session.status !== 'overtime';
              const isDone = plan.covered || session.currentRound > plan.roundNumber;
              return (
                <li
                  key={plan.roundNumber}
                  className={`px-3 py-2 rounded-lg text-xs border transition-colors ${
                    isCurrent
                      ? 'bg-white dark:bg-[#22201D] border-[#44403C] dark:border-[#C2BCB2] text-[#18181B] dark:text-[#EFECE6]'
                      : isDone
                        ? 'bg-[#FAF8F5] dark:bg-[#201E1B] border-[#E5E0D8] dark:border-[#36332E] text-[#44403C] dark:text-[#C2BCB2]'
                        : 'bg-transparent border-transparent text-[#44403C] dark:text-[#C2BCB2]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-medium tabular-nums shrink-0">
                      R{String(plan.roundNumber).padStart(2, '0')}
                    </span>
                    <span className="flex-1 truncate font-medium text-[#18181B] dark:text-[#EFECE6]">
                      {plan.title}
                    </span>
                    {isDone && (
                      <Check
                        className="w-3.5 h-3.5 text-[#047857] dark:text-[#34D399] shrink-0"
                        aria-label="Concluída"
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="pt-4 border-t border-[#E5E0D8] dark:border-[#36332E] space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[#18181B] dark:text-[#EFECE6]">
              Fontes da Sessão
            </h3>
            {session.kbSources && session.kbSources.length > 0 && (
              <span className="text-xs font-mono tabular-nums text-[#44403C] dark:text-[#C2BCB2]">
                {session.kbSources.length}
              </span>
            )}
          </div>

          {!session.kbSources || session.kbSources.length === 0 ? (
            <p className="text-xs text-[#44403C] dark:text-[#C2BCB2] leading-relaxed">
              Materiais da base de estudos consultados conforme o avanço das rodadas.
            </p>
          ) : (
            <ul className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {session.kbSources.map((src, idx) => (
                <li
                  key={`${src.origin}:${src.url || src.relativePath}:${idx}`}
                  className="p-2.5 rounded-lg bg-[#FAF8F5] dark:bg-[#22201D] border border-[#E5E0D8] dark:border-[#36332E]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[#18181B] dark:text-[#EFECE6] truncate">
                        {src.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#44403C] dark:text-[#C2BCB2] truncate">
                        {src.origin === 'git' ? 'Base de Estudos' : 'Complemento Web'} · {src.discipline} · {src.sourceLabel}
                      </p>
                    </div>
                    {src.url && (
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Abrir fonte ${src.title}`}
                        className="p-1 text-[#44403C] dark:text-[#C2BCB2] hover:text-[#B45309] dark:hover:text-[#F59E0B] shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {evaluatedRounds.length > 0 && (
          <div className="pt-4 border-t border-[#E5E0D8] dark:border-[#36332E]">
            <button
              type="button"
              disabled={isFinalizing}
              onClick={onFinishEarly}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[#D6D0C6] dark:border-[#45413B] bg-white dark:bg-[#22201D] text-xs font-semibold text-[#18181B] dark:text-[#EFECE6] hover:border-[#B45309] dark:hover:border-[#F59E0B] transition-colors cursor-pointer disabled:opacity-50"
            >
              {isFinalizing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  <span>Gerando Síntese Final...</span>
                </>
              ) : (
                <>
                  <Flag className="w-3.5 h-3.5 text-[#B45309] dark:text-[#F59E0B]" aria-hidden="true" />
                  <span>Encerrar e Gerar Árvore Final</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
