import { TEST_USERS } from './test-users';
import { normalizeNameForMatching } from './contest-standings-import';

const ENTRY_NAME_TO_TEST_USER_SLUG: Record<string, string> = {
  // Keep empty by default; current test users intentionally match CSV entry names.
};

const TEST_USERS_BY_SLUG = new Map(TEST_USERS.map((user) => [user.id, user]));

const TEST_USER_MATCH_KEYS = TEST_USERS.flatMap((user) => {
  const normalizedName = normalizeNameForMatching(user.name);
  const normalizedSlug = normalizeNameForMatching(user.id);
  return [
    [normalizedName, user.id],
    [normalizedSlug, user.id],
  ] as const;
});

const TEST_USER_SLUG_BY_MATCH_KEY = new Map(TEST_USER_MATCH_KEYS);

export interface ResolvedTestUser {
  userSlug: string;
  userDisplayName: string;
  source: 'alias' | 'exact';
}

export function resolveTestUserFromEntryName(entryName: string): ResolvedTestUser | null {
  const alias = ENTRY_NAME_TO_TEST_USER_SLUG[entryName.trim().toLowerCase()];
  if (alias) {
    const user = TEST_USERS_BY_SLUG.get(alias);
    if (!user) return null;
    return {
      userSlug: user.id,
      userDisplayName: user.name,
      source: 'alias',
    };
  }

  const normalized = normalizeNameForMatching(entryName);
  const exactSlug = TEST_USER_SLUG_BY_MATCH_KEY.get(normalized);
  if (!exactSlug) return null;

  const user = TEST_USERS_BY_SLUG.get(exactSlug);
  if (!user) return null;

  return {
    userSlug: user.id,
    userDisplayName: user.name,
    source: 'exact',
  };
}

export function getKnownEntryToUserAliases() {
  return { ...ENTRY_NAME_TO_TEST_USER_SLUG };
}
