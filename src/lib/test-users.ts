import entryUsersRaw from '../../league-scoring/entry-users.json';

export interface TestUserOption {
  id: string;
  name: string;
}

interface EntryUserSourceRow {
  entryName: string;
  preferredName: string;
}

export interface TestUserDirectoryEntry {
  userSlug: string;
  entryName: string;
  alias: string;
}

const EXPECTED_TEST_USER_COUNT = 22;

function toUserSlug(entryName: string): string {
  return entryName.trim().toLowerCase().replace(/\s+/g, '-');
}

const ENTRY_USER_ROWS = entryUsersRaw as EntryUserSourceRow[];

export const TEST_USER_DIRECTORY: TestUserDirectoryEntry[] = ENTRY_USER_ROWS.map((row) => ({
  userSlug: toUserSlug(row.entryName),
  entryName: row.entryName.trim(),
  alias: row.preferredName.trim(),
}));

if (TEST_USER_DIRECTORY.length !== EXPECTED_TEST_USER_COUNT) {
  throw new Error(
    `Expected ${EXPECTED_TEST_USER_COUNT} users in league-scoring/entry-users.json, found ${TEST_USER_DIRECTORY.length}.`
  );
}

const uniqueUserSlugs = new Set(TEST_USER_DIRECTORY.map((row) => row.userSlug));
if (uniqueUserSlugs.size !== TEST_USER_DIRECTORY.length) {
  throw new Error('Duplicate usernames detected in league-scoring/entry-users.json.');
}

export const TEST_USERS: TestUserOption[] = TEST_USER_DIRECTORY.map((row) => ({
  id: row.userSlug,
  name: row.alias,
}));

export const TEST_USER_NAME_BY_ID = Object.fromEntries(
  TEST_USERS.map((user) => [user.id, user.name])
) as Record<string, string>;

export const TEST_USER_ID_SET = new Set(TEST_USERS.map((user) => user.id));
const TEST_USER_LOOKUP_BY_KEY = new Map<string, string>(
  TEST_USER_DIRECTORY.flatMap((user) => {
    const normalizedSlug = normalizeUserIdentifier(user.userSlug);
    const normalizedAlias = normalizeUserIdentifier(user.alias);
    const normalizedEntryName = normalizeUserIdentifier(user.entryName);
    return [
      [normalizedSlug, user.userSlug],
      [normalizedAlias, user.userSlug],
      [normalizedEntryName, user.userSlug],
    ] as const;
  })
);

const ADMIN_USER_SLUG_SET = new Set(['finsmaniac', 'bscire', 'dylangoody']);

function normalizeUserIdentifier(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’.]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function getTestUserName(userId: string | null | undefined): string | null {
  if (!userId) return null;
  return TEST_USER_NAME_BY_ID[userId] ?? null;
}

export function isTestUserId(userId: string | null | undefined): userId is string {
  if (!userId) return false;
  return TEST_USER_ID_SET.has(userId);
}

export function resolveTestUserSlugFromIdentifier(identifier: string | null | undefined): string | null {
  if (!identifier) return null;
  return TEST_USER_LOOKUP_BY_KEY.get(normalizeUserIdentifier(identifier)) ?? null;
}

export function isAdminUserSlug(userSlug: string | null | undefined): userSlug is string {
  if (!userSlug) return false;
  return ADMIN_USER_SLUG_SET.has(userSlug);
}
