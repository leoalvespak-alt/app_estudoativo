import { ArrowRight, Loader2 } from 'lucide-react';
import type { TrainingSession } from '../types/trainer';

interface PrepClassViewProps {
  session: TrainingSession;
  onStartRoundOne: () => void;
  isLoading: boolean;
  errorMessage: string | null;
}

export function PrepClassView({
  session,
  onStartRoundOne,
  isLoading,
  errorMessage,
}: PrepClassViewProps) {
  const prep = session.prepClass;
  if (!prep) return null;

  return (
    <section className="max-w-[1000px] mx-auto px-4 sm:px-8 py-8 sm:py-10">
      <div className="bg-white dark:bg-[#22201D] border border-[#E5E0D8] dark:border-[#36332E] rounded-xl p-6 sm:p-10">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-[#E5E0D8] dark:border-[#36332E]">
          <div>
            <p className="text-xs font-medium text-[#44403C] dark:text-[#C2BCB2] tabular-nums">
              Aula Concisa Preparatória · {session.syllabus.length} rodadas planejadas
            </p>
            <h1 className="mt-1 font-display text-2xl sm:text-3xl font-semibold text-[#18181B] dark:text-[#EFECE6]">
              {session.title}
            </h1>
          </div>
          <button
            type="button"
            disabled={isLoading}
            onClick={onStartRoundOne}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#B45309] dark:bg-[#F59E0B] text-[#FAF8F5] dark:text-[#141312] text-sm font-semibold hover:bg-[#92400E] dark:hover:bg-[#FBBF24] transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span>Gerando Rodada 1...</span>
              </>
            ) : (
              <>
                <span>Iniciar Rodada 1</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </>
            )}
          </button>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mt-6 p-4 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-sm text-[#B91C1C] dark:text-red-300"
          >
            {errorMessage}
          </div>
        )}

        <div className="mt-6 space-y-8">
          <div>
            <h2 className="font-display text-lg font-semibold text-[#18181B] dark:text-[#EFECE6]">
              Visão Geral de Alta Densidade
            </h2>
            <p className="mt-2 reading-measure text-[#18181B] dark:text-[#EFECE6]">
              {prep.summary}
            </p>
          </div>

          <div>
            <h2 className="font-display text-lg font-semibold text-[#18181B] dark:text-[#EFECE6] mb-4">
              Conceitos e Regras Essenciais
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {prep.concepts.map((concept, index) => (
                <article
                  key={`${concept.term}-${index}`}
                  className="p-5 rounded-lg bg-[#FAF8F5] dark:bg-[#1C1B19] border border-[#E5E0D8] dark:border-[#36332E] space-y-2"
                >
                  <p className="text-xs font-mono tabular-nums text-[#44403C] dark:text-[#C2BCB2]">
                    Conceito {String(index + 1).padStart(2, '0')}
                  </p>
                  <h3 className="text-base font-semibold text-[#18181B] dark:text-[#EFECE6]">
                    {concept.term}
                  </h3>
                  <p className="text-[15px] text-[#18181B] dark:text-[#E7E2D8] leading-[1.6] max-w-[65ch]">
                    {concept.definition}
                  </p>
                  <p className="pt-2 border-t border-[#E5E0D8] dark:border-[#36332E] text-xs text-[#44403C] dark:text-[#C2BCB2] leading-relaxed">
                    <span className="font-semibold text-[#18181B] dark:text-[#EFECE6]">
                      Regra-chave:{' '}
                    </span>
                    {concept.keyRule}
                  </p>
                </article>
              ))}
            </div>
          </div>

          {prep.studyTips && (
            <div className="p-5 rounded-lg bg-[#F5F2EC] dark:bg-[#1C1B19] border border-[#E5E0D8] dark:border-[#36332E]">
              <p className="text-sm font-semibold text-[#18181B] dark:text-[#EFECE6]">
                Pontos de atenção para o treino
              </p>
              <p className="mt-1 reading-measure text-[#44403C] dark:text-[#D0CAC0]">
                {prep.studyTips}
              </p>
            </div>
          )}

          <div className="pt-4 border-t border-[#E5E0D8] dark:border-[#36332E] flex justify-end">
            <button
              type="button"
              disabled={isLoading}
              onClick={onStartRoundOne}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#B45309] dark:bg-[#F59E0B] text-[#FAF8F5] dark:text-[#141312] text-sm font-semibold hover:bg-[#92400E] dark:hover:bg-[#FBBF24] transition-colors cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Gerando Rodada 1...</span>
                </>
              ) : (
                <>
                  <span>Estou pronto — Iniciar Rodada 1</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
