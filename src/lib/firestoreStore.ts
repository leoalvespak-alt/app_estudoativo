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
import type { TrainingSession, UserProfile } from '../types/trainer';

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
          sourceType:
            d.sourceType === 'text'
              ? 'text'
              : d.sourceType === 'git_kb'
                ? 'git_kb'
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
