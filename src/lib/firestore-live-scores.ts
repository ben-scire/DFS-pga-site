import {
  collection,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirestoreClient } from '@/lib/firebase-client';

export interface TestGolferLiveScore {
  contestId: string;
  golferId: string;
  fantasyPoints?: number;
  position?: string;
  scoreToPar?: number | string;
  thru?: number | string;
  today?: number | string;
  status?: string;
  updatedAtIso?: string;
}

interface TestGolferLiveScoreDoc {
  contestId: string;
  golferId: string;
  fantasyPoints?: unknown;
  position?: unknown;
  scoreToPar?: unknown;
  thru?: unknown;
  today?: unknown;
  status?: unknown;
  updatedAt?: unknown;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asStringOrNumber(value: unknown): string | number | undefined {
  if (typeof value === 'string' || typeof value === 'number') return value;
  return undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function toIsoFromUnknown(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const maybeTimestamp = value as { toDate?: () => Date };
  if (typeof maybeTimestamp.toDate === 'function') {
    return maybeTimestamp.toDate().toISOString();
  }
  return undefined;
}

function parseScoreDoc(snap: QueryDocumentSnapshot): TestGolferLiveScore | null {
  const data = snap.data() as TestGolferLiveScoreDoc;
  const contestId = typeof data.contestId === 'string' ? data.contestId : undefined;
  const golferId = typeof data.golferId === 'string' ? data.golferId : snap.id;
  if (!contestId || !golferId) return null;

  return {
    contestId,
    golferId,
    fantasyPoints: asNumber(data.fantasyPoints),
    position: asString(data.position),
    scoreToPar: asStringOrNumber(data.scoreToPar),
    thru: asStringOrNumber(data.thru),
    today: asStringOrNumber(data.today),
    status: asString(data.status),
    updatedAtIso: toIsoFromUnknown(data.updatedAt),
  };
}

export function getTestScoresCollectionRef(contestId: string) {
  const db = getFirestoreClient();
  if (!db) return null;
  return collection(db, 'test_scores', contestId, 'golfers');
}

export async function loadTestGolferScores(
  contestId: string,
  options?: { source?: 'default' | 'server' }
): Promise<Record<string, TestGolferLiveScore>> {
  const ref = getTestScoresCollectionRef(contestId);
  if (!ref) return {};

  let snap;
  if (options?.source === 'server') {
    try {
      snap = await getDocsFromServer(ref);
    } catch {
      // Fall back so the UI still renders when server-only fetch fails.
      snap = await getDocs(ref);
    }
  } else {
    snap = await getDocs(ref);
  }

  const next: Record<string, TestGolferLiveScore> = {};
  for (const docSnap of snap.docs) {
    const parsed = parseScoreDoc(docSnap);
    if (!parsed) continue;
    next[parsed.golferId] = parsed;
  }
  return next;
}

export function subscribeToTestGolferScores(
  contestId: string,
  onScores: (scoresByGolferId: Record<string, TestGolferLiveScore>) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const ref = getTestScoresCollectionRef(contestId);
  if (!ref) {
    onScores({});
    return () => {};
  }

  return onSnapshot(
    ref,
    (snap) => {
      const next: Record<string, TestGolferLiveScore> = {};
      for (const docSnap of snap.docs) {
        const parsed = parseScoreDoc(docSnap);
        if (!parsed) continue;
        next[parsed.golferId] = parsed;
      }
      onScores(next);
    },
    (error) => {
      onError?.(error instanceof Error ? error : new Error('Firestore live score subscription failed'));
    }
  );
}
