import { makeWeakPointBankId, resolveSessionDiscipline } from './firestoreStore';
import type { TrainingSession, WeakPointBankEntry } from '../types/trainer';

export interface DisciplineProgressSummary {
  discipline: string;
  completedSessions: number;
  roundsEvaluated: number;
  questionsEvaluated: number;
  rawCorrectCount: number;
  guessHitsCount: number;
  unsureHitsCount: number;
  confidentErrorsCount: number;
  rawAccuracyPct: number;
  realRetentionPct: number;
  topicsCovered: string[];
  lastStudiedAt: string;
  sessions: Array<{
    id: string;
    title: string;
    updatedAt: string;
    accuracyPct: number;
    topicsCount: number;
  }>;
}

export interface OverallProgressMetrics {
  completedSessionsCount: number;
  activeSessionsCount: number;
  totalQuestionsEvaluated: number;
  rawCorrectCount: number;
  guessHitsCount: number;
  unsureHitsCount: number;
  confidentErrorsCount: number;
  rawAccuracyPct: number;
  realRetentionPct: number;
  guessShareOfCorrectPct: number;
  totalTopicsConsolidated: number;
  disciplineSummaries: DisciplineProgressSummary[];
}

export function computeProgressMetrics(sessions: TrainingSession[]): OverallProgressMetrics {
  const completedSessions = sessions.filter((s) => s.status === 'completed');
  const activeSessionsCount = sessions.length - completedSessions.length;

  let totalQuestionsEvaluated = 0;
  let rawCorrectCount = 0;
  let guessHitsCount = 0;
  let unsureHitsCount = 0;
  let confidentErrorsCount = 0;
  const globalTopicsSet = new Set<string>();

  for (const session of sessions) {
    for (const round of session.rounds) {
      if (round.evaluations.length === 0) continue;
      for (const q of round.questions) {
        const ev = round.evaluations.find((e) => e.questionId === q.id);
        if (!ev) continue;
        totalQuestionsEvaluated += 1;

        const conf = ev.confidenceAtSubmit || q.confidence || '';
        const isGuess = ev.isLuckyGuess ?? (ev.verdict === 'correct' && conf === 'guess');
        const isUnsureHit = ev.verdict === 'correct' && conf === 'unsure';
        const isConfErr = ev.isConfidentError ?? (ev.verdict !== 'correct' && conf === 'certain');

        if (ev.verdict === 'correct') {
          rawCorrectCount += 1;
          if (isGuess) guessHitsCount += 1;
          if (isUnsureHit) unsureHitsCount += 1;
        } else if (isConfErr) {
          confidentErrorsCount += 1;
        }
      }
    }
  }

  // Group syllabus/edital progress strictly from completed sessions
  const discMap = new Map<
    string,
    {
      completedSessions: number;
      roundsEvaluated: number;
      questionsEvaluated: number;
      rawCorrectCount: number;
      guessHitsCount: number;
      unsureHitsCount: number;
      confidentErrorsCount: number;
      topics: Set<string>;
      lastStudiedAt: string;
      sessions: DisciplineProgressSummary['sessions'];
    }
  >();

  for (const session of completedSessions) {
    const discipline = resolveSessionDiscipline(session);
    if (!discMap.has(discipline)) {
      discMap.set(discipline, {
        completedSessions: 0,
        roundsEvaluated: 0,
        questionsEvaluated: 0,
        rawCorrectCount: 0,
        guessHitsCount: 0,
        unsureHitsCount: 0,
        confidentErrorsCount: 0,
        topics: new Set<string>(),
        lastStudiedAt: session.updatedAt,
        sessions: [],
      });
    }

    const bucket = discMap.get(discipline)!;
    bucket.completedSessions += 1;
    if (session.updatedAt > bucket.lastStudiedAt) {
      bucket.lastStudiedAt = session.updatedAt;
    }

    const sessionTopics = new Set<string>();
    for (const plan of session.syllabus) {
      if (plan.covered) {
        for (const t of plan.topics) {
          if (t.trim()) {
            sessionTopics.add(t.trim());
            bucket.topics.add(t.trim());
            globalTopicsSet.add(`${discipline}::${t.trim().toLowerCase()}`);
          }
        }
      }
    }

    let sessQ = 0;
    let sessCorrect = 0;

    for (const round of session.rounds) {
      if (round.evaluations.length === 0) continue;
      bucket.roundsEvaluated += 1;
      for (const q of round.questions) {
        const ev = round.evaluations.find((e) => e.questionId === q.id);
        if (!ev) continue;
        sessQ += 1;
        bucket.questionsEvaluated += 1;

        if (q.subtopic?.trim()) {
          sessionTopics.add(q.subtopic.trim());
          bucket.topics.add(q.subtopic.trim());
          globalTopicsSet.add(`${discipline}::${q.subtopic.trim().toLowerCase()}`);
        }

        const conf = ev.confidenceAtSubmit || q.confidence || '';
        const isGuess = ev.isLuckyGuess ?? (ev.verdict === 'correct' && conf === 'guess');
        const isUnsureHit = ev.verdict === 'correct' && conf === 'unsure';
        const isConfErr = ev.isConfidentError ?? (ev.verdict !== 'correct' && conf === 'certain');

        if (ev.verdict === 'correct') {
          sessCorrect += 1;
          bucket.rawCorrectCount += 1;
          if (isGuess) bucket.guessHitsCount += 1;
          if (isUnsureHit) bucket.unsureHitsCount += 1;
        } else if (isConfErr) {
          bucket.confidentErrorsCount += 1;
        }
      }
    }

    bucket.sessions.push({
      id: session.id,
      title: session.title,
      updatedAt: session.updatedAt,
      accuracyPct: sessQ > 0 ? Math.round((sessCorrect / sessQ) * 100) : 0,
      topicsCount: sessionTopics.size,
    });
  }

  const disciplineSummaries: DisciplineProgressSummary[] = Array.from(discMap.entries())
    .map(([discipline, b]) => {
      const rawAccuracyPct =
        b.questionsEvaluated > 0
          ? Math.round((b.rawCorrectCount / b.questionsEvaluated) * 100)
          : 0;
      const realRetentionCount = Math.max(0, b.rawCorrectCount - b.guessHitsCount);
      const realRetentionPct =
        b.questionsEvaluated > 0
          ? Math.round((realRetentionCount / b.questionsEvaluated) * 100)
          : 0;

      return {
        discipline,
        completedSessions: b.completedSessions,
        roundsEvaluated: b.roundsEvaluated,
        questionsEvaluated: b.questionsEvaluated,
        rawCorrectCount: b.rawCorrectCount,
        guessHitsCount: b.guessHitsCount,
        unsureHitsCount: b.unsureHitsCount,
        confidentErrorsCount: b.confidentErrorsCount,
        rawAccuracyPct,
        realRetentionPct,
        topicsCovered: Array.from(b.topics),
        lastStudiedAt: b.lastStudiedAt,
        sessions: b.sessions.sort((a, z) => z.updatedAt.localeCompare(a.updatedAt)),
      };
    })
    .sort((a, b) => b.lastStudiedAt.localeCompare(a.lastStudiedAt));

  const rawAccuracyPct =
    totalQuestionsEvaluated > 0
      ? Math.round((rawCorrectCount / totalQuestionsEvaluated) * 100)
      : 0;
  const realRetentionCount = Math.max(0, rawCorrectCount - guessHitsCount);
  const realRetentionPct =
    totalQuestionsEvaluated > 0
      ? Math.round((realRetentionCount / totalQuestionsEvaluated) * 100)
      : 0;
  const guessShareOfCorrectPct =
    rawCorrectCount > 0 ? Math.round((guessHitsCount / rawCorrectCount) * 100) : 0;

  return {
    completedSessionsCount: completedSessions.length,
    activeSessionsCount,
    totalQuestionsEvaluated,
    rawCorrectCount,
    guessHitsCount,
    unsureHitsCount,
    confidentErrorsCount,
    rawAccuracyPct,
    realRetentionPct,
    guessShareOfCorrectPct,
    totalTopicsConsolidated: globalTopicsSet.size,
    disciplineSummaries,
  };
}

export interface MergedWeakPointItem extends WeakPointBankEntry {
  isLegacyFromSession: boolean;
}

export function buildMergedWeakPointBank(
  usernameKey: string,
  cloudBank: WeakPointBankEntry[],
  sessions: TrainingSession[]
): MergedWeakPointItem[] {
  const byKey = new Map<string, MergedWeakPointItem>();

  for (const entry of cloudBank) {
    const key = `${entry.discipline.trim().toLowerCase()}::${entry.concept.trim().toLowerCase()}`;
    byKey.set(key, { ...entry, isLegacyFromSession: false });
  }

  for (const session of sessions) {
    const discipline = resolveSessionDiscipline(session);
    for (const wp of session.activeWeakPoints) {
      const concept = (wp.concept || '').trim();
      if (!concept) continue;
      const key = `${discipline.toLowerCase()}::${concept.toLowerCase()}`;
      if (byKey.has(key)) continue;

      byKey.set(key, {
        id: makeWeakPointBankId(discipline, concept),
        ownerUsername: usernameKey,
        discipline,
        concept,
        definition: wp.definition || '',
        subtopic: concept,
        sourceSessionId: session.id,
        sourceSessionTitle: session.title,
        status: wp.resolved ? 'mastered' : 'active',
        lastTrigger: 'incorrect',
        errorCount: 1 + (wp.retestCount || 0),
        guessCount: 0,
        retestSuccessCount: wp.resolved ? 1 : 0,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        isLegacyFromSession: true,
      });
    }
  }

  return Array.from(byKey.values()).sort((a, b) => {
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}
