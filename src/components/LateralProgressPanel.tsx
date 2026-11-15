import { Check, ExternalLink, Flag, Loader2 } from 'lucide-react';
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
  const evaluatedRounds = session.rounds.filter((r) => r.evaluations.length > 0);
  const totalQuestionsAnswered = evaluatedRounds.reduce(
    (acc, r) => acc + r.evaluations.length,
    0
  );
  const totalCorrect = evaluatedRounds.reduce(
    (acc, r) => acc + r.evaluations.filter((e) => e.verdict === 'correct').length,
    0
  );
  const accuracyPct =
    totalQuestionsAnswered > 0 ? Math.round((totalCorrect / totalQuestionsAnswered) * 100) : 0;

  const activeWeakPoints = session.activeWeakPoints.filter((wp) => !wp.resolved);
  const resolvedWeakPoints = session.activeWeakPoints.filter((wp) => wp.resolved);

  return (
    <aside className="bg-[#F3F1EC] dark:bg-[#21201D] border border-[#E5E2DC] dark:border-[#2E2C28] rounded-xl p-6 space-y-6 lg:sticky lg:top-24">
      <div className="pb-5 border-b border-[#E5E2DC] dark:border-[#2E2C28]">
        <p className="text-xs font-medium text-[#57534E] dark:text-[#A8A29E]">
          Painel da Sessão
        </p>
        <h2 className="mt-1 font-display text-lg font-semibold text-[#18181B] dark:text-[#F4F2ED]">
          {session.title}
        </h2>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-[#FAF9F6] dark:bg-[#161513] border border-[#E5E2DC] dark:border-[#2E2C28]">
            <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E]">Rodada</p>
            <p className="mt-0.5 font-mono text-base font-semibold tabular-nums text-[#18181B] dark:text-[#F4F2ED]">
              {session.status === 'overtime'
                ? `P${session.currentRound - 10}`
                : `${String(Math.min(session.currentRound, 10)).padStart(2, '0')}/10`}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-[#FAF9F6] dark:bg-[#161513] border border-[#E5E2DC] dark:border-[#2E2C28]">
            <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E]">Acertos</p>
            <p className="mt-0.5 font-mono text-base font-semibold tabular-nums text-[#18181B] dark:text-[#F4F2ED]">
              {totalQuestionsAnswered > 0 ? `${accuracyPct}%` : '—'}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-[#FAF9F6] dark:bg-[#161513] border border-[#E5E2DC] dark:border-[#2E2C28]">
            <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E]">Em reteste</p>
            <p className="mt-0.5 font-mono text-base font-semibold tabular-nums text-[#B45309] dark:text-[#F59E0B]">
              {activeWeakPoints.length}
            </p>
          </div>
        </div>
      </div>

      <div className="pb-5 border-b border-[#E5E2DC] dark:border-[#2E2C28] space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[#18181B] dark:text-[#F4F2ED]">
            Pontos Fracos Ativos
          </h3>
          <span className="text-xs font-mono tabular-nums text-[#57534E] dark:text-[#A8A29E]">
            {activeWeakPoints.length} ativos · {resolvedWeakPoints.length} sanados
          </span>
        </div>

        {activeWeakPoints.length === 0 ? (
          <p className="text-xs text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
            Nenhum ponto fraco pendente no momento. Conceitos errados aparecerão aqui e retornarão na rodada seguinte.
          </p>
        ) : (
          <ul className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
            {activeWeakPoints.map((wp) => (
              <li
                key={wp.id}
                className="p-3 rounded-lg bg-white dark:bg-[#161513] border border-[#E5E2DC] dark:border-[#2E2C28] space-y-1"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-[#18181B] dark:text-[#F4F2ED]">
                    {wp.concept}
                  </span>
                  <span className="font-mono tabular-nums text-[#B45309] dark:text-[#F59E0B] shrink-0">
                    R{wp.missedInRound}
                  </span>
                </div>
                <p className="text-xs text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
                  {wp.definition}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[#18181B] dark:text-[#F4F2ED]">
            Mapa do Escopo (10 Rodadas)
          </h3>
        </div>

        <ol className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
          {session.syllabus.map((plan) => {
            const isCurrent =
              session.currentRound === plan.roundNumber && session.status !== 'overtime';
            const isDone = plan.covered || session.currentRound > plan.roundNumber;
            return (
              <li
                key={plan.roundNumber}
                className={`px-3 py-2 rounded-lg text-xs border transition-colors ${
                  isCurrent
                    ? 'bg-white dark:bg-[#161513] border-[#B45309] dark:border-[#F59E0B] text-[#18181B] dark:text-[#F4F2ED]'
                    : isDone
                      ? 'bg-[#FAF9F6] dark:bg-[#191815] border-[#E5E2DC] dark:border-[#2E2C28] text-[#57534E] dark:text-[#A8A29E]'
                      : 'bg-transparent border-transparent text-[#57534E] dark:text-[#A8A29E]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-medium tabular-nums shrink-0">
                    R{String(plan.roundNumber).padStart(2, '0')}
                  </span>
                  <span className="flex-1 truncate font-medium text-[#18181B] dark:text-[#F4F2ED]">
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

      <div className="pt-4 border-t border-[#E5E2DC] dark:border-[#2E2C28] space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[#18181B] dark:text-[#F4F2ED]">
            Fontes da Sessão (Git / Web)
          </h3>
          {session.kbSources && session.kbSources.length > 0 && (
            <span className="text-xs font-mono tabular-nums text-[#57534E] dark:text-[#A8A29E]">
              {session.kbSources.length}
            </span>
          )}
        </div>

        {!session.kbSources || session.kbSources.length === 0 ? (
          <p className="text-xs text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
            Base Git (<span className="font-mono">rota-base-conhecimento-estudos</span>) verificada sob demanda em cada rodada.
          </p>
        ) : (
          <ul className="space-y-2 max-h-44 overflow-y-auto pr-1">
            {session.kbSources.map((src, idx) => (
              <li
                key={`${src.origin}:${src.url || src.relativePath}:${idx}`}
                className="p-2.5 rounded-lg bg-[#FAF9F6] dark:bg-[#161513] border border-[#E5E2DC] dark:border-[#2E2C28]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[#18181B] dark:text-[#F4F2ED] truncate">
                      {src.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#57534E] dark:text-[#A8A29E] truncate">
                      {src.origin === 'git' ? 'Base Git' : 'Complemento Web'} · {src.discipline} · {src.sourceLabel}
                    </p>
                  </div>
                  {src.url && (
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Abrir fonte ${src.title}`}
                      className="p-1 text-[#57534E] dark:text-[#A8A29E] hover:text-[#B45309] dark:hover:text-[#F59E0B] shrink-0"
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
        <div className="pt-4 border-t border-[#E5E2DC] dark:border-[#2E2C28]">
          <button
            type="button"
            disabled={isFinalizing}
            onClick={onFinishEarly}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[#D6D3CD] dark:border-[#3A3732] bg-white dark:bg-[#161513] text-xs font-semibold text-[#18181B] dark:text-[#F4F2ED] hover:border-[#18181B] dark:hover:border-[#F4F2ED] transition-colors cursor-pointer disabled:opacity-50"
          >
            {isFinalizing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                <span>Gerando Síntese Final...</span>
              </>
            ) : (
              <>
                <Flag className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Encerrar e Gerar Árvore Final</span>
              </>
            )}
          </button>
        </div>
      )}
    </aside>
  );
}
