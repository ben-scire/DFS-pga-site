import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import type { AuthSession } from '@/lib/firebase-auth';
import { getFirestoreClient } from '@/lib/firebase-client';
import { getTestUserName } from '@/lib/test-users';
import { resolveTestUserFromEntryName } from '@/lib/test-user-entry-aliases';
import moneyTrackerData from '../../league-scoring/money-tracker.json';

export type PaymentStatusField = 'week1Paid' | 'week2Paid' | 'week3Paid' | 'quarter1Paid';

export interface UserPaymentStatus {
  week1Paid: boolean;
  week2Paid: boolean;
  week3Paid: boolean;
  quarter1Paid: boolean;
}

export type PaymentStatusMap = Record<string, UserPaymentStatus>;

interface MoneyTrackerEntry {
  entryName: string;
  week1Paid?: boolean;
  week2Paid?: boolean;
  week3Paid?: boolean;
  quarter1Paid?: boolean;
}

interface MoneyTrackerFile {
  entries?: MoneyTrackerEntry[];
}

const PAYMENT_STATUS_COLLECTION = 'test_payment_status';
const EMPTY_PAYMENT_STATUS: UserPaymentStatus = {
  week1Paid: false,
  week2Paid: false,
  week3Paid: false,
  quarter1Paid: false,
};

const DEFAULT_PAYMENT_STATUS_BY_SLUG: PaymentStatusMap = ((moneyTrackerData as MoneyTrackerFile).entries ?? []).reduce<PaymentStatusMap>(
  (acc, row) => {
    const resolved = resolveTestUserFromEntryName(row.entryName);
    if (!resolved) return acc;
    acc[resolved.userSlug] = {
      week1Paid: row.week1Paid === true,
      week2Paid: row.week2Paid === true,
      week3Paid: row.week3Paid === true,
      quarter1Paid: row.quarter1Paid === true,
    };
    return acc;
  },
  {}
);

function parseStatusValue(value: unknown): UserPaymentStatus {
  if (!value || typeof value !== 'object') {
    return { ...EMPTY_PAYMENT_STATUS };
  }

  const row = value as Record<string, unknown>;

  // Backward compatibility for old single-field docs.
  if (typeof row.paid === 'boolean') {
    return {
      week1Paid: row.paid,
      week2Paid: false,
      week3Paid: false,
      quarter1Paid: false,
    };
  }

  return {
    week1Paid: row.week1Paid === true,
    week2Paid: row.week2Paid === true,
    week3Paid: row.week3Paid === true,
    quarter1Paid: row.quarter1Paid === true,
  };
}

export function getDefaultPaymentStatusMap(): PaymentStatusMap {
  return { ...DEFAULT_PAYMENT_STATUS_BY_SLUG };
}

export function subscribePaymentStatusMap(onChange: (value: PaymentStatusMap) => void): Unsubscribe {
  const db = getFirestoreClient();
  if (!db) {
    onChange(getDefaultPaymentStatusMap());
    return () => {};
  }

  return onSnapshot(collection(db, PAYMENT_STATUS_COLLECTION), (snapshot) => {
    const nextMap: PaymentStatusMap = {
      ...DEFAULT_PAYMENT_STATUS_BY_SLUG,
    };

    for (const row of snapshot.docs) {
      nextMap[row.id] = parseStatusValue(row.data());
    }

    onChange(nextMap);
  });
}

export async function savePaymentStatusField(
  userSlug: string,
  field: PaymentStatusField,
  checked: boolean,
  actor: AuthSession
): Promise<void> {
  if (!actor.isAdmin) {
    throw new Error('Only admin users can update payment status.');
  }

  const db = getFirestoreClient();
  if (!db) {
    throw new Error('Firebase Firestore is not configured.');
  }

  const ref = doc(db, PAYMENT_STATUS_COLLECTION, userSlug);
  await setDoc(
    ref,
    {
      userSlug,
      userDisplayName: getTestUserName(userSlug) ?? userSlug,
      [field]: checked,
      updatedBySlug: actor.userSlug,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
