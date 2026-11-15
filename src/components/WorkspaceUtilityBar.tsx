import {
  BookOpen,
  CloudOff,
  LogOut,
  Monitor,
  Moon,
  PauseCircle,
  RefreshCw,
  Sun,
  User,
} from 'lucide-react';
import type { SyncStatus } from '../lib/storage';
import type { ThemeMode, UserProfile } from '../types/trainer';

interface WorkspaceUtilityBarProps {
  currentUser: UserProfile | null;
  themeMode: ThemeMode;
  onChangeTheme: (mode: ThemeMode) => void;
  onSwitchUser: () => void;
  onOpenMethodGuide: () => void;
  isMethodGuideOpen?: boolean;
  isFocusMode?: boolean;
  focusTitle?: string;
  onExitFocusSession?: () => void;
  syncStatus?: SyncStatus;
  onRetrySync?: () => void;
}

export function WorkspaceUtilityBar({
  currentUser,
  themeMode,
  onChangeTheme,
  onSwitchUser,
  onOpenMethodGuide,
  isMethodGuideOpen = false,
  isFocusMode = false,
  focusTitle,
  onExitFocusSession,
  syncStatus = 'synced',
  onRetrySync,
}: WorkspaceUtilityBarProps) {
  const showOfflineNotice = syncStatus === 'offline_saved' || syncStatus === 'error';

  if (isFocusMode && currentUser) {
    return (
      <div className="border-b border-[#E5E0D8] dark:border-[#36332E] bg-[#F5F2EC] dark:bg-[#1C1B19]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-1.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 min-w-0 text-[#44403C] dark:text-[#D0CAC0]">
            <span className="font-semibold text-[#18181B] dark:text-[#EFECE6] whitespace-nowrap shrink-0">
              Modo Foco
            </span>
            {focusTitle && (
              <>
                <span aria-hidden="true">·</span>
                <span className="truncate max-w-[240px] sm:max-w-[440px]">
                  {focusTitle}
                </span>
              </>
            )}
            <span className="sr-only" aria-live="polite">
              {showOfflineNotice
                ? 'Salvo neste dispositivo, aguardando conexão'
                : syncStatus === 'syncing'
                  ? 'Salvando progresso'
                  : 'Progresso salvo'}
            </span>
            {showOfflineNotice && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1.5 text-[#92400E] dark:text-[#FBBF24] font-medium whitespace-nowrap shrink-0">
                  <CloudOff className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Salvo neste dispositivo, aguardando conexão</span>
                  {onRetrySync && (
                    <button
                      type="button"
                      onClick={onRetrySync}
                      className="underline underline-offset-2 text-[#B45309] dark:text-[#F59E0B] cursor-pointer ml-1"
                    >
                      Tentar agora
                    </button>
                  )}
                </span>
              </>
            )}
          </div>

          {onExitFocusSession && (
            <button
              type="button"
              onClick={onExitFocusSession}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#D6D0C6] dark:border-[#45413B] bg-[#FAF8F5] dark:bg-[#22201D] text-xs font-medium text-[#18181B] dark:text-[#EFECE6] hover:border-[#B45309] dark:hover:border-[#F59E0B] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <PauseCircle className="w-3.5 h-3.5 text-[#B45309] dark:text-[#F59E0B]" aria-hidden="true" />
              <span>Pausar sessão</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-[#E5E0D8] dark:border-[#36332E] bg-[#F5F2EC] dark:bg-[#1C1B19]">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-1.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2.5 text-[#44403C] dark:text-[#D0CAC0]">
          {currentUser ? (
            <>
              <span className="inline-flex items-center gap-1.5 font-medium text-[#18181B] dark:text-[#EFECE6]">
                <User className="w-3.5 h-3.5 text-[#57534E] dark:text-[#C2BCB2]" aria-hidden="true" />
                <span>@{currentUser.usernameKey}</span>
              </span>
              <span aria-hidden="true">·</span>
              <span aria-live="polite">
                {showOfflineNotice ? (
                  <span className="inline-flex items-center gap-1.5 text-[#92400E] dark:text-[#FBBF24] font-medium">
                    <CloudOff className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Salvo neste dispositivo, aguardando conexão</span>
                    {onRetrySync && (
                      <button
                        type="button"
                        onClick={onRetrySync}
                        className="inline-flex items-center gap-1 text-[#B45309] dark:text-[#F59E0B] hover:underline underline-offset-2 cursor-pointer ml-1"
                      >
                        <RefreshCw className="w-3 h-3" aria-hidden="true" />
                        <span>Sincronizar</span>
                      </button>
                    )}
                  </span>
                ) : syncStatus === 'syncing' ? (
                  'Salvando alterações na sua conta...'
                ) : (
                  'Progresso salvo na sua conta'
                )}
              </span>
              <button
                type="button"
                onClick={onSwitchUser}
                className="inline-flex items-center gap-1 font-medium text-[#B45309] dark:text-[#F59E0B] hover:underline underline-offset-4 cursor-pointer ml-1 whitespace-nowrap shrink-0"
              >
                <LogOut className="w-3 h-3" aria-hidden="true" />
                <span>Trocar usuário</span>
              </button>
            </>
          ) : (
            <span>Identifique-se com um nome de usuário para salvar seus treinos entre dispositivos</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {currentUser && (
            <button
              type="button"
              data-tour="utility-guide"
              onClick={onOpenMethodGuide}
              aria-expanded={isMethodGuideOpen}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isMethodGuideOpen
                  ? 'border-[#B45309] dark:border-[#F59E0B] bg-amber-50 dark:bg-[#282522] text-[#B45309] dark:text-[#F59E0B]'
                  : 'border-[#D6D0C6] dark:border-[#45413B] bg-[#FAF8F5] dark:bg-[#22201D] text-[#18181B] dark:text-[#EFECE6] hover:border-[#B45309] dark:hover:border-[#F59E0B]'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-[#B45309] dark:text-[#F59E0B]" aria-hidden="true" />
              <span>Como funciona · Tour</span>
            </button>
          )}

          <div
            role="group"
            aria-label="Selecionar tema visual"
            className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-[#E5E0D8] dark:bg-[#282522] border border-[#D6D0C6] dark:border-[#3E3A34]"
          >
            {(
              [
                ['system', 'Sistema', Monitor],
                ['light', 'Claro', Sun],
                ['dark', 'Noturno', Moon],
              ] as const
            ).map(([mode, label, Icon]) => {
              const active = themeMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChangeTheme(mode)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-[#FAF8F5] dark:bg-[#141312] text-[#18181B] dark:text-[#EFECE6] shadow-xs'
                      : 'text-[#44403C] dark:text-[#D0CAC0] hover:text-[#18181B] dark:hover:text-[#EFECE6]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
