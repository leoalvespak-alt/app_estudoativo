import { ArrowRight, Play, Trash2 } from 'lucide-react';
import type { SessionStatus, TrainingSession } from '../types/trainer';
import { formatShortDate } from '../lib/storage';

interface HistoryViewProps {
  usernameKey: string;
  sessions: TrainingSession[];
  activeSessionId: string | null;
  onResumeSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onStartNewTraining: () => void;
}

const STATUS_LABELS: Record<SessionStatus, string> = {
  choice_gate: 'Aguardando escolha inicial',
  prep_class: 'Aula preparatória',
  in_progress: 'Em andamento',
  overtime: 'Em prorrogação',
  completed: 'Concluído',
};

export function HistoryView({
  usernameKey,
  sessions,
  activeSessionId,
  onResumeSession,
  onDeleteSession,
  onStartNewTraining,
}: HistoryViewProps) {
  if (sessions.length === 0) {
    return (
      <section className="max-w-[860px] mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <div className="bg-white dark:bg-[#22201D] border border-[#E5E0D8] dark:border-[#36332E] rounded-xl p-6 sm:p-10 space-y-8">
          <div className="text-center space-y-3 max-w-xl mx-auto">
            <p className="text-xs font-medium text-[#44403C] dark:text-[#C2BCB2]">
              Histórico da conta · @{usernameKey}
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#18181B] dark:text-[#EFECE6]">
              Histórico de Treinos
            </h1>
            <p className="reading-measure mx-auto text-[#44403C] dark:text-[#D0CAC0]">
              A conta @{usernameKey} ainda não possui sessões registradas. Todas as suas rodadas em andamento e sessões concluídas ficarão salvas aqui para retomar quando quiser.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={onStartNewTraining}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#B45309] dark:bg-[#F59E0B] text-[#FAF8F5] dark:text-[#141312] text-sm font-semibold hover:bg-[#92400E] dark:hover:bg-[#FBBF24] transition-colors cursor-pointer"
              >
                <Play className="w-4 h-4" aria-hidden="true" />
                <span>Começar primeiro treino</span>
              </button>
            </div>
          </div>

          <div aria-hidden="true" className="space-y-3 opacity-55 select-none pointer-events-none">
            {['Em andamento · Rodada — de 10', 'Concluído · Árvore final disponível'].map(
              (label) => (
                <div
                  key={label}
                  className="p-4 rounded-xl border border-dashed border-[#D6D0C6] dark:border-[#3E3A34] bg-[#FAF8F5] dark:bg-[#1C1B19] flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="space-y-2 flex-1 min-w-[200px]">
                    <p className="text-xs text-[#44403C] dark:text-[#C2BCB2] tabular-nums">
                      {label}
                    </p>
                    <div className="h-3.5 w-2/3 rounded bg-[#E5E0D8] dark:bg-[#36332E]" />
                  </div>
                  <div className="h-7 w-28 rounded-lg bg-[#E5E0D8] dark:bg-[#36332E]" />
                </div>
              )
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-[1040px] mx-auto px-4 sm:px-8 py-8 sm:py-10 space-y-6">
      <div className="pb-5 border-b border-[#E5E0D8] dark:border-[#36332E]">
        <p className="text-xs font-medium text-[#44403C] dark:text-[#C2BCB2] tabular-nums">
          Salvos na conta @{usernameKey} · {sessions.length} sessão(ões)
        </p>
        <h1 className="mt-1 font-display text-2xl sm:text-3xl font-semibold text-[#18181B] dark:text-[#EFECE6]">
          Histórico de Treinos
        </h1>
      </div>

      <div className="space-y-3">
        {sessions.map((session) => {
          const evaluatedRounds = session.rounds.filter((r) => r.evaluations.length > 0);
          const unresolvedWeak = session.activeWeakPoints.filter((w) => !w.resolved).length;
          const isCurrent = session.id === activeSessionId;

          return (
            <article
              key={session.id}
              className={`border rounded-xl p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4 ${
                isCurrent
                  ? 'bg-[#F5F2EC] dark:bg-[#282522] border-[#D6D0C6] dark:border-[#45413B]'
                  : 'bg-white dark:bg-[#22201D] border-[#E5E0D8] dark:border-[#36332E]'
              }`}
            >
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#44403C] dark:text-[#C2BCB2]">
                  <span
                    className={`font-semibold ${
                      session.status === 'completed'
                        ? 'text-[#047857] dark:text-[#34D399]'
                        : 'text-[#18181B] dark:text-[#EFECE6]'
                    }`}
                  >
                    {STATUS_LABELS[session.status]}
                  </span>
                  {isCurrent && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-[#18181B] dark:text-[#EFECE6]">
                        Sessão aberta
                      </span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span>{formatShortDate(session.updatedAt)}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {evaluatedRounds.length} rodada(s) avaliada(s)
                  </span>
                  {unresolvedWeak > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums text-[#B91C1C] dark:text-[#F87171]">
                        {unresolvedWeak} ponto(s) fraco(s) ativo(s)
                      </span>
                    </>
                  )}
                </div>

                <h2 className="font-display text-lg font-semibold text-[#18181B] dark:text-[#EFECE6] truncate">
                  {session.title}
                </h2>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onResumeSession(session.id)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#B45309] dark:bg-[#F59E0B] text-[#FAF8F5] dark:text-[#141312] text-xs font-semibold hover:bg-[#92400E] dark:hover:bg-[#FBBF24] transition-colors cursor-pointer"
                >
                  <span>
                    {session.status === 'completed' ? 'Ver árvore final' : 'Retomar treino'}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteSession(session.id)}
                  aria-label={`Excluir sessão ${session.title}`}
                  className="p-2 rounded-lg border border-[#E5E0D8] dark:border-[#36332E] text-[#44403C] dark:text-[#C2BCB2] hover:text-[#B91C1C] dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-700 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
