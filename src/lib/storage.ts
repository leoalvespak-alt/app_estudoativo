import type {
  ComparativeTableEntry,
  ErrorCause,
  LibraryEntry,
  ThemeMode,
  TrainingSession,
  UserProfile,
  WeakPointBankEntry,
} from '../types/trainer';

const USERNAME_STORAGE_KEY = 'caderno_ativo_current_username_v1';
const THEME_STORAGE_KEY = 'caderno_ativo_theme_mode_v1';
const PROFILE_CACHE_PREFIX = 'caderno_ativo_profile_v1_';
const SESSIONS_CACHE_PREFIX = 'caderno_ativo_sessions_v1_';
const WEAK_POINTS_CACHE_PREFIX = 'caderno_ativo_weakpoints_v1_';
const COMPARATIVE_TABLES_CACHE_PREFIX = 'caderno_ativo_comparative_tables_v1_';
const PENDING_QUEUE_PREFIX = 'caderno_ativo_pending_sync_v1_';

export type SyncStatus = 'synced' | 'syncing' | 'offline_saved' | 'error';

export interface PendingWeakPointCauseUpdate {
  weakPointId: string;
  cause: ErrorCause;
  previousCause?: ErrorCause | '';
  existingCounts?: Partial<Record<ErrorCause, number>>;
}

export interface PendingSyncQueue {
  sessionCreates: TrainingSession[];
  sessionUpdates: TrainingSession[];
  sessionDeletes: string[];
  weakPointToggles: WeakPointBankEntry[];
  weakPointDeletes: string[];
  weakPointCauseUpdates: PendingWeakPointCauseUpdate[];
  comparativeTableCreates: ComparativeTableEntry[];
  comparativeTableDeletes: string[];
  onboardingCompleted: boolean;
}

const EMPTY_QUEUE: PendingSyncQueue = {
  sessionCreates: [],
  sessionUpdates: [],
  sessionDeletes: [],
  weakPointToggles: [],
  weakPointDeletes: [],
  weakPointCauseUpdates: [],
  comparativeTableCreates: [],
  comparativeTableDeletes: [],
  onboardingCompleted: false,
};

function safeReadJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWriteJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota / private mode errors
  }
}

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

export function getCachedUserProfile(usernameKey: string): UserProfile | null {
  return safeReadJson<UserProfile | null>(`${PROFILE_CACHE_PREFIX}${usernameKey}`, null);
}

export function setCachedUserProfile(profile: UserProfile): void {
  safeWriteJson(`${PROFILE_CACHE_PREFIX}${profile.usernameKey}`, profile);
}

export function getCachedSessions(usernameKey: string): TrainingSession[] {
  return safeReadJson<TrainingSession[]>(`${SESSIONS_CACHE_PREFIX}${usernameKey}`, []);
}

export function setCachedSessions(
  usernameKey: string,
  sessions: TrainingSession[]
): void {
  safeWriteJson(`${SESSIONS_CACHE_PREFIX}${usernameKey}`, sessions);
}

export function getCachedWeakPoints(usernameKey: string): WeakPointBankEntry[] {
  return safeReadJson<WeakPointBankEntry[]>(
    `${WEAK_POINTS_CACHE_PREFIX}${usernameKey}`,
    []
  );
}

export function setCachedWeakPoints(
  usernameKey: string,
  entries: WeakPointBankEntry[]
): void {
  safeWriteJson(`${WEAK_POINTS_CACHE_PREFIX}${usernameKey}`, entries);
}

export function getCachedComparativeTables(
  usernameKey: string
): ComparativeTableEntry[] {
  return safeReadJson<ComparativeTableEntry[]>(
    `${COMPARATIVE_TABLES_CACHE_PREFIX}${usernameKey}`,
    []
  );
}

export function setCachedComparativeTables(
  usernameKey: string,
  tables: ComparativeTableEntry[]
): void {
  safeWriteJson(`${COMPARATIVE_TABLES_CACHE_PREFIX}${usernameKey}`, tables);
}

export function getPendingSyncQueue(usernameKey: string): PendingSyncQueue {
  const stored = safeReadJson<Partial<PendingSyncQueue>>(
    `${PENDING_QUEUE_PREFIX}${usernameKey}`,
    {}
  );
  return {
    sessionCreates: Array.isArray(stored.sessionCreates) ? stored.sessionCreates : [],
    sessionUpdates: Array.isArray(stored.sessionUpdates) ? stored.sessionUpdates : [],
    sessionDeletes: Array.isArray(stored.sessionDeletes) ? stored.sessionDeletes : [],
    weakPointToggles: Array.isArray(stored.weakPointToggles) ? stored.weakPointToggles : [],
    weakPointDeletes: Array.isArray(stored.weakPointDeletes) ? stored.weakPointDeletes : [],
    weakPointCauseUpdates: Array.isArray(stored.weakPointCauseUpdates)
      ? stored.weakPointCauseUpdates
      : [],
    comparativeTableCreates: Array.isArray(stored.comparativeTableCreates)
      ? stored.comparativeTableCreates
      : [],
    comparativeTableDeletes: Array.isArray(stored.comparativeTableDeletes)
      ? stored.comparativeTableDeletes
      : [],
    onboardingCompleted: Boolean(stored.onboardingCompleted),
  };
}

export function setPendingSyncQueue(
  usernameKey: string,
  queue: PendingSyncQueue
): void {
  safeWriteJson(`${PENDING_QUEUE_PREFIX}${usernameKey}`, queue);
}

export function hasPendingSyncItems(usernameKey: string): boolean {
  const q = getPendingSyncQueue(usernameKey);
  return (
    q.sessionCreates.length > 0 ||
    q.sessionUpdates.length > 0 ||
    q.sessionDeletes.length > 0 ||
    q.weakPointToggles.length > 0 ||
    q.weakPointDeletes.length > 0 ||
    q.weakPointCauseUpdates.length > 0 ||
    q.comparativeTableCreates.length > 0 ||
    q.comparativeTableDeletes.length > 0 ||
    q.onboardingCompleted
  );
}

export function enqueueSessionCreate(
  usernameKey: string,
  session: TrainingSession
): void {
  const q = getPendingSyncQueue(usernameKey);
  const filteredCreates = q.sessionCreates.filter((s) => s.id !== session.id);
  setPendingSyncQueue(usernameKey, {
    ...q,
    sessionCreates: [session, ...filteredCreates],
    sessionDeletes: q.sessionDeletes.filter((id) => id !== session.id),
  });
}

export function enqueueSessionUpdate(
  usernameKey: string,
  session: TrainingSession
): void {
  const q = getPendingSyncQueue(usernameKey);
  if (q.sessionCreates.some((s) => s.id === session.id)) {
    setPendingSyncQueue(usernameKey, {
      ...q,
      sessionCreates: q.sessionCreates.map((s) => (s.id === session.id ? session : s)),
    });
    return;
  }
  const filteredUpdates = q.sessionUpdates.filter((s) => s.id !== session.id);
  setPendingSyncQueue(usernameKey, {
    ...q,
    sessionUpdates: [...filteredUpdates, session],
  });
}

export function enqueueSessionDelete(usernameKey: string, sessionId: string): void {
  const q = getPendingSyncQueue(usernameKey);
  const wasCreatedOffline = q.sessionCreates.some((s) => s.id === sessionId);
  setPendingSyncQueue(usernameKey, {
    ...q,
    sessionCreates: q.sessionCreates.filter((s) => s.id !== sessionId),
    sessionUpdates: q.sessionUpdates.filter((s) => s.id !== sessionId),
    sessionDeletes: wasCreatedOffline
      ? q.sessionDeletes
      : Array.from(new Set([...q.sessionDeletes, sessionId])),
  });
}

export function enqueueWeakPointToggle(
  usernameKey: string,
  entry: WeakPointBankEntry
): void {
  const q = getPendingSyncQueue(usernameKey);
  const filtered = q.weakPointToggles.filter((e) => e.id !== entry.id);
  setPendingSyncQueue(usernameKey, {
    ...q,
    weakPointToggles: [...filtered, entry],
  });
}

export function enqueueWeakPointDelete(
  usernameKey: string,
  weakPointId: string
): void {
  const q = getPendingSyncQueue(usernameKey);
  setPendingSyncQueue(usernameKey, {
    ...q,
    weakPointToggles: q.weakPointToggles.filter((e) => e.id !== weakPointId),
    weakPointDeletes: Array.from(new Set([...q.weakPointDeletes, weakPointId])),
  });
}

export function enqueueWeakPointCauseUpdate(
  usernameKey: string,
  item: PendingWeakPointCauseUpdate
): void {
  const q = getPendingSyncQueue(usernameKey);
  const filtered = q.weakPointCauseUpdates.filter((u) => u.weakPointId !== item.weakPointId);
  setPendingSyncQueue(usernameKey, {
    ...q,
    weakPointCauseUpdates: [...filtered, item],
  });
}

export function enqueueComparativeTableCreate(
  usernameKey: string,
  table: ComparativeTableEntry
): void {
  const q = getPendingSyncQueue(usernameKey);
  const filtered = q.comparativeTableCreates.filter((t) => t.id !== table.id);
  setPendingSyncQueue(usernameKey, {
    ...q,
    comparativeTableCreates: [table, ...filtered],
    comparativeTableDeletes: q.comparativeTableDeletes.filter((id) => id !== table.id),
  });
}

export function enqueueComparativeTableDelete(
  usernameKey: string,
  tableId: string
): void {
  const q = getPendingSyncQueue(usernameKey);
  const wasCreatedOffline = q.comparativeTableCreates.some((t) => t.id === tableId);
  setPendingSyncQueue(usernameKey, {
    ...q,
    comparativeTableCreates: q.comparativeTableCreates.filter((t) => t.id !== tableId),
    comparativeTableDeletes: wasCreatedOffline
      ? q.comparativeTableDeletes
      : Array.from(new Set([...q.comparativeTableDeletes, tableId])),
  });
}

export function enqueueOnboardingCompleted(usernameKey: string): void {
  const q = getPendingSyncQueue(usernameKey);
  setPendingSyncQueue(usernameKey, {
    ...q,
    onboardingCompleted: true,
  });
}

export function clearPendingSyncQueue(usernameKey: string): void {
  setPendingSyncQueue(usernameKey, EMPTY_QUEUE);
}

export function mergeSessionsWithPending(
  cloudSessions: TrainingSession[],
  queue: PendingSyncQueue
): TrainingSession[] {
  const deletedSet = new Set(queue.sessionDeletes);
  const updatesMap = new Map(queue.sessionUpdates.map((s) => [s.id, s]));
  const merged = cloudSessions
    .filter((s) => !deletedSet.has(s.id))
    .map((s) => {
      const localDraft = updatesMap.get(s.id);
      if (localDraft && localDraft.updatedAt >= s.updatedAt) {
        return localDraft;
      }
      return s;
    });

  const existingIds = new Set(merged.map((s) => s.id));
  for (const created of queue.sessionCreates) {
    if (!deletedSet.has(created.id) && !existingIds.has(created.id)) {
      merged.unshift(created);
    }
  }

  return merged.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function mergeComparativeTablesWithPending(
  cloudTables: ComparativeTableEntry[],
  queue: PendingSyncQueue
): ComparativeTableEntry[] {
  const deletedSet = new Set(queue.comparativeTableDeletes);
  const filtered = cloudTables.filter((t) => !deletedSet.has(t.id));
  const existingIds = new Set(filtered.map((t) => t.id));
  const merged = [...filtered];
  for (const created of queue.comparativeTableCreates) {
    if (!deletedSet.has(created.id) && !existingIds.has(created.id)) {
      merged.unshift(created);
    }
  }
  return merged.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function buildLibraryEntries(
  sessions: TrainingSession[],
  comparativeTables: ComparativeTableEntry[] = []
): LibraryEntry[] {
  const entries: LibraryEntry[] = [];

  for (const session of sessions) {
    if (session.finalSynthesis) {
      entries.push({
        id: `lib_final_${session.id}`,
        sessionId: session.id,
        sessionTitle: session.title,
        kind: 'hierarchical_tree',
        title: `Árvore Hierárquica — ${session.title}`,
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

  for (const ct of comparativeTables) {
    entries.push({
      id: `lib_comp_${ct.id}`,
      sessionId: ct.sourceSessionId || '',
      sessionTitle: ct.discipline,
      kind: 'comparative_table',
      title: ct.title || `${ct.conceptA} × ${ct.conceptB}`,
      subtitle: `${ct.discipline} · ${ct.rows.length} critério(s) comparado(s)`,
      createdAt: ct.createdAt,
      comparativeTable: ct,
    });
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
