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
    <section className="max-w-[1040px] mx-auto px-4 sm:px-8 py-10">
      <div className="bg-white dark:bg-[#1A1917] border border-[#E5E2DC] dark:border-[#2E2C28] rounded-xl p-6 sm:p-10">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-[#E5E2DC] dark:border-[#2E2C28]">
          <div>
            <p className="text-xs font-medium text-[#57534E] dark:text-[#A8A29E]">
              Aula Concisa Preparatória · {session.syllabus.length} rodadas planejadas
            </p>
            <h1 className="mt-1 font-display text-2xl sm:text-3xl font-semibold text-[#18181B] dark:text-[#F4F2ED]">
              {session.title}
            </h1>
          </div>
          <button
            type="button"
            disabled={isLoading}
            onClick={onStartRoundOne}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#B45309] dark:bg-[#D97706] text-white text-sm font-semibold hover:bg-[#92400E] transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B45309]"
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
            <h2 className="font-display text-lg font-semibold text-[#18181B] dark:text-[#F4F2ED]">
              Visão Geral de Alta Densidade
            </h2>
            <p className="mt-2 text-base text-[#18181B] dark:text-[#F4F2ED] leading-relaxed">
              {prep.summary}
            </p>
          </div>

          <div>
            <h2 className="font-display text-lg font-semibold text-[#18181B] dark:text-[#F4F2ED] mb-4">
              Conceitos e Regras Essenciais
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {prep.concepts.map((concept, index) => (
                <article
                  key={`${concept.term}-${index}`}
                  className="p-5 rounded-lg bg-[#FAF9F6] dark:bg-[#141311] border border-[#E5E2DC] dark:border-[#2E2C28] space-y-2"
                >
                  <p className="text-xs font-mono tabular-nums text-[#57534E] dark:text-[#A8A29E]">
                    Conceito {String(index + 1).padStart(2, '0')}
                  </p>
                  <h3 className="text-base font-semibold text-[#18181B] dark:text-[#F4F2ED]">
                    {concept.term}
                  </h3>
                  <p className="text-sm text-[#18181B] dark:text-[#E7E5E4] leading-relaxed">
                    {concept.definition}
                  </p>
                  <p className="pt-2 border-t border-[#E5E2DC] dark:border-[#2E2C28] text-xs text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
                    <span className="font-semibold text-[#B45309] dark:text-[#F59E0B]">
                      Regra-chave:{' '}
                    </span>
                    {concept.keyRule}
                  </p>
                </article>
              ))}
            </div>
          </div>

          {prep.studyTips && (
            <div className="p-5 rounded-lg bg-[#F3F1EC] dark:bg-[#21201D] border border-[#E5E2DC] dark:border-[#2E2C28]">
              <p className="text-sm font-semibold text-[#18181B] dark:text-[#F4F2ED]">
                Pontos de atenção para o treino
              </p>
              <p className="mt-1 text-sm text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
                {prep.studyTips}
              </p>
            </div>
          )}

          <div className="pt-4 border-t border-[#E5E2DC] dark:border-[#2E2C28] flex justify-end">
            <button
              type="button"
              disabled={isLoading}
              onClick={onStartRoundOne}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#B45309] dark:bg-[#D97706] text-white text-sm font-semibold hover:bg-[#92400E] transition-colors cursor-pointer disabled:opacity-50"
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
