/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
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
import {
  evaluateRound,
  finalizeTrainerSession,
  generateRound,
  initTrainerSession,
} from './lib/api';
import { testFirestoreConnection } from './lib/firebase';
import {
  createCloudSession,
  createUserProfile,
  deleteCloudSession,
  getUserProfile,
  subscribeUserSessions,
  touchUserProfile,
  updateCloudSession,
} from './lib/firestoreStore';
import {
  getStoredThemeMode,
  getStoredUsername,
  setStoredThemeMode,
  setStoredUsername,
} from './lib/storage';
import type {
  KbSourceRef,
  OptionLetter,
  RoundRecord,
  SourceType,
  ThemeMode,
  TrainingSession,
  UserProfile,
  WeakPoint,
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
      sourceLabel: String(src.sourceLabel || 'Base Git'),
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
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [route, setRoute] = useState<AppRoute>('trainer');
  const [pendingScope, setPendingScope] = useState<{
    sourceType: SourceType;
    sourceContent: string;
    selectedKbPaths: string[];
  } | null>(null);

  const [isInitializing, setIsInitializing] = useState(false);
  const [isGeneratingRound, setIsGeneratingRound] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const draftSyncTimerRef = useRef<number | null>(null);

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

  // 2. Boot Firestore connection test + restore remembered username profile
  useEffect(() => {
    let active = true;
    async function boot() {
      await testFirestoreConnection();
      const remembered = getStoredUsername();
      if (!remembered) {
        if (active) setIsBootingUser(false);
        return;
      }

      try {
        const profile = await getUserProfile(remembered);
        if (!active) return;
        if (profile) {
          setCurrentUser(profile);
          touchUserProfile(profile.usernameKey, profile.displayName).catch(() => {});
        } else {
          setStoredUsername(null);
        }
      } catch (err) {
        if (active) {
          setAuthError(
            err instanceof Error ? err.message : 'Erro ao conectar ao perfil salvo.'
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

  // 3. Subscribe to current user's Firestore sessions
  useEffect(() => {
    if (!currentUser) {
      setSessions([]);
      setActiveSessionId(null);
      setIsLoadingSessions(false);
      return;
    }

    setIsLoadingSessions(true);
    const unsubscribe = subscribeUserSessions(
      currentUser.usernameKey,
      (cloudSessions) => {
        setSessions(cloudSessions);
        setIsLoadingSessions(false);
      },
      (msg) => {
        setErrorMessage(msg);
        setIsLoadingSessions(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [currentUser]);

  // Cleanup any pending draft timer on unmount or user switch
  useEffect(() => {
    return () => {
      if (draftSyncTimerRef.current !== null) {
        window.clearTimeout(draftSyncTimerRef.current);
      }
    };
  }, [currentUser?.usernameKey]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

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
      setStoredUsername(created.usernameKey);
      setCurrentUser(created);
      setPendingScope(null);
      setActiveSessionId(null);
      setRoute('trainer');
      return 'ok';
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : 'Erro ao acessar perfil no Firestore.'
      );
      return 'ok';
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSwitchUser = () => {
    if (draftSyncTimerRef.current !== null) {
      window.clearTimeout(draftSyncTimerRef.current);
      draftSyncTimerRef.current = null;
    }
    setStoredUsername(null);
    setCurrentUser(null);
    setSessions([]);
    setActiveSessionId(null);
    setPendingScope(null);
    setErrorMessage(null);
    setAuthError(null);
    setRoute('trainer');
  };

  const handleStartNewTraining = () => {
    setErrorMessage(null);
    setPendingScope(null);
    setActiveSessionId(null);
    setRoute('trainer');
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
    if (draftSyncTimerRef.current !== null) {
      window.clearTimeout(draftSyncTimerRef.current);
    }
    draftSyncTimerRef.current = window.setTimeout(() => {
      updateCloudSession(usernameKey, updated).catch((err) => {
        console.error('Erro ao salvar rascunho na nuvem:', err);
      });
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
      });

      const initialSources = mergeKbSources([], initData.kbSources);
      const now = new Date().toISOString();
      const baseSession: TrainingSession = {
        id: `sess_${Date.now()}`,
        ownerUsername: currentUser.usernameKey,
        title: initData.title,
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
        await createCloudSession(currentUser.usernameKey, baseSession);
        setSessions((prev) => [baseSession, ...prev]);
        setActiveSessionId(baseSession.id);
        setPendingScope(null);
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

        await createCloudSession(currentUser.usernameKey, fullSession);
        setSessions((prev) => [fullSession, ...prev]);
        setActiveSessionId(fullSession.id);
        setPendingScope(null);
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
      await updateCloudSession(currentUser.usernameKey, updated);
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

  const handleSubmitRound = async () => {
    if (!activeSession || !currentUser) return;
    const activeRound = activeSession.rounds[activeSession.rounds.length - 1];
    if (!activeRound) return;

    if (draftSyncTimerRef.current !== null) {
      window.clearTimeout(draftSyncTimerRef.current);
      draftSyncTimerRef.current = null;
    }

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

        if (ev.verdict === 'correct') {
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
      await updateCloudSession(currentUser.usernameKey, updated);
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
      await updateCloudSession(currentUser.usernameKey, updated);
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
      (e) => e.verdict !== 'correct'
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
      await updateCloudSession(currentUser.usernameKey, updated);

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
    try {
      await deleteCloudSession(currentUser.usernameKey, sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Erro ao excluir sessão.'
      );
    }
  };

  const handleRetrainTopic = (topic: string) => {
    setErrorMessage(null);
    setActiveSessionId(null);
    setPendingScope({ sourceType: 'topic', sourceContent: topic, selectedKbPaths: [] });
    setRoute('trainer');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] dark:bg-[#111110] text-[#18181B] dark:text-[#F4F2ED] transition-colors">
      <TopBar
        activeRoute={route}
        onNavigate={setRoute}
        onNewTraining={handleStartNewTraining}
        hasActiveSession={Boolean(activeSession)}
      />

      <WorkspaceUtilityBar
        currentUser={currentUser}
        themeMode={themeMode}
        onChangeTheme={setThemeMode}
        onSwitchUser={handleSwitchUser}
      />

      <main className="flex-1">
        {isBootingUser ? (
          <div className="max-w-[600px] mx-auto px-4 py-20 flex flex-col items-center justify-center gap-3 text-sm text-[#57534E] dark:text-[#A8A29E]">
            <Loader2 className="w-5 h-5 animate-spin text-[#B45309] dark:text-[#F59E0B]" aria-hidden="true" />
            <span>Conectando ao Firestore...</span>
          </div>
        ) : !currentUser ? (
          <UsernameGateView
            onAuthenticate={handleAuthenticate}
            isLoading={isAuthenticating}
            errorMessage={authError}
          />
        ) : isLoadingSessions && sessions.length === 0 ? (
          <div className="max-w-[600px] mx-auto px-4 py-20 flex flex-col items-center justify-center gap-3 text-sm text-[#57534E] dark:text-[#A8A29E]">
            <Loader2 className="w-5 h-5 animate-spin text-[#B45309] dark:text-[#F59E0B]" aria-hidden="true" />
            <span>Carregando histórico de @{currentUser.usernameKey}...</span>
          </div>
        ) : route === 'library' ? (
          <SynthesisLibraryView
            usernameKey={currentUser.usernameKey}
            sessions={sessions}
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
            onChangeAnswer={handleChangeAnswer}
            onSelectOption={handleSelectOption}
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
    </div>
  );
}
