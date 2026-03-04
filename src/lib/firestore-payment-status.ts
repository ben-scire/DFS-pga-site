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

export type PaymentStatusMap = Record<string, boolean>;

const PAYMENT_STATUS_COLLECTION = 'test_payment_status';

export function subscribePaymentStatusMap(onChange: (value: PaymentStatusMap) => void): Unsubscribe {
  const db = getFirestoreClient();
  if (!db) {
    onChange({});
    return () => {};
  }

  return onSnapshot(collection(db, PAYMENT_STATUS_COLLECTION), (snapshot) => {
    const nextMap: PaymentStatusMap = {};
    for (const row of snapshot.docs) {
      const data = row.data();
      nextMap[row.id] = data?.paid === true;
    }
    onChange(nextMap);
  });
}

export async function savePaymentStatus(userSlug: string, paid: boolean, actor: AuthSession): Promise<void> {
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
      paid,
      updatedByUid: actor.uid,
      updatedBySlug: actor.userSlug,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
