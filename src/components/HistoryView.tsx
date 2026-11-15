import { ArrowRight, Trash2 } from 'lucide-react';
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
      <section className="max-w-[820px] mx-auto px-4 sm:px-8 py-14">
        <div className="bg-white dark:bg-[#1A1917] border border-[#E5E2DC] dark:border-[#2E2C28] rounded-xl p-8 sm:p-12 text-center space-y-4">
          <h1 className="font-display text-2xl font-semibold text-[#18181B] dark:text-[#F4F2ED]">
            Histórico de Treinos
          </h1>
          <p className="text-sm sm:text-base text-[#57534E] dark:text-[#A8A29E] max-w-md mx-auto leading-relaxed">
            A conta <span className="font-mono text-[#18181B] dark:text-[#F4F2ED]">@{usernameKey}</span> ainda não possui sessões na nuvem. Tudo que você treinar ficará sincronizado automaticamente aqui.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={onStartNewTraining}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#B45309] dark:bg-[#D97706] text-white text-sm font-semibold hover:bg-[#92400E] transition-colors cursor-pointer"
            >
              <span>Começar Novo Treino</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-[1040px] mx-auto px-4 sm:px-8 py-8 sm:py-10 space-y-6">
      <div className="pb-5 border-b border-[#E5E2DC] dark:border-[#2E2C28]">
        <p className="text-xs font-medium text-[#57534E] dark:text-[#A8A29E]">
          Sincronizado na nuvem para @{usernameKey} · {sessions.length} sessões
        </p>
        <h1 className="mt-1 font-display text-2xl sm:text-3xl font-semibold text-[#18181B] dark:text-[#F4F2ED]">
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
              className={`bg-white dark:bg-[#1A1917] border rounded-xl p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4 ${
                isCurrent
                  ? 'border-[#B45309] dark:border-[#F59E0B]'
                  : 'border-[#E5E2DC] dark:border-[#2E2C28]'
              }`}
            >
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#57534E] dark:text-[#A8A29E]">
                  <span
                    className={`font-semibold ${
                      session.status === 'completed'
                        ? 'text-[#047857] dark:text-[#34D399]'
                        : 'text-[#B45309] dark:text-[#F59E0B]'
                    }`}
                  >
                    {STATUS_LABELS[session.status]}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{formatShortDate(session.updatedAt)}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {evaluatedRounds.length} rodadas avaliadas
                  </span>
                  {unresolvedWeak > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums text-[#B45309] dark:text-[#F59E0B]">
                        {unresolvedWeak} pontos fracos ativos
                      </span>
                    </>
                  )}
                </div>

                <h2 className="font-display text-lg font-semibold text-[#18181B] dark:text-[#F4F2ED] truncate">
                  {session.title}
                </h2>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onResumeSession(session.id)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#18181B] dark:bg-[#F4F2ED] text-[#FAF9F6] dark:text-[#111110] text-xs font-semibold hover:bg-[#27272A] dark:hover:bg-[#E5E2DC] transition-colors cursor-pointer"
                >
                  <span>
                    {session.status === 'completed' ? 'Ver Árvore Final' : 'Retomar Treino'}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteSession(session.id)}
                  aria-label={`Excluir sessão ${session.title}`}
                  className="p-2 rounded-lg border border-[#E5E2DC] dark:border-[#2E2C28] text-[#57534E] dark:text-[#A8A29E] hover:text-[#B91C1C] dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-700 transition-colors cursor-pointer"
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
