export interface TestUserOption {
  id: string;
  name: string;
}

export const TEST_USERS: TestUserOption[] = [
  { id: 'ben', name: 'Ben' },
  { id: 'yago', name: 'Yago' },
  { id: 'sam', name: 'Sam' },
  { id: 'jack', name: 'Jack' },
  { id: 'coach', name: 'Coach' },
  { id: 'ceec', name: 'Ceec' },
  { id: 'nick-london', name: 'Nick London' },
  { id: 'rohan', name: 'Rohan' },
  { id: 'uncle-neal', name: 'Uncle Neal' },
  { id: 'petruney', name: 'Petruney' },
  { id: 'sammy', name: 'Sammy' },
  { id: 'muncher', name: 'Muncher' },
  { id: 'abbo', name: 'Abbo' },
  { id: 'jake-d', name: 'Jake D' },
  { id: 'tibaudo', name: 'Tibaudo' },
  { id: 'eoin', name: 'Eoin' },
  { id: 'jay', name: 'Jay' },
  { id: 'murda', name: 'Murda' },
  { id: 'castronovo', name: 'Castronovo' },
  { id: 'dylan', name: 'Dylan' },
];

export const TEST_USER_NAME_BY_ID = Object.fromEntries(
  TEST_USERS.map((user) => [user.id, user.name])
) as Record<string, string>;

export function getTestUserName(userId: string | null | undefined): string | null {
  if (!userId) return null;
  return TEST_USER_NAME_BY_ID[userId] ?? null;
}

