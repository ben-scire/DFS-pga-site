import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type QueryDocumentSnapshot,
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

export interface ContestLineupEntry extends PersistedLineupEntry {
  userDisplayName: string;
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

function parseContestLineupDoc(snap: QueryDocumentSnapshot): ContestLineupEntry | null {
  const data = snap.data();
  if (!isValidLineupDoc(data)) return null;
  const entry = toPersistedEntry(data);
  return {
    ...entry,
    userDisplayName: data.userDisplayName,
  };
}

function toDoc(entry: PersistedLineupEntry & { userDisplayName: string }): TestLineupDoc {
  const base: TestLineupDoc = {
    contestId: entry.contestId,
    userSlug: entry.userKey,
    userDisplayName: entry.userDisplayName,
    lineupGolferIds: entry.lineupGolferIds,
    lastEditedAtIso: entry.lastEditedAtIso,
    source: 'web-test',
    version: 1,
  };
  if (entry.submittedAtIso) {
    base.submittedAtIso = entry.submittedAtIso;
  }
  return base;
}

export function isFirestoreLineupStorageAvailable(): boolean {
  return Boolean(getFirestoreClient());
}

export function getTestLineupDocRef(contestId: string, userSlug: string) {
  const db = getFirestoreClient();
  if (!db) return null;
  return doc(db, 'test_lineups', contestId, 'entries', userSlug);
}

export function getTestLineupsCollectionRef(contestId: string) {
  const db = getFirestoreClient();
  if (!db) return null;
  return collection(db, 'test_lineups', contestId, 'entries');
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

export function subscribeToContestLineups(
  contestId: string,
  onEntries: (entries: ContestLineupEntry[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const ref = getTestLineupsCollectionRef(contestId);
  if (!ref) {
    onEntries([]);
    return () => {};
  }

  return onSnapshot(
    ref,
    (snap) => {
      const entries: ContestLineupEntry[] = [];
      for (const docSnap of snap.docs) {
        const parsed = parseContestLineupDoc(docSnap);
        if (!parsed) continue;
        entries.push(parsed);
      }
      onEntries(entries);
    },
    (error) => {
      onError?.(error instanceof Error ? error : new Error('Contest lineup subscription failed'));
    }
  );
}
