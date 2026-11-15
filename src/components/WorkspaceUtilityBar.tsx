import { LogOut, Monitor, Moon, Sun, User } from 'lucide-react';
import type { ThemeMode, UserProfile } from '../types/trainer';

interface WorkspaceUtilityBarProps {
  currentUser: UserProfile | null;
  themeMode: ThemeMode;
  onChangeTheme: (mode: ThemeMode) => void;
  onSwitchUser: () => void;
}

export function WorkspaceUtilityBar({
  currentUser,
  themeMode,
  onChangeTheme,
  onSwitchUser,
}: WorkspaceUtilityBarProps) {
  return (
    <div className="border-b border-[#E5E2DC] dark:border-[#2E2C28] bg-[#F3F1EC]/75 dark:bg-[#191816]">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-2 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3 text-[#57534E] dark:text-[#A8A29E]">
          {currentUser ? (
            <>
              <span className="inline-flex items-center gap-1.5 font-medium text-[#18181B] dark:text-[#F4F2ED]">
                <User className="w-3.5 h-3.5 text-[#B45309] dark:text-[#F59E0B]" aria-hidden="true" />
                <span>@{currentUser.usernameKey}</span>
              </span>
              <span aria-hidden="true">·</span>
              <span>Progresso sincronizado na nuvem</span>
              <button
                type="button"
                onClick={onSwitchUser}
                className="inline-flex items-center gap-1 font-medium text-[#B45309] dark:text-[#F59E0B] hover:underline underline-offset-4 cursor-pointer ml-1"
              >
                <LogOut className="w-3 h-3" aria-hidden="true" />
                <span>Trocar usuário</span>
              </button>
            </>
          ) : (
            <span>Identifique-se com um nome de usuário para salvar e sincronizar na nuvem</span>
          )}
        </div>

        <div
          role="group"
          aria-label="Selecionar tema visual"
          className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-[#E5E2DC]/60 dark:bg-[#262420] border border-[#D6D3CD] dark:border-[#34312C]"
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
                onClick={() => onChangeTheme(mode)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-white dark:bg-[#111110] text-[#18181B] dark:text-[#F4F2ED] shadow-xs'
                    : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#18181B] dark:hover:text-[#F4F2ED]'
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
  );
}
