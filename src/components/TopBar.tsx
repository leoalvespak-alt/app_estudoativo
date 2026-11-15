import { Plus } from 'lucide-react';

export type AppRoute = 'trainer' | 'library' | 'history';

interface TopBarProps {
  activeRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
  onNewTraining: () => void;
  hasActiveSession: boolean;
}

export function TopBar({
  activeRoute,
  onNavigate,
  onNewTraining,
  hasActiveSession,
}: TopBarProps) {
  return (
    <header className="border-b border-[#E5E2DC] dark:border-[#2E2C28] bg-[#FAF9F6]/95 dark:bg-[#111110]/95 backdrop-blur-sm sticky top-0 z-30">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-8">
        <button
          type="button"
          onClick={() => onNavigate('trainer')}
          className="font-display text-xl font-semibold tracking-tight text-[#18181B] dark:text-[#F4F2ED] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#B45309]"
        >
          Caderno Ativo
        </button>

        <nav aria-label="Navegação principal" className="flex items-center gap-6 sm:gap-8">
          <button
            type="button"
            onClick={() => onNavigate('trainer')}
            className={`text-sm font-medium whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#B45309] ${
              activeRoute === 'trainer'
                ? 'border-[#B45309] dark:border-[#F59E0B] text-[#18181B] dark:text-[#F4F2ED]'
                : 'border-transparent text-[#57534E] dark:text-[#A8A29E] hover:text-[#18181B] dark:hover:text-[#F4F2ED]'
            }`}
          >
            {hasActiveSession ? 'Treino Atual' : 'Configurar Treino'}
          </button>

          <button
            type="button"
            onClick={() => onNavigate('library')}
            className={`text-sm font-medium whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#B45309] ${
              activeRoute === 'library'
                ? 'border-[#B45309] dark:border-[#F59E0B] text-[#18181B] dark:text-[#F4F2ED]'
                : 'border-transparent text-[#57534E] dark:text-[#A8A29E] hover:text-[#18181B] dark:hover:text-[#F4F2ED]'
            }`}
          >
            Biblioteca de Sínteses
          </button>

          <button
            type="button"
            onClick={() => onNavigate('history')}
            className={`text-sm font-medium whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#B45309] ${
              activeRoute === 'history'
                ? 'border-[#B45309] dark:border-[#F59E0B] text-[#18181B] dark:text-[#F4F2ED]'
                : 'border-transparent text-[#57534E] dark:text-[#A8A29E] hover:text-[#18181B] dark:hover:text-[#F4F2ED]'
            }`}
          >
            Histórico
          </button>
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={onNewTraining}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[#18181B] dark:bg-[#F4F2ED] text-[#FAF9F6] dark:text-[#111110] hover:bg-[#27272A] dark:hover:bg-[#E5E2DC] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B45309]"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Novo Treino</span>
          </button>
        </div>
      </div>
    </header>
  );
}
