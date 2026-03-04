import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type Unsubscribe,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFirebaseAuthClient, getFirestoreClient } from '@/lib/firebase-client';
import {
  getTestUserName,
  isAdminUserSlug,
  isTestUserId,
  resolveTestUserSlugFromIdentifier,
} from '@/lib/test-users';

const AUTH_EMAIL_DOMAIN = '5x5.local';

export interface AuthSession {
  uid: string;
  userSlug: string;
  userDisplayName: string;
  isAdmin: boolean;
}

export function getAuthEmailFromUsername(username: string): string {
  return `${username.trim().toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;
}

export function getUsernameFromAuthEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const [localPart, domain] = email.toLowerCase().split('@');
  if (!localPart || domain !== AUTH_EMAIL_DOMAIN) return null;
  return localPart;
}

function validateCredentials(username: string, password: string): string {
  const userSlug = resolveTestUserSlugFromIdentifier(username);
  if (!userSlug || !isTestUserId(userSlug)) {
    throw new Error('Username or alias is not approved for this league.');
  }
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }
  return userSlug;
}

async function ensureProfile(uid: string, userSlug: string) {
  const db = getFirestoreClient();
  if (!db) {
    throw new Error('Firebase Firestore is not configured.');
  }

  const ref = doc(db, 'test_users', uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const existingSlug = typeof snap.data().userSlug === 'string' ? snap.data().userSlug : null;
    if (existingSlug && existingSlug !== userSlug) {
      throw new Error('Account username mapping mismatch. Contact admin.');
    }
  }

  await setDoc(
    ref,
    {
      uid,
      userSlug,
      updatedAt: serverTimestamp(),
      createdAt: snap.exists() ? snap.data().createdAt ?? serverTimestamp() : serverTimestamp(),
    },
    { merge: true }
  );
}

function normalizeAuthError(error: unknown): Error {
  if (!(error instanceof Error)) return new Error('Authentication failed.');
  const code = (error as { code?: string }).code ?? '';

  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
    return new Error('Incorrect password.');
  }
  if (code === 'auth/too-many-requests') {
    return new Error('Too many attempts. Try again in a few minutes.');
  }
  if (code === 'auth/network-request-failed') {
    return new Error('Network error while signing in.');
  }
  return error;
}

export async function signInOrFirstClaim(username: string, password: string): Promise<AuthSession> {
  const auth = getFirebaseAuthClient();
  if (!auth) {
    throw new Error('Firebase Auth is not configured.');
  }

  const userSlug = validateCredentials(username, password);
  const email = getAuthEmailFromUsername(userSlug);

  try {
    const signedIn = await signInWithEmailAndPassword(auth, email, password);
    await ensureProfile(signedIn.user.uid, userSlug);
    return {
      uid: signedIn.user.uid,
      userSlug,
      userDisplayName: getTestUserName(userSlug) ?? userSlug,
      isAdmin: isAdminUserSlug(userSlug),
    };
  } catch (error) {
    const code = (error as { code?: string }).code ?? '';
    if (code !== 'auth/user-not-found') {
      throw normalizeAuthError(error);
    }
  }

  try {
    const created = await createUserWithEmailAndPassword(auth, email, password);
    await ensureProfile(created.user.uid, userSlug);
    return {
      uid: created.user.uid,
      userSlug,
      userDisplayName: getTestUserName(userSlug) ?? userSlug,
      isAdmin: isAdminUserSlug(userSlug),
    };
  } catch (error) {
    throw normalizeAuthError(error);
  }
}

export async function getCurrentAuthSession(): Promise<AuthSession | null> {
  const auth = getFirebaseAuthClient();
  if (!auth?.currentUser) return null;
  const userSlug = getUsernameFromAuthEmail(auth.currentUser.email);
  if (!isTestUserId(userSlug)) return null;
  return {
    uid: auth.currentUser.uid,
    userSlug,
    userDisplayName: getTestUserName(userSlug) ?? userSlug,
    isAdmin: isAdminUserSlug(userSlug),
  };
}

export function subscribeAuthSession(onSession: (session: AuthSession | null) => void): Unsubscribe {
  const auth = getFirebaseAuthClient();
  if (!auth) {
    onSession(null);
    return () => {};
  }

  return onAuthStateChanged(auth, (user) => {
    if (!user) {
      onSession(null);
      return;
    }

    const userSlug = getUsernameFromAuthEmail(user.email);
    if (!isTestUserId(userSlug)) {
      onSession(null);
      return;
    }

    onSession({
      uid: user.uid,
      userSlug,
      userDisplayName: getTestUserName(userSlug) ?? userSlug,
      isAdmin: isAdminUserSlug(userSlug),
    });
  });
}

export async function signOutAuthSession(): Promise<void> {
  const auth = getFirebaseAuthClient();
  if (!auth) return;
  await signOut(auth);
}
