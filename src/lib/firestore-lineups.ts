import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirestoreClient } from '@/lib/firebase-client';
import type { PersistedLineupEntry } from '@/lib/lineup-builder-types';

interface TestLineupDoc {
  contestId: string;
  userSlug: string;
  userDisplayName: string;
  lineupGolferIds: string[];
  submittedAtIso?: string;
  lastEditedAtIso: string;
  updatedAt?: unknown;
  source: 'web-test';
  version: 1;
}

function isValidLineupDoc(data: unknown): data is TestLineupDoc {
  if (!data || typeof data !== 'object') return false;
  const row = data as Partial<TestLineupDoc>;
  return (
    typeof row.contestId === 'string' &&
    typeof row.userSlug === 'string' &&
    typeof row.userDisplayName === 'string' &&
    Array.isArray(row.lineupGolferIds) &&
    typeof row.lastEditedAtIso === 'string'
  );
}

function toPersistedEntry(data: TestLineupDoc): PersistedLineupEntry {
  return {
    contestId: data.contestId,
    userKey: data.userSlug,
    userDisplayName: data.userDisplayName,
    lineupGolferIds: Array.isArray(data.lineupGolferIds) ? data.lineupGolferIds : [],
    submittedAtIso: data.submittedAtIso,
    lastEditedAtIso: data.lastEditedAtIso,
  };
}

function toDoc(entry: PersistedLineupEntry & { userDisplayName: string }): TestLineupDoc {
  return {
    contestId: entry.contestId,
    userSlug: entry.userKey,
    userDisplayName: entry.userDisplayName,
    lineupGolferIds: entry.lineupGolferIds,
    submittedAtIso: entry.submittedAtIso,
    lastEditedAtIso: entry.lastEditedAtIso,
    source: 'web-test',
    version: 1,
  };
}

export function isFirestoreLineupStorageAvailable(): boolean {
  return Boolean(getFirestoreClient());
}

export function getTestLineupDocRef(contestId: string, userSlug: string) {
  const db = getFirestoreClient();
  if (!db) return null;
  return doc(db, 'test_lineups', contestId, 'entries', userSlug);
}

export async function loadTestLineup(
  contestId: string,
  userSlug: string
): Promise<PersistedLineupEntry | null> {
  const ref = getTestLineupDocRef(contestId, userSlug);
  if (!ref) return null;

  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  if (!isValidLineupDoc(data)) return null;
  return toPersistedEntry(data);
}

export async function saveTestLineup(
  entry: PersistedLineupEntry & { userDisplayName: string }
): Promise<void> {
  const ref = getTestLineupDocRef(entry.contestId, entry.userKey);
  if (!ref) throw new Error('Firebase not configured');
  await setDoc(
    ref,
    {
      ...toDoc(entry),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function submitTestLineup(
  entry: PersistedLineupEntry & { userDisplayName: string }
): Promise<{ submittedAtIso: string }> {
  const submittedAtIso = new Date().toISOString();
  await saveTestLineup({
    ...entry,
    submittedAtIso,
  });
  return { submittedAtIso };
}

export function subscribeToTestLineup(
  contestId: string,
  userSlug: string,
  onEntry: (entry: PersistedLineupEntry | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const ref = getTestLineupDocRef(contestId, userSlug);
  if (!ref) {
    onEntry(null);
    return () => {};
  }

  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onEntry(null);
        return;
      }
      const data = snap.data();
      if (!isValidLineupDoc(data)) {
        onEntry(null);
        return;
      }
      onEntry(toPersistedEntry(data));
    },
    (error) => {
      onError?.(error instanceof Error ? error : new Error('Firestore subscription failed'));
    }
  );
}

