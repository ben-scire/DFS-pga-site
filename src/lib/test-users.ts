export interface TestUserOption {
  id: string;
  name: string;
}

export const TEST_USERS: TestUserOption[] = [
  { id: 'wyaggy3', name: 'wyaggy3' },
  { id: 'abboduece22', name: 'abboduece22' },
  { id: 'mtibaudo', name: 'mtibaudo' },
  { id: 'johncastronovo', name: 'johncastronovo' },
  { id: 'cm30', name: 'cm30' },
  { id: 'rohansharma99', name: 'rohansharma99' },
  { id: 'jvaccari33', name: 'jvaccari33' },
  { id: 'sam.scire', name: 'sam.scire' },
  { id: 'capc', name: 'capc' },
  { id: 'boxmuncher', name: 'boxmuncher' },
  { id: 'jakdot2009', name: 'jakdot2009' },
  { id: 'dylangoody', name: 'dylangoody' },
  { id: 'samthemaam5', name: 'samthemaam5' },
  { id: 'tomlinsonj15', name: 'tomlinsonj15' },
  { id: 'jpetruney', name: 'jpetruney' },
  { id: 'bscire', name: 'bscire' },
];

export const TEST_USER_NAME_BY_ID = Object.fromEntries(
  TEST_USERS.map((user) => [user.id, user.name])
) as Record<string, string>;

export function getTestUserName(userId: string | null | undefined): string | null {
  if (!userId) return null;
  return TEST_USER_NAME_BY_ID[userId] ?? null;
}
