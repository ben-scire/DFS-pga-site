import { initialContestData } from '@/lib/mock-data';
import type { ContestData, Golfer, Player } from '@/lib/types';

interface DfsApiConfig {
  baseUrl: string;
  contestId: string;
  apiPathTemplate: string;
  streamPathTemplate: string;
  apiKey?: string;
  apiKeyHeader: string;
  refreshIntervalMs: number;
  useMockFallback: boolean;
}

interface GenericObject {
  [key: string]: unknown;
}

const DEFAULT_REFRESH_MS = 60_000;
const DEFAULT_API_PATH_TEMPLATE = '/contests/{contestId}/live';
const DEFAULT_STREAM_PATH_TEMPLATE = '/contests/{contestId}/stream';

export function getDfsApiConfig(): DfsApiConfig {
  return {
    baseUrl: (process.env.NEXT_PUBLIC_DFS_API_BASE_URL || '').trim(),
    contestId: (process.env.NEXT_PUBLIC_DFS_CONTEST_ID || '').trim(),
    apiPathTemplate:
      (process.env.NEXT_PUBLIC_DFS_API_PATH || DEFAULT_API_PATH_TEMPLATE).trim(),
    streamPathTemplate:
      (process.env.NEXT_PUBLIC_DFS_STREAM_PATH || DEFAULT_STREAM_PATH_TEMPLATE).trim(),
    apiKey: (process.env.NEXT_PUBLIC_DFS_API_KEY || '').trim() || undefined,
    apiKeyHeader:
      (process.env.NEXT_PUBLIC_DFS_API_KEY_HEADER || 'x-api-key').trim(),
    refreshIntervalMs: parsePositiveInteger(
      process.env.NEXT_PUBLIC_DFS_REFRESH_MS,
      DEFAULT_REFRESH_MS
    ),
    useMockFallback: parseBoolean(
      process.env.NEXT_PUBLIC_USE_MOCK_FALLBACK,
      true
    ),
  };
}

export async function getContestData(): Promise<ContestData> {
  const config = getDfsApiConfig();
  if (!config.baseUrl) {
    return withFallback(config, new Error('NEXT_PUBLIC_DFS_API_BASE_URL is not configured.'));
  }

  try {
    const liveData = await fetchLiveContestData(config);
    if (!liveData.players.length || !liveData.golfers.length) {
      return withFallback(
        config,
        new Error('DFS API returned no players or golfers for the configured contest.')
      );
    }
    return liveData;
  } catch (error) {
    return withFallback(
      config,
      error instanceof Error ? error : new Error('DFS API request failed.')
    );
  }
}

async function fetchLiveContestData(config: DfsApiConfig): Promise<ContestData> {
  const url = getContestUrl(config);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (config.apiKey) {
      headers[config.apiKeyHeader] = config.apiKey;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`DFS API request failed (${response.status} ${response.statusText})`);
    }

    const payload = await response.json();
    return normalizeContestPayload(payload);
  } finally {
    clearTimeout(timeout);
  }
}

function getContestUrl(config: DfsApiConfig): string {
  return getPathUrl(config, config.apiPathTemplate);
}

export function getContestStreamUrl(): string | null {
  const config = getDfsApiConfig();
  if (!config.baseUrl) return null;
  try {
    return getPathUrl(config, config.streamPathTemplate);
  } catch {
    return null;
  }
}

export function normalizeContestPayload(payload: unknown): ContestData {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('DFS payload is not a valid JSON object.');
  }
  return normalizeContestData(payload as GenericObject);
}

function getPathUrl(config: DfsApiConfig, templateInput: string): string {
  const base = config.baseUrl.replace(/\/+$/, '');
  const template = templateInput || DEFAULT_API_PATH_TEMPLATE;
  if (template.includes('{contestId}') && !config.contestId) {
    throw new Error(
      'NEXT_PUBLIC_DFS_CONTEST_ID is required because DFS path contains {contestId}.'
    );
  }
  const path = template.includes('{contestId}')
    ? template.replace('{contestId}', encodeURIComponent(config.contestId))
    : template;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

function normalizeContestData(payload: GenericObject): ContestData {
  const golfersRaw = (readArray(payload, 'golfers') ||
    readArray(payload, 'playersPool') ||
    readArray(payload, 'athletes') ||
    []) as GenericObject[];

  const playersRaw = (readArray(payload, 'players') ||
    readArray(payload, 'entries') ||
    readArray(payload, 'leaderboard') ||
    []) as GenericObject[];

  const golfers = golfersRaw.map(normalizeGolfer).filter(Boolean) as Golfer[];
  const golfersById = new Map(golfers.map((golfer) => [golfer.id, golfer]));

  const players = playersRaw
    .map((rawPlayer) => normalizePlayer(rawPlayer, golfersById))
    .filter(Boolean) as Player[];

  return { golfers, players };
}

function normalizeGolfer(raw: GenericObject): Golfer | null {
  const id = readNumber(raw, 'id') ?? readNumber(raw, 'playerId');
  const name = readString(raw, 'name') ?? readString(raw, 'fullName');
  if (id === null || !name) return null;

  const total = readNumber(raw, 'total') ?? readNumber(raw, 'scoreToPar') ?? 0;
  const thru =
    readString(raw, 'thru') ??
    readString(raw, 'status') ??
    readString(raw, 'holesCompleted') ??
    '-';
  const position =
    readString(raw, 'position') ??
    readString(raw, 'rank') ??
    readString(raw, 'standing') ??
    '-';
  const fantasyPoints =
    readNumber(raw, 'fantasyPoints') ??
    readNumber(raw, 'points') ??
    readNumber(raw, 'dkPoints') ??
    0;
  const ownership = readNumber(raw, 'ownership') ?? readNumber(raw, 'ownershipPct') ?? 0;
  const imageUrl =
    readString(raw, 'imageUrl') ??
    readString(raw, 'headshotUrl') ??
    'https://placehold.co/96x96/png';

  const rounds = (readObject(raw, 'rounds') || {}) as GenericObject;
  const r1 = readString(rounds, 'r1') ?? readString(raw, 'r1') ?? '-';
  const r2 = readString(rounds, 'r2') ?? readString(raw, 'r2') ?? '-';
  const r3 = readString(rounds, 'r3') ?? readString(raw, 'r3') ?? '-';

  return {
    id,
    name,
    total,
    thru,
    position,
    fantasyPoints,
    ownership,
    imageUrl,
    r1,
    r2,
    r3,
  };
}

function normalizePlayer(raw: GenericObject, golfersById: Map<number, Golfer>): Player | null {
  const id = readNumber(raw, 'id') ?? readNumber(raw, 'entryId');
  const name = readString(raw, 'name') ?? readString(raw, 'entryName');
  if (id === null || !name) return null;

  const lineupIds =
    readNumberArray(raw, 'lineupGolferIds') ||
    readNumberArray(raw, 'lineup') ||
    readNestedLineupIds(raw, 'lineup') ||
    [];
  const lineup = lineupIds
    .map((golferId) => golfersById.get(golferId))
    .filter(Boolean) as Golfer[];

  return {
    id,
    name,
    lineup,
    prize: readNumber(raw, 'prize') ?? readNumber(raw, 'winnings') ?? 0,
    phr: readNumber(raw, 'phr') ?? readNumber(raw, 'entriesRemaining') ?? 0,
  };
}

function withFallback(config: DfsApiConfig, sourceError: Error): ContestData {
  if (config.useMockFallback) {
    return initialContestData;
  }
  throw sourceError;
}

function readArray(obj: GenericObject, key: string): unknown[] | null {
  const value = obj[key];
  return Array.isArray(value) ? value : null;
}

function readObject(obj: GenericObject, key: string): GenericObject | null {
  const value = obj[key];
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as GenericObject)
    : null;
}

function readString(obj: GenericObject, key: string): string | null {
  const value = obj[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readNumber(obj: GenericObject, key: string): number | null {
  const value = obj[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readNumberArray(obj: GenericObject, key: string): number[] | null {
  const value = obj[key];
  if (!Array.isArray(value)) return null;
  return value
    .map((item) => {
      if (typeof item === 'number' && Number.isFinite(item)) return item;
      if (typeof item === 'string') {
        const parsed = Number(item);
        if (Number.isFinite(parsed)) return parsed;
      }
      return null;
    })
    .filter((item): item is number => item !== null);
}

function readNestedLineupIds(obj: GenericObject, key: string): number[] | null {
  const value = obj[key];
  if (!Array.isArray(value)) return null;

  const ids = value
    .map((item) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const asObject = item as GenericObject;
        return readNumber(asObject, 'id') ?? readNumber(asObject, 'playerId');
      }
      return null;
    })
    .filter((item): item is number => item !== null);

  return ids.length ? ids : null;
}

function parseBoolean(raw: string | undefined, fallback: boolean): boolean {
  if (!raw) return fallback;
  const lowered = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(lowered)) return true;
  if (['0', 'false', 'no', 'off'].includes(lowered)) return false;
  return fallback;
}

function parsePositiveInteger(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
