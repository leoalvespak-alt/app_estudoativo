import type { LibraryEntry, ThemeMode, TrainingSession } from '../types/trainer';

const USERNAME_STORAGE_KEY = 'caderno_ativo_current_username_v1';
const THEME_STORAGE_KEY = 'caderno_ativo_theme_mode_v1';

export function getStoredUsername(): string | null {
  try {
    return window.localStorage.getItem(USERNAME_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredUsername(usernameKey: string | null): void {
  try {
    if (usernameKey) {
      window.localStorage.setItem(USERNAME_STORAGE_KEY, usernameKey);
    } else {
      window.localStorage.removeItem(USERNAME_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function getStoredThemeMode(): ThemeMode {
  try {
    const val = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (val === 'light' || val === 'dark' || val === 'system') {
      return val;
    }
    return 'system';
  } catch {
    return 'system';
  }
}

export function setStoredThemeMode(mode: ThemeMode): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Ignore storage errors
  }
}

export function buildLibraryEntries(sessions: TrainingSession[]): LibraryEntry[] {
  const entries: LibraryEntry[] = [];

  for (const session of sessions) {
    if (session.finalSynthesis) {
      entries.push({
        id: `lib_final_${session.id}`,
        sessionId: session.id,
        sessionTitle: session.title,
        kind: 'final_tree',
        title: `Árvore Ultracompacta — ${session.title}`,
        subtitle: `${session.finalSynthesis.topicsCoveredCount} tópicos · ${session.finalSynthesis.masteredWeakPointsCount} pontos fracos consolidados`,
        createdAt: session.finalSynthesis.generatedAt,
        asciiTree: session.finalSynthesis.asciiTree,
        closingFeedback: session.finalSynthesis.closingFeedback,
        weakPointsCount: session.activeWeakPoints.length,
      });
    }

    for (const syn of session.strategicSyntheses) {
      entries.push({
        id: `lib_strat_${session.id}_${syn.id}`,
        sessionId: session.id,
        sessionTitle: session.title,
        kind: 'strategic_synthesis',
        title: syn.title,
        subtitle: `${session.title} · Após Rodada ${syn.afterRound}`,
        createdAt: syn.generatedAt,
        strategicSynthesis: syn,
      });
    }

    if (session.prepClass) {
      entries.push({
        id: `lib_prep_${session.id}`,
        sessionId: session.id,
        sessionTitle: session.title,
        kind: 'prep_class',
        title: `Aula Preparatória — ${session.title}`,
        subtitle: `${session.prepClass.concepts.length} conceitos centrais definidos`,
        createdAt: session.prepClass.generatedAt,
        prepClass: session.prepClass,
      });
    }
  }

  return entries.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function slugifyFilename(value: string): string {
  return (
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 48) || 'sintese-caderno-ativo'
  );
}

export function formatShortDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
