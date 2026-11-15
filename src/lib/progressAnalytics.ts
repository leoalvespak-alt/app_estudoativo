import { makeWeakPointBankId, resolveSessionDiscipline } from './firestoreStore';
import type {
  ComparativeTableEntry,
  ErrorCause,
  TrainingSession,
  WeakPointBankEntry,
} from '../types/trainer';

export const ERROR_CAUSE_LABELS: Record<ErrorCause, string> = {
  lack_of_theory: 'Falta de base teórica',
  rushed_reading: 'Leitura apressada',
  concept_confusion: 'Confusão entre conceitos',
  detail_slip: 'Esquecimento de detalhe',
};

export interface ErrorCauseStat {
  cause: ErrorCause;
  label: string;
  count: number;
  pct: number;
}

export interface WorstTopicRankItem {
  id: string;
  discipline: string;
  concept: string;
  definition: string;
  errorCount: number;
  guessCount: number;
  totalFailures: number;
  dominantCause?: ErrorCause;
  status: 'active' | 'mastered';
}

export interface ConfusionPairCandidate {
  id: string;
  discipline: string;
  conceptA: string;
  conceptB: string;
  reason: 'repeated_confusion_tags' | 'recurring_axis_failures';
  confusionTagCount: number;
  existingTableId?: string;
}

export interface DiagnosticAnalytics {
  totalClassified: number;
  causeStats: ErrorCauseStat[];
  worstTopics: WorstTopicRankItem[];
  confusionPairs: ConfusionPairCandidate[];
}

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

export interface DisciplineSessionPoint {
  sessionId: string;
  sessionIndex: number;
  title: string;
  dateIso: string;
  status: TrainingSession['status'];
  questionsEvaluated: number;
  rawCorrectCount: number;
  guessHitsCount: number;
  rawAccuracyPct: number;
  realRetentionPct: number;
}

export interface DisciplineTrendSeries {
  discipline: string;
  totalSessionsInDiscipline: number;
  points: DisciplineSessionPoint[];
  latestAccuracyPct: number;
  latestRealRetentionPct: number;
  averageAccuracyPct: number;
  deltaAccuracyPct: number;
  lastStudiedAt: string;
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
  disciplineTrends: DisciplineTrendSeries[];
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

  // Build per-discipline trend across the last 10 evaluated training sessions
  const trendBuckets = new Map<
    string,
    Array<{
      sessionId: string;
      title: string;
      dateIso: string;
      createdAt: string;
      status: TrainingSession['status'];
      questionsEvaluated: number;
      rawCorrectCount: number;
      guessHitsCount: number;
      rawAccuracyPct: number;
      realRetentionPct: number;
    }>
  >();

  for (const session of sessions) {
    let sessQuestions = 0;
    let sessCorrect = 0;
    let sessGuessHits = 0;

    for (const round of session.rounds) {
      if (round.evaluations.length === 0) continue;
      for (const q of round.questions) {
        const ev = round.evaluations.find((e) => e.questionId === q.id);
        if (!ev) continue;
        sessQuestions += 1;

        const conf = ev.confidenceAtSubmit || q.confidence || '';
        const isGuess = ev.isLuckyGuess ?? (ev.verdict === 'correct' && conf === 'guess');
        if (ev.verdict === 'correct') {
          sessCorrect += 1;
          if (isGuess) sessGuessHits += 1;
        }
      }
    }

    if (sessQuestions === 0) continue;

    const discipline = resolveSessionDiscipline(session);
    if (!trendBuckets.has(discipline)) {
      trendBuckets.set(discipline, []);
    }

    const rawAccuracyPct = Math.round((sessCorrect / sessQuestions) * 100);
    const realRetentionPct = Math.round(
      (Math.max(0, sessCorrect - sessGuessHits) / sessQuestions) * 100
    );

    trendBuckets.get(discipline)!.push({
      sessionId: session.id,
      title: session.title,
      dateIso: session.updatedAt || session.createdAt,
      createdAt: session.createdAt,
      status: session.status,
      questionsEvaluated: sessQuestions,
      rawCorrectCount: sessCorrect,
      guessHitsCount: sessGuessHits,
      rawAccuracyPct,
      realRetentionPct,
    });
  }

  const disciplineTrends: DisciplineTrendSeries[] = Array.from(trendBuckets.entries())
    .map(([discipline, allItems]) => {
      const sortedAsc = [...allItems].sort(
        (a, b) =>
          a.dateIso.localeCompare(b.dateIso) || a.createdAt.localeCompare(b.createdAt)
      );
      const lastTen = sortedAsc.slice(-10);
      const points: DisciplineSessionPoint[] = lastTen.map((item, idx) => ({
        sessionId: item.sessionId,
        sessionIndex: idx + 1,
        title: item.title,
        dateIso: item.dateIso,
        status: item.status,
        questionsEvaluated: item.questionsEvaluated,
        rawCorrectCount: item.rawCorrectCount,
        guessHitsCount: item.guessHitsCount,
        rawAccuracyPct: item.rawAccuracyPct,
        realRetentionPct: item.realRetentionPct,
      }));

      const first = points[0];
      const latest = points[points.length - 1];
      const averageAccuracyPct =
        points.length > 0
          ? Math.round(
              points.reduce((acc, p) => acc + p.rawAccuracyPct, 0) / points.length
            )
          : 0;
      const deltaAccuracyPct =
        points.length >= 2 ? latest.rawAccuracyPct - first.rawAccuracyPct : 0;

      return {
        discipline,
        totalSessionsInDiscipline: sortedAsc.length,
        points,
        latestAccuracyPct: latest.rawAccuracyPct,
        latestRealRetentionPct: latest.realRetentionPct,
        averageAccuracyPct,
        deltaAccuracyPct,
        lastStudiedAt: latest.dateIso,
      };
    })
    .sort((a, b) => b.lastStudiedAt.localeCompare(a.lastStudiedAt));

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
    disciplineTrends,
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

function normalizeTokenSet(text: string): Set<string> {
  const stop = new Set(['de', 'da', 'do', 'das', 'dos', 'em', 'na', 'no', 'e', 'ou', 'a', 'o', 'para', 'com', 'por']);
  const tokens = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4 && !stop.has(t));
  return new Set(tokens);
}

export function computeDiagnosticAnalytics(params: {
  sessions: TrainingSession[];
  mergedBank: MergedWeakPointItem[];
  comparativeTables?: ComparativeTableEntry[];
  disciplineFilter?: string;
}): DiagnosticAnalytics {
  const { sessions, mergedBank, comparativeTables = [], disciplineFilter } = params;

  const causeCounts: Record<ErrorCause, number> = {
    lack_of_theory: 0,
    rushed_reading: 0,
    concept_confusion: 0,
    detail_slip: 0,
  };

  // Track concept-level confusion counts and failure axis grouping from rounds
  const conceptConfusionByDisc = new Map<
    string,
    Map<string, { concept: string; count: number; subtopic: string }>
  >();

  for (const session of sessions) {
    const disc = resolveSessionDiscipline(session);
    if (disciplineFilter && disc !== disciplineFilter) continue;

    for (const round of session.rounds) {
      if (round.evaluations.length === 0) continue;
      for (const q of round.questions) {
        const ev = round.evaluations.find((e) => e.questionId === q.id);
        if (!ev || !ev.errorCause) continue;

        if (ev.errorCause in causeCounts) {
          causeCounts[ev.errorCause as ErrorCause] += 1;
        }

        if (ev.errorCause === 'concept_confusion') {
          if (!conceptConfusionByDisc.has(disc)) {
            conceptConfusionByDisc.set(disc, new Map());
          }
          const conceptName = (q.targetConcept || q.subtopic || 'Conceito').trim();
          const key = conceptName.toLowerCase();
          const map = conceptConfusionByDisc.get(disc)!;
          const prev = map.get(key) || {
            concept: conceptName,
            count: 0,
            subtopic: q.subtopic || conceptName,
          };
          prev.count += 1;
          map.set(key, prev);
        }
      }
    }
  }

  // Also include bank-stored cause counts if no round-level causes were counted for those items
  const totalFromRounds =
    causeCounts.lack_of_theory +
    causeCounts.rushed_reading +
    causeCounts.concept_confusion +
    causeCounts.detail_slip;

  if (totalFromRounds === 0) {
    for (const entry of mergedBank) {
      if (disciplineFilter && entry.discipline !== disciplineFilter) continue;
      if (entry.errorCauseCounts) {
        for (const key of Object.keys(causeCounts) as ErrorCause[]) {
          causeCounts[key] += Number(entry.errorCauseCounts[key] || 0);
        }
      } else if (entry.lastErrorCause && entry.lastErrorCause in causeCounts) {
        causeCounts[entry.lastErrorCause] += 1;
      }
    }
  }

  const totalClassified =
    causeCounts.lack_of_theory +
    causeCounts.rushed_reading +
    causeCounts.concept_confusion +
    causeCounts.detail_slip;

  const causeStats: ErrorCauseStat[] = (Object.keys(causeCounts) as ErrorCause[])
    .map((cause) => ({
      cause,
      label: ERROR_CAUSE_LABELS[cause],
      count: causeCounts[cause],
      pct: totalClassified > 0 ? Math.round((causeCounts[cause] / totalClassified) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Build worst topics / rules ranking
  const scopedBank = disciplineFilter
    ? mergedBank.filter((b) => b.discipline === disciplineFilter)
    : mergedBank;

  const worstTopics: WorstTopicRankItem[] = scopedBank
    .map((entry) => {
      let dominantCause: ErrorCause | undefined = entry.lastErrorCause;
      if (entry.errorCauseCounts) {
        let bestCount = 0;
        for (const c of Object.keys(causeCounts) as ErrorCause[]) {
          const val = Number(entry.errorCauseCounts[c] || 0);
          if (val > bestCount) {
            bestCount = val;
            dominantCause = c;
          }
        }
      }
      const totalFailures = entry.errorCount + entry.guessCount;
      return {
        id: entry.id,
        discipline: entry.discipline,
        concept: entry.concept,
        definition: entry.definition,
        errorCount: entry.errorCount,
        guessCount: entry.guessCount,
        totalFailures,
        dominantCause,
        status: entry.status,
      };
    })
    .filter((item) => item.totalFailures > 0)
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
      if (b.errorCount !== a.errorCount) return b.errorCount - a.errorCount;
      return b.totalFailures - a.totalFailures;
    });

  // Detect confusion pairs (2 related failing concepts or >=2 concept_confusion tags in same axis/discipline)
  const confusionPairs: ConfusionPairCandidate[] = [];
  const seenPairs = new Set<string>();

  const findExistingTable = (disc: string, a: string, b: string) => {
    const al = a.toLowerCase();
    const bl = b.toLowerCase();
    return comparativeTables.find(
      (ct) =>
        ct.discipline.toLowerCase() === disc.toLowerCase() &&
        ((ct.conceptA.toLowerCase() === al && ct.conceptB.toLowerCase() === bl) ||
          (ct.conceptA.toLowerCase() === bl && ct.conceptB.toLowerCase() === al))
    );
  };

  // Group bank entries by discipline
  const bankByDisc = new Map<string, MergedWeakPointItem[]>();
  for (const item of scopedBank) {
    if (item.errorCount + item.guessCount <= 0) continue;
    if (!bankByDisc.has(item.discipline)) {
      bankByDisc.set(item.discipline, []);
    }
    bankByDisc.get(item.discipline)!.push(item);
  }

  for (const [disc, items] of bankByDisc.entries()) {
    const confMap = conceptConfusionByDisc.get(disc);
    const totalDiscConfusionTags = confMap
      ? Array.from(confMap.values()).reduce((sum, v) => sum + v.count, 0)
      : items.reduce(
          (sum, it) =>
            sum +
            Number(it.errorCauseCounts?.concept_confusion || (it.lastErrorCause === 'concept_confusion' ? 1 : 0)),
          0
        );

    const sortedItems = [...items].sort(
      (a, b) => b.errorCount + b.guessCount - (a.errorCount + a.guessCount)
    );

    if (sortedItems.length >= 2) {
      // Find best pair (shared tokens or top 2 confused/failing concepts in discipline)
      let bestPair: [MergedWeakPointItem, MergedWeakPointItem] | null = null;
      let bestScore = -1;

      for (let i = 0; i < Math.min(sortedItems.length, 8); i++) {
        for (let j = i + 1; j < Math.min(sortedItems.length, 8); j++) {
          const a = sortedItems[i];
          const b = sortedItems[j];
          const tokensA = normalizeTokenSet(`${a.concept} ${a.subtopic}`);
          const tokensB = normalizeTokenSet(`${b.concept} ${b.subtopic}`);
          let overlap = 0;
          tokensA.forEach((t) => {
            if (tokensB.has(t)) overlap += 1;
          });
          const aConf =
            (confMap?.get(a.concept.toLowerCase())?.count || 0) +
            Number(a.errorCauseCounts?.concept_confusion || (a.lastErrorCause === 'concept_confusion' ? 1 : 0));
          const bConf =
            (confMap?.get(b.concept.toLowerCase())?.count || 0) +
            Number(b.errorCauseCounts?.concept_confusion || (b.lastErrorCause === 'concept_confusion' ? 1 : 0));

          const score =
            (aConf > 0 || bConf > 0 ? 10 : 0) +
            overlap * 4 +
            Math.min(6, a.errorCount + b.errorCount);

          const hasTrigger =
            totalDiscConfusionTags >= 2 ||
            aConf >= 2 ||
            bConf >= 2 ||
            (aConf >= 1 && bConf >= 1) ||
            (overlap >= 1 && a.errorCount + a.guessCount >= 2 && b.errorCount + b.guessCount >= 2);

          if (hasTrigger && score > bestScore) {
            bestScore = score;
            bestPair = [a, b];
          }
        }
      }

      if (bestPair) {
        const [a, b] = bestPair;
        const pairKey = [disc, a.concept.toLowerCase(), b.concept.toLowerCase()]
          .sort()
          .join('::');
        if (!seenPairs.has(pairKey)) {
          seenPairs.add(pairKey);
          const existingTable = findExistingTable(disc, a.concept, b.concept);
          confusionPairs.push({
            id: `pair_${a.id}_${b.id}`,
            discipline: disc,
            conceptA: a.concept,
            conceptB: b.concept,
            reason:
              totalDiscConfusionTags >= 2
                ? 'repeated_confusion_tags'
                : 'recurring_axis_failures',
            confusionTagCount: Math.max(2, totalDiscConfusionTags),
            existingTableId: existingTable?.id,
          });
        }
      }
    } else if (sortedItems.length === 1 && totalDiscConfusionTags >= 2) {
      // Single concept tagged >=2 times with concept_confusion
      const only = sortedItems[0];
      const existingTable = comparativeTables.find(
        (ct) =>
          ct.discipline.toLowerCase() === disc.toLowerCase() &&
          (ct.conceptA.toLowerCase() === only.concept.toLowerCase() ||
            ct.conceptB.toLowerCase() === only.concept.toLowerCase())
      );
      confusionPairs.push({
        id: `pair_single_${only.id}`,
        discipline: disc,
        conceptA: only.concept,
        conceptB: `Conceito correlato em ${disc}`,
        reason: 'repeated_confusion_tags',
        confusionTagCount: totalDiscConfusionTags,
        existingTableId: existingTable?.id,
      });
    }
  }

  return {
    totalClassified,
    causeStats,
    worstTopics,
    confusionPairs,
  };
}
