import { getTestUserName, isAdminUserSlug, isTestUserId, resolveTestUserSlugFromIdentifier } from '@/lib/test-users';

export type Unsubscribe = () => void;

export interface AuthSession {
  uid: string;
  userSlug: string;
  userDisplayName: string;
  isAdmin: boolean;
}

type LocalSessionState = {
  userSlug: string;
};

type PasswordStore = Record<string, string>;

const SESSION_STORAGE_KEY = '5x5.local-auth.session';
const PASSWORD_STORAGE_KEY = '5x5.local-auth.passwords';
const MIN_PASSWORD_LENGTH = 1;

const listeners = new Set<(session: AuthSession | null) => void>();
let storageListenerAttached = false;

function safeParseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function toAuthSession(userSlug: string): AuthSession {
  return {
    uid: `local:${userSlug}`,
    userSlug,
    userDisplayName: getTestUserName(userSlug) ?? userSlug,
    isAdmin: isAdminUserSlug(userSlug),
  };
}

function readPasswordStore(): PasswordStore {
  if (!canUseStorage()) return {};
  const parsed = safeParseJson<PasswordStore>(window.localStorage.getItem(PASSWORD_STORAGE_KEY));
  if (!parsed || typeof parsed !== 'object') return {};

  const next: PasswordStore = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (isTestUserId(key) && typeof value === 'string') {
      next[key] = value;
    }
  }
  return next;
}

function writePasswordStore(store: PasswordStore): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(PASSWORD_STORAGE_KEY, JSON.stringify(store));
}

function readSessionState(): LocalSessionState | null {
  if (!canUseStorage()) return null;
  const parsed = safeParseJson<LocalSessionState>(window.localStorage.getItem(SESSION_STORAGE_KEY));
  if (!parsed || typeof parsed.userSlug !== 'string') return null;
  if (!isTestUserId(parsed.userSlug)) return null;
  return parsed;
}

function writeSessionState(session: LocalSessionState | null): void {
  if (!canUseStorage()) return;
  if (!session) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

function readCurrentSession(): AuthSession | null {
  const state = readSessionState();
  if (!state) return null;
  return toAuthSession(state.userSlug);
}

function notifyListeners(): void {
  const session = readCurrentSession();
  for (const listener of listeners) {
    listener(session);
  }
}

function ensureStorageListener(): void {
  if (storageListenerAttached || typeof window === 'undefined') return;
  window.addEventListener('storage', (event) => {
    if (event.key === SESSION_STORAGE_KEY || event.key === PASSWORD_STORAGE_KEY) {
      notifyListeners();
    }
  });
  storageListenerAttached = true;
}

function validateCredentials(usernameOrAlias: string, password: string): string {
  const userSlug = resolveTestUserSlugFromIdentifier(usernameOrAlias);
  if (!userSlug || !isTestUserId(userSlug)) {
    throw new Error('Username or alias is not approved for this league.');
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error('Password is required.');
  }
  return userSlug;
}

export async function signInOrFirstClaim(usernameOrAlias: string, password: string): Promise<AuthSession> {
  const userSlug = validateCredentials(usernameOrAlias, password);

  const store = readPasswordStore();
  const existingPassword = store[userSlug];

  if (existingPassword && existingPassword !== password) {
    throw new Error('Incorrect password.');
  }

  if (!existingPassword) {
    store[userSlug] = password;
    writePasswordStore(store);
  }

  writeSessionState({ userSlug });
  notifyListeners();

  return toAuthSession(userSlug);
}

export async function getCurrentAuthSession(): Promise<AuthSession | null> {
  return readCurrentSession();
}

export function subscribeAuthSession(onSession: (session: AuthSession | null) => void): Unsubscribe {
  listeners.add(onSession);
  ensureStorageListener();
  onSession(readCurrentSession());

  return () => {
    listeners.delete(onSession);
  };
}

export async function signOutAuthSession(): Promise<void> {
  writeSessionState(null);
  notifyListeners();
}
