export interface TestUserOption {
  id: string;
  name: string;
}

export const TEST_USERS: TestUserOption[] = [
  { id: 'wyaggy3', name: 'Yaggy' },
  { id: 'abboduece22', name: 'Abbo' },
  { id: 'mtibaudo', name: 'Tibaudo' },
  { id: 'johncastronovo', name: 'Castronovo' },
  { id: 'cm30', name: 'Murph' },
  { id: 'rohansharma99', name: 'Rohan' },
  { id: 'jvaccari33', name: 'Vaccari' },
  { id: 'sam.scire', name: 'Sam S' },
  { id: 'capc', name: 'CC' },
  { id: 'boxmuncher', name: 'Hank' },
  { id: 'jakdot2009', name: 'Jake D' },
  { id: 'dylangoody', name: 'Dylan' },
  { id: 'samthemaam5', name: 'Sam L' },
  { id: 'tomlinsonj15', name: 'Jay' },
  { id: 'jpetruney', name: 'Petruney' },
  { id: 'bscire', name: 'Ben' },
  { id: 'jake', name: 'Coach Lehman' },
  { id: 'eions', name: 'Eoin' },
  { id: 'unccle-neal', name: 'Uncle Neal' },
  { id: 'finsmaniac', name: 'Fins' },
];

export const TEST_USER_NAME_BY_ID = Object.fromEntries(
  TEST_USERS.map((user) => [user.id, user.name])
) as Record<string, string>;

export const TEST_USER_ID_SET = new Set(TEST_USERS.map((user) => user.id));
const TEST_USER_LOOKUP_BY_KEY = new Map<string, string>(
  TEST_USERS.flatMap((user) => {
    const normalizedSlug = normalizeUserIdentifier(user.id);
    const normalizedName = normalizeUserIdentifier(user.name);
    return [
      [normalizedSlug, user.id],
      [normalizedName, user.id],
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
