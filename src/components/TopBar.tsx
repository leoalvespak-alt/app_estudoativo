import { Plus } from 'lucide-react';

export type AppRoute = 'trainer' | 'progress' | 'library' | 'history';

interface TopBarProps {
  activeRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
  onNewTraining: () => void;
  hasActiveSession: boolean;
  hasPendingScope: boolean;
}

const NAV_ITEMS: Array<{
  id: AppRoute;
  label: string;
  tourKey?: string;
}> = [
  { id: 'trainer', label: 'Configurar Treino' },
  { id: 'progress', label: 'Progresso', tourKey: 'nav-progress' },
  { id: 'library', label: 'Biblioteca de Sínteses', tourKey: 'nav-library' },
  { id: 'history', label: 'Histórico', tourKey: 'nav-history' },
];

export function TopBar({
  activeRoute,
  onNavigate,
  onNewTraining,
  hasActiveSession,
  hasPendingScope,
}: TopBarProps) {
  const showNewTrainingButton =
    activeRoute !== 'trainer' || hasActiveSession || hasPendingScope;

  return (
    <header className="border-b border-[#E5E0D8] dark:border-[#36332E] bg-[#FAF8F5]/95 dark:bg-[#141312]/95 backdrop-blur-sm md:sticky md:top-0 z-30">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 min-h-[52px] py-2 md:py-0 md:h-[52px] flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-8">
        <div className="flex items-center justify-between gap-4 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('trainer')}
            className="font-display text-lg sm:text-xl font-semibold tracking-tight text-[#18181B] dark:text-[#EFECE6] whitespace-nowrap shrink-0 cursor-pointer"
          >
            Caderno Ativo
          </button>

          {showNewTrainingButton && (
            <button
              type="button"
              onClick={onNewTraining}
              className="md:hidden inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#18181B] dark:bg-[#EFECE6] text-[#FAF8F5] dark:text-[#141312] hover:bg-[#27272A] dark:hover:bg-[#E5E0D8] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Novo Treino</span>
            </button>
          )}
        </div>

        <nav
          role="tablist"
          aria-label="Navegação principal"
          className="flex items-center gap-4 sm:gap-7 overflow-x-auto max-w-full pb-0.5 md:pb-0"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeRoute === item.id;
            const displayLabel =
              item.id === 'trainer' && hasActiveSession
                ? 'Treino Atual'
                : item.label;

            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                data-tour={item.tourKey}
                onClick={() => onNavigate(item.id)}
                className={`text-sm font-medium whitespace-nowrap shrink-0 py-1.5 border-b-2 transition-colors cursor-pointer ${
                  isActive
                    ? 'border-[#B45309] dark:border-[#F59E0B] text-[#18181B] dark:text-[#EFECE6]'
                    : 'border-transparent text-[#44403C] dark:text-[#C2BCB2] hover:text-[#18181B] dark:hover:text-[#EFECE6]'
                }`}
              >
                {displayLabel}
              </button>
            );
          })}
        </nav>

        <div className="hidden md:flex items-center shrink-0 min-w-[126px] justify-end">
          {showNewTrainingButton && (
            <button
              type="button"
              onClick={onNewTraining}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#18181B] dark:bg-[#EFECE6] text-[#FAF8F5] dark:text-[#141312] hover:bg-[#27272A] dark:hover:bg-[#E5E0D8] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Novo Treino</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
