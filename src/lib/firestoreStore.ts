import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import type {
  QuestionEvaluation,
  TrainerQuestion,
  TrainingSession,
  UserProfile,
  WeakPointBankEntry,
  WeakPointTrigger,
} from '../types/trainer';

const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/;

export function normalizeUsername(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9._-]/g, '');
}

export function isValidUsername(usernameKey: string): boolean {
  return USERNAME_PATTERN.test(usernameKey);
}

function toIsoString(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string' && val.length > 0) {
    return val;
  }
  return new Date().toISOString();
}

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefined(v);
      }
    }
    return out as T;
  }
  return value;
}

export function resolveSessionDiscipline(session: {
  discipline?: string;
  kbSources?: Array<{ origin?: string; discipline?: string }>;
  title?: string;
}): string {
  if (session.discipline && session.discipline.trim().length > 0) {
    return session.discipline.trim().slice(0, 100);
  }
  const gitDisc = session.kbSources?.find(
    (s) =>
      s.origin === 'git' &&
      s.discipline &&
      s.discipline !== 'Legislação Seca' &&
      s.discipline !== 'Pesquisa Web (Complemento)'
  )?.discipline;
  if (gitDisc) {
    return gitDisc.slice(0, 100);
  }
  const title = (session.title || '').trim();
  const dashSplit = title.split(/\s+[—–-]\s+/)[0]?.trim();
  if (dashSplit && dashSplit.length >= 3 && dashSplit.length <= 45) {
    return dashSplit;
  }
  return 'Conhecimentos Gerais';
}

export function makeWeakPointBankId(discipline: string, concept: string): string {
  const raw = `${discipline.trim().toLowerCase()}::${concept.trim().toLowerCase()}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  const slug = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  const hex = `${(h1 >>> 0).toString(16)}${(h2 >>> 0).toString(16)}`;
  return `wp_${slug || 'item'}_${hex}`.slice(0, 120);
}

export async function getUserProfile(usernameKey: string): Promise<UserProfile | null> {
  const path = `users/${usernameKey}`;
  try {
    const snap = await getDoc(doc(db, 'users', usernameKey));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      usernameKey: String(data.usernameKey || usernameKey),
      displayName: String(data.displayName || usernameKey),
      createdAt: toIsoString(data.createdAt),
      lastActiveAt: toIsoString(data.lastActiveAt),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function createUserProfile(
  usernameKey: string,
  displayName: string
): Promise<UserProfile> {
  const path = `users/${usernameKey}`;
  const cleanDisplay = displayName.trim().slice(0, 40) || usernameKey;
  try {
    await setDoc(doc(db, 'users', usernameKey), {
      usernameKey,
      displayName: cleanDisplay.length >= 3 ? cleanDisplay : usernameKey,
      createdAt: serverTimestamp(),
      lastActiveAt: serverTimestamp(),
    });
    return {
      usernameKey,
      displayName: cleanDisplay.length >= 3 ? cleanDisplay : usernameKey,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function touchUserProfile(
  usernameKey: string,
  displayName: string
): Promise<void> {
  const path = `users/${usernameKey}`;
  const cleanDisplay = displayName.trim().slice(0, 40) || usernameKey;
  try {
    await updateDoc(doc(db, 'users', usernameKey), {
      displayName: cleanDisplay.length >= 3 ? cleanDisplay : usernameKey,
      lastActiveAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeUserSessions(
  usernameKey: string,
  onSessions: (sessions: TrainingSession[]) => void,
  onError: (message: string) => void
): Unsubscribe {
  const path = `users/${usernameKey}/sessions`;
  const q = query(
    collection(db, 'users', usernameKey, 'sessions'),
    orderBy('updatedAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list: TrainingSession[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: String(d.id || docSnap.id),
          ownerUsername: String(d.ownerUsername || usernameKey),
          title: String(d.title || 'Treino'),
          discipline: typeof d.discipline === 'string' ? d.discipline : undefined,
          sourceType:
            d.sourceType === 'text'
              ? 'text'
              : d.sourceType === 'git_kb'
                ? 'git_kb'
                : d.sourceType === 'weak_points'
                  ? 'weak_points'
                  : 'topic',
          sourceContent: String(d.sourceContent || ''),
          selectedKbPaths: Array.isArray(d.selectedKbPaths) ? d.selectedKbPaths : [],
          kbSources: Array.isArray(d.kbSources) ? d.kbSources : [],
          status: d.status || 'in_progress',
          wantsPrepClass: Boolean(d.wantsPrepClass),
          currentRound: Number(d.currentRound || 1),
          syllabus: Array.isArray(d.syllabus) ? d.syllabus : [],
          prepClass: d.prepClass ?? null,
          rounds: Array.isArray(d.rounds) ? d.rounds : [],
          activeWeakPoints: Array.isArray(d.activeWeakPoints) ? d.activeWeakPoints : [],
          strategicSyntheses: Array.isArray(d.strategicSyntheses) ? d.strategicSyntheses : [],
          finalSynthesis: d.finalSynthesis ?? null,
          createdAt: toIsoString(d.createdAt),
          updatedAt: toIsoString(d.updatedAt),
        };
      });
      onSessions(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(
          wrapped instanceof Error ? wrapped.message : 'Erro ao sincronizar sessões com a nuvem.'
        );
      }
    }
  );
}

export async function createCloudSession(
  usernameKey: string,
  session: TrainingSession
): Promise<void> {
  const path = `users/${usernameKey}/sessions/${session.id}`;
  const payload = stripUndefined({
    id: session.id,
    ownerUsername: usernameKey,
    title: session.title.slice(0, 160),
    discipline: session.discipline ? session.discipline.slice(0, 100) : undefined,
    sourceType: session.sourceType,
    sourceContent: session.sourceContent.slice(0, 20000),
    selectedKbPaths: (session.selectedKbPaths || []).slice(0, 20),
    kbSources: (session.kbSources || []).slice(0, 20),
    status: session.status,
    wantsPrepClass: Boolean(session.wantsPrepClass),
    currentRound: session.currentRound,
    syllabus: session.syllabus.slice(0, 10),
    prepClass: session.prepClass ?? null,
    rounds: session.rounds.slice(0, 30),
    activeWeakPoints: session.activeWeakPoints.slice(0, 100),
    strategicSyntheses: session.strategicSyntheses.slice(0, 5),
    finalSynthesis: session.finalSynthesis ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await setDoc(doc(db, 'users', usernameKey, 'sessions', session.id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateCloudSession(
  usernameKey: string,
  session: TrainingSession
): Promise<void> {
  const path = `users/${usernameKey}/sessions/${session.id}`;
  const payload = stripUndefined({
    title: session.title.slice(0, 160),
    discipline: session.discipline ? session.discipline.slice(0, 100) : undefined,
    kbSources: (session.kbSources || []).slice(0, 20),
    status: session.status,
    wantsPrepClass: Boolean(session.wantsPrepClass),
    currentRound: session.currentRound,
    syllabus: session.syllabus.slice(0, 10),
    prepClass: session.prepClass ?? null,
    rounds: session.rounds.slice(0, 30),
    activeWeakPoints: session.activeWeakPoints.slice(0, 100),
    strategicSyntheses: session.strategicSyntheses.slice(0, 5),
    finalSynthesis: session.finalSynthesis ?? null,
    updatedAt: serverTimestamp(),
  });

  try {
    await updateDoc(doc(db, 'users', usernameKey, 'sessions', session.id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCloudSession(
  usernameKey: string,
  sessionId: string
): Promise<void> {
  const path = `users/${usernameKey}/sessions/${sessionId}`;
  try {
    await deleteDoc(doc(db, 'users', usernameKey, 'sessions', sessionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeUserWeakPoints(
  usernameKey: string,
  onEntries: (entries: WeakPointBankEntry[]) => void,
  onError: (message: string) => void
): Unsubscribe {
  const path = `users/${usernameKey}/weakPoints`;
  const q = query(
    collection(db, 'users', usernameKey, 'weakPoints'),
    orderBy('updatedAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list: WeakPointBankEntry[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: String(d.id || docSnap.id),
          ownerUsername: String(d.ownerUsername || usernameKey),
          discipline: String(d.discipline || 'Conhecimentos Gerais'),
          concept: String(d.concept || ''),
          definition: String(d.definition || ''),
          subtopic: String(d.subtopic || ''),
          sourceSessionId: String(d.sourceSessionId || ''),
          sourceSessionTitle: String(d.sourceSessionTitle || 'Treino'),
          status: d.status === 'mastered' ? 'mastered' : 'active',
          lastTrigger:
            d.lastTrigger === 'partial' ||
            d.lastTrigger === 'lucky_guess' ||
            d.lastTrigger === 'unsure_hit'
              ? d.lastTrigger
              : 'incorrect',
          errorCount: Number(d.errorCount || 0),
          guessCount: Number(d.guessCount || 0),
          retestSuccessCount: Number(d.retestSuccessCount || 0),
          createdAt: toIsoString(d.createdAt),
          updatedAt: toIsoString(d.updatedAt),
        };
      });
      onEntries(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(
          wrapped instanceof Error
            ? wrapped.message
            : 'Erro ao sincronizar banco de pontos fracos.'
        );
      }
    }
  );
}

export async function syncRoundWeakPointsToBank(params: {
  usernameKey: string;
  session: TrainingSession;
  questions: TrainerQuestion[];
  evaluations: QuestionEvaluation[];
  existingBank: WeakPointBankEntry[];
}): Promise<void> {
  const { usernameKey, session, questions, evaluations, existingBank } = params;
  const discipline = resolveSessionDiscipline(session).slice(0, 100) || 'Conhecimentos Gerais';

  for (const question of questions) {
    const ev = evaluations.find((item) => item.questionId === question.id);
    if (!ev) continue;

    const concept = (question.targetConcept || question.subtopic || 'Conceito').trim().slice(0, 240);
    if (!concept) continue;

    const wpId = makeWeakPointBankId(discipline, concept);
    const existing =
      existingBank.find((entry) => entry.id === wpId) ||
      existingBank.find(
        (entry) =>
          entry.discipline.trim().toLowerCase() === discipline.toLowerCase() &&
          entry.concept.trim().toLowerCase() === concept.toLowerCase()
      );

    const conf = ev.confidenceAtSubmit ?? question.confidence ?? 'certain';
    const isError = ev.verdict === 'incorrect' || ev.verdict === 'partial';
    const isLuckyGuess = ev.verdict === 'correct' && conf === 'guess';
    const isUnsureHit = ev.verdict === 'correct' && conf === 'unsure';
    const isCertainHit = ev.verdict === 'correct' && !isLuckyGuess && !isUnsureHit;

    const docId = existing?.id || wpId;
    const path = `users/${usernameKey}/weakPoints/${docId}`;

    if (isError || isLuckyGuess || isUnsureHit) {
      const trigger: WeakPointTrigger =
        ev.verdict === 'incorrect'
          ? 'incorrect'
          : ev.verdict === 'partial'
            ? 'partial'
            : isLuckyGuess
              ? 'lucky_guess'
              : 'unsure_hit';

      const nextErrorCount = Math.min(10000, (existing?.errorCount || 0) + (isError ? 1 : 0));
      const nextGuessCount = Math.min(
        10000,
        (existing?.guessCount || 0) + (isLuckyGuess || isUnsureHit ? 1 : 0)
      );

      if (existing) {
        try {
          await updateDoc(doc(db, 'users', usernameKey, 'weakPoints', docId), {
            discipline,
            concept,
            definition: (ev.conceptDefinition || existing.definition || '').slice(0, 2000),
            subtopic: (question.subtopic || existing.subtopic || '').slice(0, 240),
            sourceSessionId: session.id,
            sourceSessionTitle: session.title.slice(0, 160),
            status: 'active',
            lastTrigger: trigger,
            errorCount: nextErrorCount,
            guessCount: nextGuessCount,
            retestSuccessCount: existing.retestSuccessCount || 0,
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, path);
        }
      } else {
        try {
          await setDoc(doc(db, 'users', usernameKey, 'weakPoints', docId), {
            id: docId,
            ownerUsername: usernameKey,
            discipline,
            concept,
            definition: (ev.conceptDefinition || '').slice(0, 2000),
            subtopic: (question.subtopic || '').slice(0, 240),
            sourceSessionId: session.id,
            sourceSessionTitle: session.title.slice(0, 160),
            status: 'active',
            lastTrigger: trigger,
            errorCount: nextErrorCount,
            guessCount: nextGuessCount,
            retestSuccessCount: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, path);
        }
      }
    } else if (isCertainHit && existing && existing.status === 'active') {
      try {
        await updateDoc(doc(db, 'users', usernameKey, 'weakPoints', docId), {
          definition: (ev.conceptDefinition || existing.definition || '').slice(0, 2000),
          status: 'mastered',
          retestSuccessCount: Math.min(10000, (existing.retestSuccessCount || 0) + 1),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    }
  }
}

export async function toggleWeakPointStatus(
  usernameKey: string,
  entry: WeakPointBankEntry
): Promise<void> {
  const path = `users/${usernameKey}/weakPoints/${entry.id}`;
  const nextStatus = entry.status === 'mastered' ? 'active' : 'mastered';
  try {
    await updateDoc(doc(db, 'users', usernameKey, 'weakPoints', entry.id), {
      status: nextStatus,
      retestSuccessCount:
        nextStatus === 'mastered'
          ? Math.min(10000, entry.retestSuccessCount + 1)
          : entry.retestSuccessCount,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteWeakPointBankEntry(
  usernameKey: string,
  weakPointId: string
): Promise<void> {
  const path = `users/${usernameKey}/weakPoints/${weakPointId}`;
  try {
    await deleteDoc(doc(db, 'users', usernameKey, 'weakPoints', weakPointId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
