import type { PersistedLineupEntry, PlayerPoolGolfer } from '@/lib/lineup-builder-types';

function isBrowser() {
  return typeof window !== 'undefined';
}

function playerPoolKey(contestId: string) {
  return `5x5:player-pool:${contestId}`;
}

function lineupKey(contestId: string, userKey: string) {
  return `5x5:lineup:${contestId}:${userKey}`;
}

export function loadImportedPlayerPool(contestId: string): PlayerPoolGolfer[] | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(playerPoolKey(contestId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PlayerPoolGolfer[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveImportedPlayerPool(contestId: string, golfers: PlayerPoolGolfer[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(playerPoolKey(contestId), JSON.stringify(golfers));
}

export function clearImportedPlayerPool(contestId: string) {
  if (!isBrowser()) return;
  window.localStorage.removeItem(playerPoolKey(contestId));
}

export function loadPersistedLineup(contestId: string, userKey: string): PersistedLineupEntry | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(lineupKey(contestId, userKey));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PersistedLineupEntry;
  } catch {
    return null;
  }
}

export function savePersistedLineup(entry: PersistedLineupEntry) {
  if (!isBrowser()) return;
  window.localStorage.setItem(lineupKey(entry.contestId, entry.userKey), JSON.stringify(entry));
}
