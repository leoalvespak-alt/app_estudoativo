import { useState } from 'react';
import { ArrowRight, Loader2, UserCheck, UserPlus } from 'lucide-react';
import { isValidUsername, normalizeUsername } from '../lib/firestoreStore';

interface UsernameGateViewProps {
  onAuthenticate: (
    usernameKey: string,
    displayName: string,
    createIfMissing: boolean
  ) => Promise<'needs_create' | 'ok'>;
  isLoading: boolean;
  errorMessage: string | null;
}

export function UsernameGateView({
  onAuthenticate,
  isLoading,
  errorMessage,
}: UsernameGateViewProps) {
  const [input, setInput] = useState('');
  const [candidateNotFound, setCandidateNotFound] = useState<{
    usernameKey: string;
    displayName: string;
  } | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const normalizedPreview = normalizeUsername(input);
  const validFormat = isValidUsername(normalizedPreview);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!validFormat) {
      setLocalError(
        'Informe um nome de usuário com 3 a 32 caracteres (letras, números, ponto, traço ou sublinhado).'
      );
      return;
    }

    const result = await onAuthenticate(normalizedPreview, input.trim(), false);
    if (result === 'needs_create') {
      setCandidateNotFound({
        usernameKey: normalizedPreview,
        displayName: input.trim(),
      });
    }
  };

  const handleCreateProfile = async () => {
    if (!candidateNotFound) return;
    setLocalError(null);
    await onAuthenticate(
      candidateNotFound.usernameKey,
      candidateNotFound.displayName,
      true
    );
  };

  return (
    <section className="max-w-[920px] mx-auto px-4 sm:px-8 py-10 sm:py-14">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 bg-white dark:bg-[#22201D] border border-[#E5E0D8] dark:border-[#36332E] rounded-xl p-6 sm:p-10">
          <p className="text-xs font-medium text-[#44403C] dark:text-[#C2BCB2]">
            Acesso rápido · Sem senha
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-[#18181B] dark:text-[#EFECE6]">
            Entre com seu nome de usuário
          </h1>
          <p className="mt-3 reading-measure text-[#44403C] dark:text-[#D0CAC0]">
            Seu histórico de treinos, pontos fracos ativos e Biblioteca de Sínteses ficam organizados e salvos na sua conta entre dispositivos.
          </p>

          {(localError || errorMessage) && (
            <div
              role="alert"
              className="mt-6 p-4 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-sm text-[#B91C1C] dark:text-red-300"
            >
              {localError || errorMessage}
            </div>
          )}

          {!candidateNotFound ? (
            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
              <div>
                <label
                  htmlFor="username-input"
                  className="block text-sm font-semibold text-[#18181B] dark:text-[#EFECE6] mb-2"
                >
                  Nome de usuário
                </label>
                <input
                  id="username-input"
                  type="text"
                  autoFocus
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    setLocalError(null);
                  }}
                  placeholder="Ex.: leonardo.alves ou maria_concursos"
                  className="w-full rounded-lg border border-[#D6D0C6] dark:border-[#45413B] bg-[#FAF8F5] dark:bg-[#141312] px-4 py-3 text-base text-[#18181B] dark:text-[#EFECE6] placeholder:text-[#57534E] dark:placeholder:text-[#A8A29E] focus:bg-white dark:focus:bg-[#1C1B19] focus:border-[#B45309] dark:focus:border-[#F59E0B] focus:outline-none transition-colors"
                />
                {input.trim().length > 0 && (
                  <p className="mt-2 text-xs text-[#44403C] dark:text-[#C2BCB2]">
                    Identificador da sua conta:{' '}
                    <span className="font-semibold text-[#18181B] dark:text-[#EFECE6]">
                      @{normalizedPreview || '...'}
                    </span>
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#B45309] dark:bg-[#F59E0B] text-[#FAF8F5] dark:text-[#141312] text-sm font-semibold hover:bg-[#92400E] dark:hover:bg-[#FBBF24] transition-colors disabled:opacity-40 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span>Verificando perfil...</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4" aria-hidden="true" />
                    <span>Continuar</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="mt-7 p-6 rounded-xl bg-[#F5F2EC] dark:bg-[#1C1B19] border border-[#E5E0D8] dark:border-[#36332E] space-y-5">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-[#44403C] dark:text-[#C2BCB2]">
                  Novo perfil
                </p>
                <h2 className="font-display text-xl font-semibold text-[#18181B] dark:text-[#EFECE6]">
                  Criar conta como @{candidateNotFound.usernameKey}?
                </h2>
                <p className="text-sm text-[#44403C] dark:text-[#D0CAC0] leading-relaxed">
                  Ainda não existe um histórico salvo para este nome de usuário. Crie sua conta agora para registrar seus estudos.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={handleCreateProfile}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#B45309] dark:bg-[#F59E0B] text-[#FAF8F5] dark:text-[#141312] text-sm font-semibold hover:bg-[#92400E] dark:hover:bg-[#FBBF24] transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      <span>Criando perfil...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" aria-hidden="true" />
                      <span>Criar perfil @{candidateNotFound.usernameKey}</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => setCandidateNotFound(null)}
                  className="px-4 py-2.5 rounded-lg border border-[#D6D0C6] dark:border-[#45413B] text-sm font-medium text-[#44403C] dark:text-[#D0CAC0] hover:text-[#18181B] dark:hover:text-[#EFECE6] cursor-pointer"
                >
                  Digitar outro nome
                </button>
              </div>
            </div>
          )}
        </div>

        <aside className="lg:col-span-5 bg-[#F5F2EC] dark:bg-[#1C1B19] border border-[#E5E0D8] dark:border-[#36332E] rounded-xl p-6 sm:p-8 space-y-4">
          <h2 className="font-display text-lg font-semibold text-[#18181B] dark:text-[#EFECE6]">
            Como funciona sua conta de estudo
          </h2>
          <ul className="space-y-3 text-sm text-[#44403C] dark:text-[#D0CAC0] leading-relaxed">
            <li className="pb-3 border-b border-[#E5E0D8] dark:border-[#36332E]">
              <span className="font-semibold text-[#18181B] dark:text-[#EFECE6]">
                Históricos separados:
              </span>{' '}
              cada nome de usuário mantém sua própria lista de treinos, pontos fracos e sínteses finais.
            </li>
            <li className="pb-3 border-b border-[#E5E0D8] dark:border-[#36332E]">
              <span className="font-semibold text-[#18181B] dark:text-[#EFECE6]">
                Retomada imediata:
              </span>{' '}
              ao digitar o mesmo nome em outro navegador ou dispositivo, suas sessões carregam automaticamente.
            </li>
            <li>
              <span className="font-semibold text-[#18181B] dark:text-[#EFECE6]">
                Acesso direto:
              </span>{' '}
              entre sem senha e evite colar dados pessoais sensíveis nos textos de estudo.
            </li>
          </ul>
        </aside>
      </div>
    </section>
  );
}
