/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { TopBar, type AppRoute } from './components/TopBar';
import { WorkspaceUtilityBar } from './components/WorkspaceUtilityBar';
import { UsernameGateView } from './components/UsernameGateView';
import { ScopeSetupView } from './components/ScopeSetupView';
import { PrepClassView } from './components/PrepClassView';
import { TrainingWorkbench } from './components/TrainingWorkbench';
import { FinalSynthesisView } from './components/FinalSynthesisView';
import { SynthesisLibraryView } from './components/SynthesisLibraryView';
import { HistoryView } from './components/HistoryView';
import { MethodGuideModal } from './components/MethodGuideModal';
import { OnboardingTour } from './components/OnboardingTour';
import { ProgressView } from './components/ProgressView';
import { ConfirmExitModal } from './components/ConfirmExitModal';
import { ComparativeTableModal } from './components/ComparativeTableModal';
import {
  evaluateRound,
  finalizeTrainerSession,
  generateComparativeTable,
  generateRound,
  initTrainerSession,
} from './lib/api';
import { testFirestoreConnection } from './lib/firebase';
import {
  createCloudComparativeTable,
  createCloudSession,
  createUserProfile,
  deleteCloudComparativeTable,
  deleteCloudSession,
  deleteWeakPointBankEntry,
  getUserProfile,
  makeWeakPointBankId,
  markUserOnboardingCompleted,
  resolveSessionDiscipline,
  subscribeUserComparativeTables,
  subscribeUserSessions,
  subscribeUserWeakPoints,
  syncRoundWeakPointsToBank,
  toggleWeakPointStatus,
  touchUserProfile,
  updateCloudSession,
  updateWeakPointErrorCause,
} from './lib/firestoreStore';
import {
  buildMergedWeakPointBank,
  computeDiagnosticAnalytics,
  type MergedWeakPointItem,
  type WorstTopicRankItem,
} from './lib/progressAnalytics';
import {
  clearPendingSyncQueue,
  enqueueComparativeTableCreate,
  enqueueComparativeTableDelete,
  enqueueOnboardingCompleted,
  enqueueSessionCreate,
  enqueueSessionDelete,
  enqueueSessionUpdate,
  enqueueWeakPointCauseUpdate,
  enqueueWeakPointDelete,
  enqueueWeakPointToggle,
  getCachedComparativeTables,
  getCachedSessions,
  getCachedUserProfile,
  getCachedWeakPoints,
  getPendingSyncQueue,
  getStoredThemeMode,
  getStoredUsername,
  hasPendingSyncItems,
  mergeComparativeTablesWithPending,
  mergeSessionsWithPending,
  setCachedComparativeTables,
  setCachedSessions,
  setCachedUserProfile,
  setCachedWeakPoints,
  setStoredThemeMode,
  setStoredUsername,
  type SyncStatus,
} from './lib/storage';
import type {
  ComparativeTableEntry,
  ConfidenceLevel,
  ErrorCause,
  KbSourceRef,
  OptionLetter,
  QuestionEvaluation,
  RoundRecord,
  SourceType,
  ThemeMode,
  TrainerQuestion,
  TrainingSession,
  UserProfile,
  WeakPoint,
  WeakPointBankEntry,
} from './types/trainer';

function mergeKbSources(
  existing: KbSourceRef[] = [],
  incoming: KbSourceRef[] = []
): KbSourceRef[] {
  const merged: KbSourceRef[] = [];
  const seen = new Set<string>();
  for (const src of [...existing, ...incoming]) {
    if (!src) continue;
    const key = `${src.origin || 'git'}::${src.url || src.relativePath || src.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({
      title: String(src.title || 'Documento'),
      discipline: String(src.discipline || 'Concursos'),
      sourceLabel: String(src.sourceLabel || 'Base de Estudos'),
      relativePath: String(src.relativePath || ''),
      origin: src.origin === 'web' ? 'web' : 'git',
      url: String(src.url || ''),
    });
    if (merged.length >= 20) break;
  }
  return merged;
}

export default function App() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getStoredThemeMode());
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isBootingUser, setIsBootingUser] = useState<boolean>(() => Boolean(getStoredUsername()));
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [weakPointsBank, setWeakPointsBank] = useState<WeakPointBankEntry[]>([]);
  const [comparativeTables, setComparativeTables] = useState<ComparativeTableEntry[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [route, setRoute] = useState<AppRoute>('trainer');
  const [librarySelectedEntryId, setLibrarySelectedEntryId] = useState<string | null>(null);
  const [activeComparativeModalId, setActiveComparativeModalId] = useState<string | null>(null);
  const [pendingScope, setPendingScope] = useState<{
    sourceType: SourceType;
    sourceContent: string;
    selectedKbPaths: string[];
    disciplineHint?: string;
  } | null>(null);

  const [isInitializing, setIsInitializing] = useState(false);
  const [isGeneratingRound, setIsGeneratingRound] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isLaunchingSurgical, setIsLaunchingSurgical] = useState(false);
  const [generatingComparativeQuestionId, setGeneratingComparativeQuestionId] = useState<
    string | null
  >(null);
  const [generatingComparativeProgressKey, setGeneratingComparativeProgressKey] = useState<
    string | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [showMethodGuide, setShowMethodGuide] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [pendingExitAction, setPendingExitAction] = useState<(() => void) | null>(null);

  const draftSyncTimerRef = useRef<number | null>(null);
  const latestDraftRef = useRef<{ usernameKey: string; session: TrainingSession } | null>(null);

  // 1. OS-aware Dark Mode synchronization
  useEffect(() => {
    setStoredThemeMode(themeMode);
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const shouldBeDark =
        themeMode === 'dark' || (themeMode === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', shouldBeDark);
    };

    applyTheme();
    media.addEventListener('change', applyTheme);
    return () => media.removeEventListener('change', applyTheme);
  }, [themeMode]);

  // Helper: flush queued offline/pending mutations to Firestore
  const flushPendingSync = useCallback(async (usernameKey: string): Promise<void> => {
    if (!hasPendingSyncItems(usernameKey)) {
      setSyncStatus('synced');
      return;
    }

    const queue = getPendingSyncQueue(usernameKey);
    setSyncStatus('syncing');

    try {
      for (const created of queue.sessionCreates) {
        await createCloudSession(usernameKey, created);
      }
      for (const updated of queue.sessionUpdates) {
        await updateCloudSession(usernameKey, updated);
      }
      for (const deletedId of queue.sessionDeletes) {
        await deleteCloudSession(usernameKey, deletedId);
      }
      for (const wp of queue.weakPointToggles) {
        const invertedBeforeToggle: WeakPointBankEntry = {
          ...wp,
          status: wp.status === 'mastered' ? 'active' : 'mastered',
        };
        await toggleWeakPointStatus(usernameKey, invertedBeforeToggle);
      }
      for (const wpId of queue.weakPointDeletes) {
        await deleteWeakPointBankEntry(usernameKey, wpId);
      }
      for (const cu of queue.weakPointCauseUpdates) {
        await updateWeakPointErrorCause({
          usernameKey,
          weakPointId: cu.weakPointId,
          cause: cu.cause,
          previousCause: cu.previousCause,
          existingCounts: cu.existingCounts,
        });
      }
      for (const ct of queue.comparativeTableCreates) {
        await createCloudComparativeTable(usernameKey, ct);
      }
      for (const ctId of queue.comparativeTableDeletes) {
        await deleteCloudComparativeTable(usernameKey, ctId);
      }
      if (queue.onboardingCompleted) {
        await markUserOnboardingCompleted(usernameKey);
      }

      clearPendingSyncQueue(usernameKey);
      setSyncStatus('synced');
    } catch {
      setSyncStatus('offline_saved');
    }
  }, []);

  // 2. Boot connection check + restore remembered username profile (with local fallback)
  useEffect(() => {
    let active = true;
    async function boot() {
      await testFirestoreConnection();
      const remembered = getStoredUsername();
      if (!remembered) {
        if (active) setIsBootingUser(false);
        return;
      }

      const cachedProfile = getCachedUserProfile(remembered);

      try {
        const profile = await getUserProfile(remembered);
        if (!active) return;
        if (profile) {
          setCachedUserProfile(profile);
          setCurrentUser(profile);
          touchUserProfile(profile.usernameKey, profile.displayName).catch(() => {});
        } else {
          setStoredUsername(null);
        }
      } catch (err) {
        if (!active) return;
        if (cachedProfile) {
          setCurrentUser(cachedProfile);
          setSyncStatus('offline_saved');
        } else {
          setAuthError(
            err instanceof Error
              ? err.message
              : 'Não foi possível carregar o perfil salvo neste dispositivo.'
          );
          setStoredUsername(null);
        }
      } finally {
        if (active) setIsBootingUser(false);
      }
    }
    boot();
    return () => {
      active = false;
    };
  }, []);

  // 3. Subscribe to current user's sessions, weak-points bank & comparative tables
  useEffect(() => {
    if (!currentUser) {
      setSessions([]);
      setWeakPointsBank([]);
      setComparativeTables([]);
      setActiveSessionId(null);
      setActiveComparativeModalId(null);
      setLibrarySelectedEntryId(null);
      setIsLoadingSessions(false);
      setShowMethodGuide(false);
      setIsTourOpen(false);
      setPendingExitAction(null);
      setSyncStatus('synced');
      return;
    }

    const usernameKey = currentUser.usernameKey;
    const pending = getPendingSyncQueue(usernameKey);
    const cachedSessions = mergeSessionsWithPending(
      getCachedSessions(usernameKey),
      pending
    );
    const cachedBank = getCachedWeakPoints(usernameKey);
    const cachedTables = mergeComparativeTablesWithPending(
      getCachedComparativeTables(usernameKey),
      pending
    );

    if (cachedSessions.length > 0) {
      setSessions(cachedSessions);
    }
    if (cachedBank.length > 0) {
      setWeakPointsBank(cachedBank);
    }
    if (cachedTables.length > 0) {
      setComparativeTables(cachedTables);
    }

    setIsLoadingSessions(cachedSessions.length === 0);

    if (hasPendingSyncItems(usernameKey)) {
      flushPendingSync(usernameKey);
    }

    const unsubSessions = subscribeUserSessions(
      usernameKey,
      (cloudSessions) => {
        const pendingQueue = getPendingSyncQueue(usernameKey);
        const merged = mergeSessionsWithPending(cloudSessions, pendingQueue);
        setSessions(merged);
        setCachedSessions(usernameKey, merged);
        setIsLoadingSessions(false);
        if (!hasPendingSyncItems(usernameKey)) {
          setSyncStatus('synced');
        }
      },
      () => {
        setIsLoadingSessions(false);
        setSyncStatus('offline_saved');
      }
    );

    const unsubWeakPoints = subscribeUserWeakPoints(
      usernameKey,
      (entries) => {
        const pendingQueue = getPendingSyncQueue(usernameKey);
        const deletedIds = new Set(pendingQueue.weakPointDeletes);
        const toggledMap = new Map(pendingQueue.weakPointToggles.map((e) => [e.id, e]));
        const causeMap = new Map(
          pendingQueue.weakPointCauseUpdates.map((c) => [c.weakPointId, c])
        );
        const merged = entries
          .filter((entry) => !deletedIds.has(entry.id))
          .map((entry) => {
            const toggled = toggledMap.get(entry.id) ?? entry;
            const pendingCause = causeMap.get(entry.id);
            return pendingCause
              ? { ...toggled, lastErrorCause: pendingCause.cause }
              : toggled;
          });
        setWeakPointsBank(merged);
        setCachedWeakPoints(usernameKey, merged);
      },
      () => {
        setSyncStatus('offline_saved');
      }
    );

    const unsubComparativeTables = subscribeUserComparativeTables(
      usernameKey,
      (cloudTables) => {
        const pendingQueue = getPendingSyncQueue(usernameKey);
        const merged = mergeComparativeTablesWithPending(cloudTables, pendingQueue);
        setComparativeTables(merged);
        setCachedComparativeTables(usernameKey, merged);
      },
      () => {
        setSyncStatus('offline_saved');
      }
    );

    const handleOnline = () => {
      flushPendingSync(usernameKey);
    };
    window.addEventListener('online', handleOnline);

    return () => {
      unsubSessions();
      unsubWeakPoints();
      unsubComparativeTables();
      window.removeEventListener('online', handleOnline);
    };
  }, [currentUser?.usernameKey, flushPendingSync]);

  // Cleanup any pending draft timer on unmount or user switch
  useEffect(() => {
    return () => {
      if (draftSyncTimerRef.current !== null) {
        window.clearTimeout(draftSyncTimerRef.current);
      }
    };
  }, [currentUser?.usernameKey]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;
  const isFocusMode = Boolean(currentUser && route === 'trainer' && activeSession);
  const isActiveUncompletedSession = Boolean(
    isFocusMode && activeSession && activeSession.status !== 'completed'
  );

  const persistSessionUpdate = useCallback(
    async (usernameKey: string, updated: TrainingSession, isNew = false): Promise<void> => {
      setCachedSessions(
        usernameKey,
        (() => {
          const prev = getCachedSessions(usernameKey);
          const exists = prev.some((s) => s.id === updated.id);
          return exists
            ? prev.map((s) => (s.id === updated.id ? updated : s))
            : [updated, ...prev];
        })()
      );

      setSyncStatus('syncing');
      try {
        if (isNew) {
          await createCloudSession(usernameKey, updated);
        } else {
          await updateCloudSession(usernameKey, updated);
        }
        if (!hasPendingSyncItems(usernameKey)) {
          setSyncStatus('synced');
        }
      } catch {
        if (isNew) {
          enqueueSessionCreate(usernameKey, updated);
        } else {
          enqueueSessionUpdate(usernameKey, updated);
        }
        setSyncStatus('offline_saved');
      }
    },
    []
  );

  const flushPendingDraftNow = useCallback(() => {
    if (draftSyncTimerRef.current !== null) {
      window.clearTimeout(draftSyncTimerRef.current);
      draftSyncTimerRef.current = null;
    }
    if (latestDraftRef.current) {
      const { usernameKey, session } = latestDraftRef.current;
      latestDraftRef.current = null;
      void persistSessionUpdate(usernameKey, session, false);
    }
  }, [persistSessionUpdate]);

  const executeWithExitGuard = (action: () => void) => {
    if (isActiveUncompletedSession) {
      setPendingExitAction(() => action);
      return;
    }
    action();
  };

  const handleAuthenticate = async (
    usernameKey: string,
    displayName: string,
    createIfMissing: boolean
  ): Promise<'needs_create' | 'ok'> => {
    setAuthError(null);
    setIsAuthenticating(true);
    try {
      const existing = await getUserProfile(usernameKey);
      if (existing) {
        await touchUserProfile(existing.usernameKey, existing.displayName);
        setCachedUserProfile(existing);
        setStoredUsername(existing.usernameKey);
        setCurrentUser(existing);
        setPendingScope(null);
        setActiveSessionId(null);
        setRoute('trainer');
        return 'ok';
      }

      if (!createIfMissing) {
        return 'needs_create';
      }

      const created = await createUserProfile(usernameKey, displayName);
      setCachedUserProfile(created);
      setStoredUsername(created.usernameKey);
      setCurrentUser(created);
      setPendingScope(null);
      setActiveSessionId(null);
      setRoute('trainer');
      return 'ok';
    } catch (error) {
      const cached = getCachedUserProfile(usernameKey);
      if (cached) {
        setStoredUsername(cached.usernameKey);
        setCurrentUser(cached);
        setPendingScope(null);
        setActiveSessionId(null);
        setRoute('trainer');
        setSyncStatus('offline_saved');
        return 'ok';
      }
      setAuthError(
        error instanceof Error
          ? error.message
          : 'Não foi possível acessar seu perfil agora. Tente novamente.'
      );
      return 'ok';
    } finally {
      setIsAuthenticating(false);
    }
  };

  const persistOnboardingCompleted = () => {
    if (!currentUser || currentUser.onboardingCompleted) return;
    const now = new Date().toISOString();
    const updatedUser: UserProfile = {
      ...currentUser,
      onboardingCompleted: true,
      onboardingCompletedAt: now,
    };
    setCurrentUser(updatedUser);
    setCachedUserProfile(updatedUser);

    markUserOnboardingCompleted(currentUser.usernameKey).catch(() => {
      enqueueOnboardingCompleted(currentUser.usernameKey);
      setSyncStatus('offline_saved');
    });
  };

  const handleOpenMethodGuide = () => {
    setErrorMessage(null);
    setIsTourOpen(false);
    setShowMethodGuide(true);
  };

  const handleStartTour = () => {
    setErrorMessage(null);
    setShowMethodGuide(false);
    setPendingScope(null);
    setActiveSessionId(null);
    setRoute('trainer');
    setIsTourOpen(true);
  };

  const handleFinishTour = () => {
    setIsTourOpen(false);
    persistOnboardingCompleted();
  };

  const handleNavigate = (nextRoute: AppRoute) => {
    if (nextRoute === route) return;
    executeWithExitGuard(() => {
      setShowMethodGuide(false);
      setRoute(nextRoute);
    });
  };

  const handleSwitchUser = () => {
    executeWithExitGuard(() => {
      flushPendingDraftNow();
      setStoredUsername(null);
      setCurrentUser(null);
      setSessions([]);
      setWeakPointsBank([]);
      setActiveSessionId(null);
      setPendingScope(null);
      setErrorMessage(null);
      setAuthError(null);
      setShowMethodGuide(false);
      setIsTourOpen(false);
      setRoute('trainer');
    });
  };

  const handleStartNewTraining = () => {
    executeWithExitGuard(() => {
      setErrorMessage(null);
      setShowMethodGuide(false);
      setPendingScope(null);
      setActiveSessionId(null);
      setRoute('trainer');
    });
  };

  const handleExitFocusSession = () => {
    executeWithExitGuard(() => {
      setErrorMessage(null);
      setActiveSessionId(null);
      setPendingScope(null);
      setRoute('history');
    });
  };

  const handleConfirmScope = (
    sourceType: SourceType,
    sourceContent: string,
    selectedKbPaths: string[]
  ) => {
    setErrorMessage(null);
    setPendingScope({ sourceType, sourceContent, selectedKbPaths });
  };

  const scheduleCloudDraftSave = (usernameKey: string, updated: TrainingSession) => {
    latestDraftRef.current = { usernameKey, session: updated };
    setCachedSessions(
      usernameKey,
      (() => {
        const prev = getCachedSessions(usernameKey);
        return prev.map((s) => (s.id === updated.id ? updated : s));
      })()
    );

    if (draftSyncTimerRef.current !== null) {
      window.clearTimeout(draftSyncTimerRef.current);
    }
    draftSyncTimerRef.current = window.setTimeout(() => {
      latestDraftRef.current = null;
      void persistSessionUpdate(usernameKey, updated, false);
    }, 900);
  };

  const applyLocalOptimistic = (updated: TrainingSession) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === updated.id ? updated : s))
    );
  };

  const handleChoosePath = async (wantsPrepClass: boolean) => {
    if (!pendingScope || !currentUser) return;
    setErrorMessage(null);
    setIsInitializing(true);

    try {
      const initData = await initTrainerSession({
        sourceType: pendingScope.sourceType,
        sourceContent: pendingScope.sourceContent,
        selectedKbPaths: pendingScope.selectedKbPaths,
        wantsPrepClass,
        disciplineHint: pendingScope.disciplineHint,
      });

      const initialSources = mergeKbSources([], initData.kbSources);
      const now = new Date().toISOString();
      const baseSession: TrainingSession = {
        id: `sess_${Date.now()}`,
        ownerUsername: currentUser.usernameKey,
        title: initData.title,
        discipline: initData.discipline,
        sourceType: pendingScope.sourceType,
        sourceContent: pendingScope.sourceContent,
        selectedKbPaths: pendingScope.selectedKbPaths,
        kbSources: initialSources,
        status: wantsPrepClass ? 'prep_class' : 'in_progress',
        wantsPrepClass,
        currentRound: 1,
        syllabus: initData.syllabus,
        prepClass: initData.prepClass,
        rounds: [],
        activeWeakPoints: [],
        strategicSyntheses: [],
        finalSynthesis: null,
        createdAt: now,
        updatedAt: now,
      };

      if (wantsPrepClass) {
        setSessions((prev) => [baseSession, ...prev]);
        setActiveSessionId(baseSession.id);
        setPendingScope(null);
        await persistSessionUpdate(currentUser.usernameKey, baseSession, true);
      } else {
        const round1 = await generateRound({
          title: baseSession.title,
          sourceType: baseSession.sourceType,
          sourceContent: baseSession.sourceContent,
          selectedKbPaths: baseSession.selectedKbPaths,
          currentRound: 1,
          isOvertime: false,
          syllabus: baseSession.syllabus,
          activeWeakPoints: [],
          recentRounds: [],
        });

        const firstRoundRecord: RoundRecord = {
          roundNumber: 1,
          isOvertime: false,
          difficultyLabel: round1.difficultyLabel,
          questions: round1.questions,
          evaluations: [],
        };

        const fullSession: TrainingSession = {
          ...baseSession,
          kbSources: mergeKbSources(baseSession.kbSources, round1.kbSources),
          rounds: [firstRoundRecord],
          syllabus: baseSession.syllabus.map((s) =>
            s.roundNumber === 1 ? { ...s, covered: true } : s
          ),
        };

        setSessions((prev) => [fullSession, ...prev]);
        setActiveSessionId(fullSession.id);
        setPendingScope(null);
        await persistSessionUpdate(currentUser.usernameKey, fullSession, true);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Erro ao inicializar o treino.'
      );
    } finally {
      setIsInitializing(false);
    }
  };

  const handleStartRoundOneFromPrep = async () => {
    if (!activeSession || !currentUser) return;
    setErrorMessage(null);
    setIsGeneratingRound(true);

    try {
      const round1 = await generateRound({
        title: activeSession.title,
        sourceType: activeSession.sourceType,
        sourceContent: activeSession.sourceContent,
        selectedKbPaths: activeSession.selectedKbPaths,
        currentRound: 1,
        isOvertime: false,
        syllabus: activeSession.syllabus,
        activeWeakPoints: activeSession.activeWeakPoints,
        recentRounds: [],
      });

      const firstRoundRecord: RoundRecord = {
        roundNumber: 1,
        isOvertime: false,
        difficultyLabel: round1.difficultyLabel,
        questions: round1.questions,
        evaluations: [],
      };

      const updated: TrainingSession = {
        ...activeSession,
        kbSources: mergeKbSources(activeSession.kbSources, round1.kbSources),
        status: 'in_progress',
        currentRound: 1,
        rounds: [firstRoundRecord],
        syllabus: activeSession.syllabus.map((s) =>
          s.roundNumber === 1 ? { ...s, covered: true } : s
        ),
        updatedAt: new Date().toISOString(),
      };

      applyLocalOptimistic(updated);
      await persistSessionUpdate(currentUser.usernameKey, updated, false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Erro ao gerar a Rodada 1.'
      );
    } finally {
      setIsGeneratingRound(false);
    }
  };

  const handleChangeAnswer = (
    roundNumber: number,
    questionId: string,
    value: string
  ) => {
    if (!activeSession || !currentUser) return;
    const updated: TrainingSession = {
      ...activeSession,
      rounds: activeSession.rounds.map((round) =>
        round.roundNumber !== roundNumber
          ? round
          : {
              ...round,
              questions: round.questions.map((q) =>
                q.id === questionId ? { ...q, userAnswer: value } : q
              ),
            }
      ),
      updatedAt: new Date().toISOString(),
    };

    applyLocalOptimistic(updated);
    scheduleCloudDraftSave(currentUser.usernameKey, updated);
  };

  const handleChangeRationale = (
    roundNumber: number,
    questionId: string,
    value: string
  ) => {
    if (!activeSession || !currentUser) return;
    const updated: TrainingSession = {
      ...activeSession,
      rounds: activeSession.rounds.map((round) =>
        round.roundNumber !== roundNumber
          ? round
          : {
              ...round,
              questions: round.questions.map((q) =>
                q.id === questionId ? { ...q, userRationale: value } : q
              ),
            }
      ),
      updatedAt: new Date().toISOString(),
    };

    applyLocalOptimistic(updated);
    scheduleCloudDraftSave(currentUser.usernameKey, updated);
  };

  const handleSelectOption = (
    roundNumber: number,
    questionId: string,
    option: OptionLetter
  ) => {
    if (!activeSession || !currentUser) return;
    const updated: TrainingSession = {
      ...activeSession,
      rounds: activeSession.rounds.map((round) =>
        round.roundNumber !== roundNumber
          ? round
          : {
              ...round,
              questions: round.questions.map((q) =>
                q.id === questionId
                  ? { ...q, userSelectedOption: option, userAnswer: option }
                  : q
              ),
            }
      ),
      updatedAt: new Date().toISOString(),
    };

    applyLocalOptimistic(updated);
    scheduleCloudDraftSave(currentUser.usernameKey, updated);
  };

  const handleSelectConfidence = (
    roundNumber: number,
    questionId: string,
    confidence: ConfidenceLevel
  ) => {
    if (!activeSession || !currentUser) return;
    const updated: TrainingSession = {
      ...activeSession,
      rounds: activeSession.rounds.map((round) =>
        round.roundNumber !== roundNumber
          ? round
          : {
              ...round,
              questions: round.questions.map((q) =>
                q.id === questionId ? { ...q, confidence } : q
              ),
            }
      ),
      updatedAt: new Date().toISOString(),
    };

    applyLocalOptimistic(updated);
    scheduleCloudDraftSave(currentUser.usernameKey, updated);
  };

  const handleSelectErrorCause = async (
    roundNumber: number,
    questionId: string,
    cause: ErrorCause
  ) => {
    if (!activeSession || !currentUser) return;
    const usernameKey = currentUser.usernameKey;

    const targetRound = activeSession.rounds.find(
      (r) => r.roundNumber === roundNumber
    );
    const targetQuestion = targetRound?.questions.find((q) => q.id === questionId);
    const existingEval = targetRound?.evaluations.find(
      (e) => e.questionId === questionId
    );
    const previousCause = existingEval?.errorCause || '';

    const updated: TrainingSession = {
      ...activeSession,
      rounds: activeSession.rounds.map((round) =>
        round.roundNumber !== roundNumber
          ? round
          : {
              ...round,
              evaluations: round.evaluations.map((ev) =>
                ev.questionId === questionId ? { ...ev, errorCause: cause } : ev
              ),
            }
      ),
      updatedAt: new Date().toISOString(),
    };

    applyLocalOptimistic(updated);
    await persistSessionUpdate(usernameKey, updated, false);

    if (targetQuestion) {
      const discipline = resolveSessionDiscipline(updated);
      const concept = (targetQuestion.targetConcept || targetQuestion.subtopic || '').trim();
      let updatedBankSnapshot = weakPointsBank;

      if (concept) {
        const wpId = makeWeakPointBankId(discipline, concept);
        const existingBankItem =
          weakPointsBank.find((item) => item.id === wpId) ||
          weakPointsBank.find(
            (item) =>
              item.discipline.trim().toLowerCase() === discipline.toLowerCase() &&
              item.concept.trim().toLowerCase() === concept.toLowerCase()
          );

        if (existingBankItem) {
          const nextCounts: Partial<Record<ErrorCause, number>> = {
            ...(existingBankItem.errorCauseCounts || {}),
          };
          if (
            previousCause &&
            previousCause !== cause &&
            (nextCounts[previousCause] || 0) > 0
          ) {
            nextCounts[previousCause] = Math.max(
              0,
              (nextCounts[previousCause] || 0) - 1
            );
          }
          if (previousCause !== cause) {
            nextCounts[cause] = (nextCounts[cause] || 0) + 1;
          }

          updatedBankSnapshot = weakPointsBank.map((item) =>
            item.id === existingBankItem.id
              ? {
                  ...item,
                  lastErrorCause: cause,
                  errorCauseCounts: nextCounts,
                  updatedAt: new Date().toISOString(),
                }
              : item
          );

          setWeakPointsBank(updatedBankSnapshot);
          setCachedWeakPoints(usernameKey, updatedBankSnapshot);

          try {
            await updateWeakPointErrorCause({
              usernameKey,
              weakPointId: existingBankItem.id,
              cause,
              previousCause,
              existingCounts: existingBankItem.errorCauseCounts,
            });
          } catch {
            enqueueWeakPointCauseUpdate(usernameKey, {
              weakPointId: existingBankItem.id,
              cause,
              previousCause,
              existingCounts: existingBankItem.errorCauseCounts,
            });
            setSyncStatus('offline_saved');
          }
        }
      }

      if (cause === 'concept_confusion' && previousCause !== 'concept_confusion') {
        const nextSessionsSnapshot = sessions.map((s) =>
          s.id === updated.id ? updated : s
        );
        const merged = buildMergedWeakPointBank(
          usernameKey,
          updatedBankSnapshot,
          nextSessionsSnapshot
        );
        const diag = computeDiagnosticAnalytics({
          sessions: nextSessionsSnapshot,
          mergedBank: merged,
          comparativeTables,
          disciplineFilter: discipline,
        });
        const autoPair = diag.confusionPairs.find(
          (p) => p.reason === 'repeated_confusion_tags' && !p.existingTableId
        );
        if (autoPair) {
          void handleGenerateAndOpenComparativeTable({
            discipline: autoPair.discipline,
            conceptA: autoPair.conceptA,
            conceptB: autoPair.conceptB,
            triggerReason: 'auto_confusion',
            sourceSessionId: updated.id,
            questionId: targetQuestion.id,
          });
        }
      }
    }
  };

  const handleSubmitRound = async () => {
    if (!activeSession || !currentUser) return;
    const activeRound = activeSession.rounds[activeSession.rounds.length - 1];
    if (!activeRound) return;

    if (draftSyncTimerRef.current !== null) {
      window.clearTimeout(draftSyncTimerRef.current);
      draftSyncTimerRef.current = null;
    }
    latestDraftRef.current = null;

    setErrorMessage(null);
    setIsEvaluating(true);

    try {
      const evalResult = await evaluateRound({
        title: activeSession.title,
        sourceContent: activeSession.sourceContent,
        selectedKbPaths: activeSession.selectedKbPaths,
        roundNumber: activeRound.roundNumber,
        isOvertime: activeRound.isOvertime,
        questions: activeRound.questions,
      });

      const updatedWeakPoints: WeakPoint[] = [...activeSession.activeWeakPoints];

      for (const question of activeRound.questions) {
        const ev = evalResult.evaluations.find(
          (e) => e.questionId === question.id
        );
        if (!ev) continue;

        const normalizedConcept = question.targetConcept.trim().toLowerCase();
        const existingIdx = updatedWeakPoints.findIndex(
          (wp) =>
            !wp.resolved &&
            wp.concept.trim().toLowerCase() === normalizedConcept
        );

        const isLuckyGuess = Boolean(ev.isLuckyGuess);
        const triggersInSessionWeakPoint = ev.verdict !== 'correct' || isLuckyGuess;

        if (!triggersInSessionWeakPoint) {
          if (existingIdx >= 0 && question.isRetest) {
            updatedWeakPoints[existingIdx] = {
              ...updatedWeakPoints[existingIdx],
              resolved: true,
              lastTestedRound: activeRound.roundNumber,
            };
          }
        } else {
          if (existingIdx >= 0) {
            updatedWeakPoints[existingIdx] = {
              ...updatedWeakPoints[existingIdx],
              lastTestedRound: activeRound.roundNumber,
              retestCount: updatedWeakPoints[existingIdx].retestCount + 1,
              definition:
                ev.conceptDefinition || updatedWeakPoints[existingIdx].definition,
            };
          } else {
            updatedWeakPoints.push({
              id: `wp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              concept: question.targetConcept,
              definition: ev.conceptDefinition,
              missedInRound: activeRound.roundNumber,
              lastTestedRound: activeRound.roundNumber,
              retestCount: 0,
              resolved: false,
            });
          }
        }
      }

      const updatedRounds = activeSession.rounds.map((r, idx) =>
        idx === activeSession.rounds.length - 1
          ? {
              ...r,
              evaluations: evalResult.evaluations,
              roundSummary: evalResult.roundSummary,
              submittedAt: new Date().toISOString(),
            }
          : r
      );

      const updated: TrainingSession = {
        ...activeSession,
        rounds: updatedRounds,
        activeWeakPoints: updatedWeakPoints,
        updatedAt: new Date().toISOString(),
      };

      applyLocalOptimistic(updated);
      await persistSessionUpdate(currentUser.usernameKey, updated, false);

      try {
        await syncRoundWeakPointsToBank({
          usernameKey: currentUser.usernameKey,
          session: updated,
          questions: activeRound.questions,
          evaluations: evalResult.evaluations,
          existingBank: weakPointsBank,
        });
      } catch {
        // Fallback: preserve weak point entries locally if offline
        const discipline = resolveSessionDiscipline(updated);
        const now = new Date().toISOString();
        setWeakPointsBank((prev) => {
          const next = [...prev];
          for (const question of activeRound.questions) {
            const ev = evalResult.evaluations.find((item) => item.questionId === question.id);
            if (!ev) continue;
            const concept = (question.targetConcept || question.subtopic || 'Conceito').trim();
            if (!concept) continue;
            const wpId = makeWeakPointBankId(discipline, concept);
            const conf = ev.confidenceAtSubmit ?? question.confidence ?? 'certain';
            const isError = ev.verdict === 'incorrect' || ev.verdict === 'partial';
            const isLuckyGuess = ev.verdict === 'correct' && conf === 'guess';
            const isUnsureHit = ev.verdict === 'correct' && conf === 'unsure';
            if (isError || isLuckyGuess || isUnsureHit) {
              const idx = next.findIndex((item) => item.id === wpId);
              const entry: WeakPointBankEntry = {
                id: wpId,
                ownerUsername: currentUser.usernameKey,
                discipline,
                concept,
                definition: ev.conceptDefinition || next[idx]?.definition || '',
                subtopic: question.subtopic || next[idx]?.subtopic || '',
                sourceSessionId: updated.id,
                sourceSessionTitle: updated.title,
                status: 'active',
                lastTrigger:
                  ev.verdict === 'incorrect'
                    ? 'incorrect'
                    : ev.verdict === 'partial'
                      ? 'partial'
                      : isLuckyGuess
                        ? 'lucky_guess'
                        : 'unsure_hit',
                errorCount: (next[idx]?.errorCount || 0) + (isError ? 1 : 0),
                guessCount: (next[idx]?.guessCount || 0) + (isLuckyGuess || isUnsureHit ? 1 : 0),
                retestSuccessCount: next[idx]?.retestSuccessCount || 0,
                createdAt: next[idx]?.createdAt || now,
                updatedAt: now,
              };
              if (idx >= 0) next[idx] = entry;
              else next.unshift(entry);
            }
          }
          setCachedWeakPoints(currentUser.usernameKey, next);
          return next;
        });
        setSyncStatus('offline_saved');
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Erro ao avaliar respostas.'
      );
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleFinalizeSession = async (sessionToFinalize = activeSession) => {
    if (!sessionToFinalize || !currentUser) return;
    setErrorMessage(null);
    setIsFinalizing(true);

    try {
      const result = await finalizeTrainerSession({
        title: sessionToFinalize.title,
        sourceContent: sessionToFinalize.sourceContent,
        selectedKbPaths: sessionToFinalize.selectedKbPaths,
        syllabus: sessionToFinalize.syllabus,
        rounds: sessionToFinalize.rounds,
        activeWeakPoints: sessionToFinalize.activeWeakPoints,
      });

      const coveredTopics = new Set<string>();
      for (const r of sessionToFinalize.rounds) {
        if (r.evaluations.length > 0) {
          for (const q of r.questions) {
            coveredTopics.add(q.subtopic);
          }
        }
      }

      const masteredCount = sessionToFinalize.activeWeakPoints.filter(
        (wp) => wp.resolved
      ).length;

      const updated: TrainingSession = {
        ...sessionToFinalize,
        status: 'completed',
        finalSynthesis: {
          asciiTree: result.asciiTree,
          closingFeedback: result.closingFeedback,
          topicsCoveredCount: Math.max(coveredTopics.size, 1),
          masteredWeakPointsCount: masteredCount,
          generatedAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      };

      applyLocalOptimistic(updated);
      await persistSessionUpdate(currentUser.usernameKey, updated, false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Erro ao gerar a árvore final.'
      );
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleAdvanceRound = async () => {
    if (!activeSession || !currentUser) return;
    const activeRound = activeSession.rounds[activeSession.rounds.length - 1];
    if (!activeRound) return;

    const roundErrorsCount = activeRound.evaluations.filter(
      (e) => e.verdict !== 'correct' || e.weakPointTriggered
    ).length;
    const unresolvedWeakPointsCount = activeSession.activeWeakPoints.filter(
      (wp) => !wp.resolved
    ).length;

    if (!activeRound.isOvertime && activeRound.roundNumber === 10) {
      if (roundErrorsCount <= 1) {
        await handleFinalizeSession(activeSession);
        return;
      }
    }

    if (activeRound.isOvertime) {
      if (roundErrorsCount === 0 || unresolvedWeakPointsCount === 0) {
        await handleFinalizeSession(activeSession);
        return;
      }
    }

    const nextRoundNumber = activeRound.roundNumber + 1;
    const nextIsOvertime = activeRound.isOvertime || activeRound.roundNumber >= 10;

    setErrorMessage(null);
    setIsGeneratingRound(true);

    try {
      const nextRoundData = await generateRound({
        title: activeSession.title,
        sourceType: activeSession.sourceType,
        sourceContent: activeSession.sourceContent,
        selectedKbPaths: activeSession.selectedKbPaths,
        currentRound: nextRoundNumber,
        isOvertime: nextIsOvertime,
        syllabus: activeSession.syllabus,
        activeWeakPoints: activeSession.activeWeakPoints,
        recentRounds: activeSession.rounds,
      });

      const nextRoundRecord: RoundRecord = {
        roundNumber: nextRoundNumber,
        isOvertime: nextIsOvertime,
        difficultyLabel: nextRoundData.difficultyLabel,
        questions: nextRoundData.questions,
        evaluations: [],
      };

      const updatedSyntheses = nextRoundData.strategicSynthesis
        ? [...activeSession.strategicSyntheses, nextRoundData.strategicSynthesis]
        : activeSession.strategicSyntheses;

      const updated: TrainingSession = {
        ...activeSession,
        kbSources: mergeKbSources(activeSession.kbSources, nextRoundData.kbSources),
        status: nextIsOvertime ? 'overtime' : 'in_progress',
        currentRound: nextRoundNumber,
        rounds: [...activeSession.rounds, nextRoundRecord],
        strategicSyntheses: updatedSyntheses,
        syllabus: activeSession.syllabus.map((s) =>
          s.roundNumber === nextRoundNumber ? { ...s, covered: true } : s
        ),
        updatedAt: new Date().toISOString(),
      };

      applyLocalOptimistic(updated);
      await persistSessionUpdate(currentUser.usernameKey, updated, false);

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Erro ao gerar a próxima rodada.'
      );
    } finally {
      setIsGeneratingRound(false);
    }
  };

  const handleResumeSession = (sessionId: string) => {
    setErrorMessage(null);
    setPendingScope(null);
    setActiveSessionId(sessionId);
    setRoute('trainer');
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!currentUser) return;
    const usernameKey = currentUser.usernameKey;

    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== sessionId);
      setCachedSessions(usernameKey, next);
      return next;
    });
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
    }

    try {
      await deleteCloudSession(usernameKey, sessionId);
      if (!hasPendingSyncItems(usernameKey)) {
        setSyncStatus('synced');
      }
    } catch {
      enqueueSessionDelete(usernameKey, sessionId);
      setSyncStatus('offline_saved');
    }
  };

  const handleRetrainTopic = (topic: string) => {
    setErrorMessage(null);
    setActiveSessionId(null);
    setPendingScope({ sourceType: 'topic', sourceContent: topic, selectedKbPaths: [] });
    setRoute('trainer');
  };

  const handleStartWeakPointsTraining = (
    discipline: string,
    items: MergedWeakPointItem[]
  ) => {
    if (items.length === 0) return;
    const summaryLines = items
      .map(
        (item, idx) =>
          `${idx + 1}. ${item.concept}${item.definition ? ` — ${item.definition}` : ''}`
      )
      .join('\n');
    const promptContent = `Disciplina: ${discipline}\nTreino sob demanda focado exclusivamente em consolidar os seguintes pontos fracos e acertos por chute registrados no banco do aluno:\n${summaryLines}`.slice(
      0,
      19000
    );

    setErrorMessage(null);
    setActiveSessionId(null);
    setPendingScope({
      sourceType: 'weak_points',
      sourceContent: promptContent,
      selectedKbPaths: [],
      disciplineHint: discipline,
    });
    setRoute('trainer');
  };

  const handleLaunchSurgicalTraining = async (
    disciplineFilter: string,
    worstItems: WorstTopicRankItem[]
  ) => {
    if (!currentUser || worstItems.length === 0) return;
    const usernameKey = currentUser.usernameKey;
    const targetDiscipline =
      disciplineFilter ||
      worstItems[0]?.discipline ||
      'Revisão Cirúrgica de Pontos Fracos';

    const prioritized = worstItems.slice(0, 6);
    const focusLabel = `Treino cirúrgico: ${prioritized.length} ponto${
      prioritized.length > 1 ? 's' : ''
    } fraco${prioritized.length > 1 ? 's' : ''} priorizado${
      prioritized.length > 1 ? 's' : ''
    }`;

    const summaryLines = prioritized
      .map(
        (item, idx) =>
          `${idx + 1}. [${item.discipline}] ${item.concept} (${item.errorCount} erro(s), ${item.guessCount} chute(s))${
            item.definition ? ` — ${item.definition}` : ''
          }`
      )
      .join('\n');

    const sourceContent = `Disciplina foco: ${targetDiscipline}\nTreino cirúrgico direto focado exclusivamente em eliminar as regras e tópicos com maior incidência de falha e chutes do estudante:\n${summaryLines}`.slice(
      0,
      19000
    );

    setErrorMessage(null);
    setIsLaunchingSurgical(true);

    try {
      const initData = await initTrainerSession({
        sourceType: 'weak_points',
        sourceContent,
        selectedKbPaths: [],
        wantsPrepClass: false,
        disciplineHint: targetDiscipline,
      });

      const initialSources = mergeKbSources([], initData.kbSources);
      const now = new Date().toISOString();
      const baseSession: TrainingSession = {
        id: `sess_${Date.now()}`,
        ownerUsername: usernameKey,
        title: initData.title,
        discipline: initData.discipline || targetDiscipline,
        sourceType: 'weak_points',
        sourceContent,
        selectedKbPaths: [],
        kbSources: initialSources,
        status: 'in_progress',
        wantsPrepClass: false,
        currentRound: 1,
        syllabus: initData.syllabus,
        prepClass: null,
        rounds: [],
        activeWeakPoints: [],
        strategicSyntheses: [],
        finalSynthesis: null,
        surgicalFocus: {
          label: focusLabel,
          targetedConcepts: prioritized.map((p) => p.concept),
          discipline: disciplineFilter || undefined,
        },
        createdAt: now,
        updatedAt: now,
      };

      const round1 = await generateRound({
        title: baseSession.title,
        sourceType: 'weak_points',
        sourceContent: baseSession.sourceContent,
        selectedKbPaths: [],
        currentRound: 1,
        isOvertime: false,
        syllabus: baseSession.syllabus,
        activeWeakPoints: [],
        recentRounds: [],
      });

      const firstRoundRecord: RoundRecord = {
        roundNumber: 1,
        isOvertime: false,
        difficultyLabel: round1.difficultyLabel,
        questions: round1.questions,
        evaluations: [],
      };

      const fullSession: TrainingSession = {
        ...baseSession,
        kbSources: mergeKbSources(baseSession.kbSources, round1.kbSources),
        rounds: [firstRoundRecord],
        syllabus: baseSession.syllabus.map((s) =>
          s.roundNumber === 1 ? { ...s, covered: true } : s
        ),
      };

      setSessions((prev) => [fullSession, ...prev]);
      setActiveSessionId(fullSession.id);
      setPendingScope(null);
      setRoute('trainer');
      await persistSessionUpdate(usernameKey, fullSession, true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível iniciar o treino cirúrgico agora.'
      );
    } finally {
      setIsLaunchingSurgical(false);
    }
  };

  const handleGenerateAndOpenComparativeTable = async (params: {
    discipline: string;
    conceptA: string;
    conceptB?: string;
    triggerReason: 'auto_confusion' | 'on_demand';
    contextNotes?: string;
    sourceSessionId?: string;
    questionId?: string;
    trackingKey?: string;
  }) => {
    if (!currentUser) return;
    const usernameKey = currentUser.usernameKey;

    const existing = comparativeTables.find((ct) => {
      const sameDisc = ct.discipline.toLowerCase() === params.discipline.toLowerCase();
      if (!sameDisc) return false;
      const a = ct.conceptA.toLowerCase();
      const b = ct.conceptB.toLowerCase();
      const targetA = params.conceptA.toLowerCase();
      if (!params.conceptB) {
        return a === targetA || b === targetA;
      }
      const targetB = params.conceptB.toLowerCase();
      return (a === targetA && b === targetB) || (a === targetB && b === targetA);
    });

    if (existing) {
      setActiveComparativeModalId(existing.id);
      return;
    }

    if (params.questionId) {
      setGeneratingComparativeQuestionId(params.questionId);
    }
    if (params.trackingKey) {
      setGeneratingComparativeProgressKey(params.trackingKey);
    }

    try {
      const generated = await generateComparativeTable({
        discipline: params.discipline,
        conceptA: params.conceptA,
        conceptB: params.conceptB,
        contextNotes: params.contextNotes,
      });

      const now = new Date().toISOString();
      const newTable: ComparativeTableEntry = {
        id: `cmp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        ownerUsername: usernameKey,
        discipline: params.discipline || 'Conhecimentos Gerais',
        title: generated.title,
        conceptA: generated.conceptA,
        conceptB: generated.conceptB,
        triggerReason: params.triggerReason,
        rows: generated.rows,
        summaryTip: generated.summaryTip,
        sourceSessionId: params.sourceSessionId,
        createdAt: now,
        updatedAt: now,
      };

      setComparativeTables((prev) => {
        const next = [newTable, ...prev];
        setCachedComparativeTables(usernameKey, next);
        return next;
      });
      setActiveComparativeModalId(newTable.id);

      try {
        await createCloudComparativeTable(usernameKey, newTable);
        if (!hasPendingSyncItems(usernameKey)) {
          setSyncStatus('synced');
        }
      } catch {
        enqueueComparativeTableCreate(usernameKey, newTable);
        setSyncStatus('offline_saved');
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível gerar o quadro comparativo agora.'
      );
    } finally {
      setGeneratingComparativeQuestionId(null);
      setGeneratingComparativeProgressKey(null);
    }
  };

  const handleDeleteComparativeTable = async (tableId: string) => {
    if (!currentUser) return;
    const usernameKey = currentUser.usernameKey;

    setComparativeTables((prev) => {
      const next = prev.filter((ct) => ct.id !== tableId);
      setCachedComparativeTables(usernameKey, next);
      return next;
    });
    if (activeComparativeModalId === tableId) {
      setActiveComparativeModalId(null);
    }

    try {
      await deleteCloudComparativeTable(usernameKey, tableId);
      if (!hasPendingSyncItems(usernameKey)) {
        setSyncStatus('synced');
      }
    } catch {
      enqueueComparativeTableDelete(usernameKey, tableId);
      setSyncStatus('offline_saved');
    }
  };

  const handleToggleWeakPointStatus = async (entry: MergedWeakPointItem) => {
    if (!currentUser || entry.isLegacyFromSession) return;
    const usernameKey = currentUser.usernameKey;
    const toggled: WeakPointBankEntry = {
      ...entry,
      status: entry.status === 'mastered' ? 'active' : 'mastered',
      retestSuccessCount:
        entry.status === 'active'
          ? Math.min(10000, entry.retestSuccessCount + 1)
          : entry.retestSuccessCount,
      updatedAt: new Date().toISOString(),
    };

    setWeakPointsBank((prev) => {
      const next = prev.map((item) => (item.id === entry.id ? toggled : item));
      setCachedWeakPoints(usernameKey, next);
      return next;
    });

    try {
      await toggleWeakPointStatus(usernameKey, entry);
      if (!hasPendingSyncItems(usernameKey)) {
        setSyncStatus('synced');
      }
    } catch {
      enqueueWeakPointToggle(usernameKey, toggled);
      setSyncStatus('offline_saved');
    }
  };

  const handleDeleteWeakPoint = async (entry: MergedWeakPointItem) => {
    if (!currentUser || entry.isLegacyFromSession) return;
    const usernameKey = currentUser.usernameKey;

    setWeakPointsBank((prev) => {
      const next = prev.filter((item) => item.id !== entry.id);
      setCachedWeakPoints(usernameKey, next);
      return next;
    });

    try {
      await deleteWeakPointBankEntry(usernameKey, entry.id);
      if (!hasPendingSyncItems(usernameKey)) {
        setSyncStatus('synced');
      }
    } catch {
      enqueueWeakPointDelete(usernameKey, entry.id);
      setSyncStatus('offline_saved');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] dark:bg-[#141312] text-[#18181B] dark:text-[#EFECE6] transition-colors">
      <TopBar
        activeRoute={route}
        onNavigate={handleNavigate}
        onNewTraining={handleStartNewTraining}
        hasActiveSession={Boolean(activeSession)}
        hasPendingScope={Boolean(pendingScope)}
      />

      <WorkspaceUtilityBar
        currentUser={currentUser}
        themeMode={themeMode}
        onChangeTheme={setThemeMode}
        onSwitchUser={handleSwitchUser}
        onOpenMethodGuide={handleOpenMethodGuide}
        isMethodGuideOpen={showMethodGuide}
        isFocusMode={isFocusMode}
        focusTitle={activeSession?.title}
        onExitFocusSession={handleExitFocusSession}
        syncStatus={syncStatus}
        onRetrySync={
          currentUser ? () => void flushPendingSync(currentUser.usernameKey) : undefined
        }
      />

      <main className="flex-1">
        {isBootingUser ? (
          <div className="max-w-[600px] mx-auto px-4 py-20 flex flex-col items-center justify-center gap-3 text-sm text-[#44403C] dark:text-[#C2BCB2]">
            <Loader2 className="w-5 h-5 animate-spin text-[#B45309] dark:text-[#F59E0B]" aria-hidden="true" />
            <span>Carregando sua conta...</span>
          </div>
        ) : !currentUser ? (
          <UsernameGateView
            onAuthenticate={handleAuthenticate}
            isLoading={isAuthenticating}
            errorMessage={authError}
          />
        ) : isLoadingSessions && sessions.length === 0 ? (
          <div className="max-w-[600px] mx-auto px-4 py-20 flex flex-col items-center justify-center gap-3 text-sm text-[#44403C] dark:text-[#C2BCB2]">
            <Loader2 className="w-5 h-5 animate-spin text-[#B45309] dark:text-[#F59E0B]" aria-hidden="true" />
            <span>Carregando seus treinos de {currentUser.usernameKey}...</span>
          </div>
        ) : route === 'progress' ? (
          <ProgressView
            usernameKey={currentUser.usernameKey}
            sessions={sessions}
            weakPointsBank={weakPointsBank}
            comparativeTables={comparativeTables}
            isLaunchingSurgical={isLaunchingSurgical}
            generatingComparativeKey={generatingComparativeProgressKey}
            onStartWeakPointsTraining={handleStartWeakPointsTraining}
            onLaunchSurgicalTraining={handleLaunchSurgicalTraining}
            onGenerateComparativeTable={(params) =>
              void handleGenerateAndOpenComparativeTable(params)
            }
            onOpenComparativeTableModal={(tableId) =>
              setActiveComparativeModalId(tableId)
            }
            onToggleWeakPointStatus={handleToggleWeakPointStatus}
            onDeleteWeakPoint={handleDeleteWeakPoint}
            onOpenSession={handleResumeSession}
            onStartNewTraining={handleStartNewTraining}
          />
        ) : route === 'library' ? (
          <SynthesisLibraryView
            usernameKey={currentUser.usernameKey}
            sessions={sessions}
            comparativeTables={comparativeTables}
            initialSelectedEntryId={librarySelectedEntryId}
            onDeleteComparativeTable={(tableId) =>
              void handleDeleteComparativeTable(tableId)
            }
            onRetrainTopic={handleRetrainTopic}
            onStartNewTraining={handleStartNewTraining}
          />
        ) : route === 'history' ? (
          <HistoryView
            usernameKey={currentUser.usernameKey}
            sessions={sessions}
            activeSessionId={activeSessionId}
            onResumeSession={handleResumeSession}
            onDeleteSession={handleDeleteSession}
            onStartNewTraining={handleStartNewTraining}
          />
        ) : !activeSession ? (
          <ScopeSetupView
            pendingScope={pendingScope}
            onConfirmScope={handleConfirmScope}
            onChoosePath={handleChoosePath}
            onResetScope={() => {
              setErrorMessage(null);
              setPendingScope(null);
            }}
            isLoading={isInitializing}
            errorMessage={errorMessage}
          />
        ) : activeSession.status === 'prep_class' ? (
          <PrepClassView
            session={activeSession}
            onStartRoundOne={handleStartRoundOneFromPrep}
            isLoading={isGeneratingRound}
            errorMessage={errorMessage}
          />
        ) : activeSession.status === 'completed' && activeSession.finalSynthesis ? (
          <FinalSynthesisView
            session={activeSession}
            onStartNewTraining={handleStartNewTraining}
            onOpenLibrary={() => setRoute('library')}
          />
        ) : (
          <TrainingWorkbench
            session={activeSession}
            sessionDiscipline={resolveSessionDiscipline(activeSession)}
            generatingComparativeQuestionId={generatingComparativeQuestionId}
            onChangeAnswer={handleChangeAnswer}
            onChangeRationale={handleChangeRationale}
            onSelectOption={handleSelectOption}
            onSelectConfidence={handleSelectConfidence}
            onSelectErrorCause={(roundNum, qId, cause) =>
              void handleSelectErrorCause(roundNum, qId, cause)
            }
            onRequestComparativeTable={(question: TrainerQuestion, evaluation: QuestionEvaluation) => {
              const disc = resolveSessionDiscipline(activeSession);
              void handleGenerateAndOpenComparativeTable({
                discipline: disc,
                conceptA: question.targetConcept || question.subtopic,
                triggerReason: 'on_demand',
                contextNotes: `${evaluation.conceptDefinition || ''} ${evaluation.expectedAnswer || ''}`.trim(),
                sourceSessionId: activeSession.id,
                questionId: question.id,
              });
            }}
            onSubmitRound={handleSubmitRound}
            onAdvanceRound={handleAdvanceRound}
            onFinishEarly={() => handleFinalizeSession(activeSession)}
            isSubmitting={isEvaluating}
            isAdvancing={isGeneratingRound}
            isFinalizing={isFinalizing}
            errorMessage={errorMessage}
          />
        )}
      </main>

      <ComparativeTableModal
        table={
          comparativeTables.find((t) => t.id === activeComparativeModalId) ?? null
        }
        onClose={() => setActiveComparativeModalId(null)}
        onOpenInLibrary={(entryId) => {
          setActiveComparativeModalId(null);
          setLibrarySelectedEntryId(entryId);
          setRoute('library');
        }}
      />

      <MethodGuideModal
        isOpen={showMethodGuide && Boolean(currentUser)}
        usernameKey={currentUser?.usernameKey}
        onClose={() => setShowMethodGuide(false)}
        onStartTour={handleStartTour}
      />

      <ConfirmExitModal
        isOpen={Boolean(pendingExitAction)}
        sessionTitle={activeSession?.title || 'Sessão atual'}
        onCancel={() => setPendingExitAction(null)}
        onConfirmExit={() => {
          flushPendingDraftNow();
          const act = pendingExitAction;
          setPendingExitAction(null);
          act?.();
        }}
      />

      <OnboardingTour
        isOpen={isTourOpen && Boolean(currentUser)}
        onComplete={handleFinishTour}
        onSkip={handleFinishTour}
      />
    </div>
  );
}
