import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { config as loadDotenv } from 'dotenv';
import { applicationDefault, cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { normalizeNameForMatching } from '../src/lib/contest-standings-import';
import { getDefaultPlayerPool, getWeeklyContestById } from '../src/lib/weekly-lineup-seed';

type DfsScoringMode = 'dfs-rules' | 'hybrid' | 'upstream';

type CliOptions = {
  contestId: string;
  once: boolean;
  dryRun: boolean;
  intervalMs: number;
  scoringMode: DfsScoringMode;
  urlOverride?: string;
};

type GenericRow = Record<string, unknown>;

type NormalizedLiveRow = {
  playerName: string;
  position?: string;
  livePositionPoints?: number;
  scoreToPar?: string | number;
  thru?: string | number;
  today?: string | number;
  status?: string;
  upstreamFantasyPoints?: number;
  scorecardFantasyPoints?: number;
  activeRoundNumber?: number;
  activeRoundHoles?: number;
  rawRow: GenericRow;
};

const DEFAULT_INTERVAL_MS = 30_000;
const DEFAULT_SCORING_MODE: DfsScoringMode = 'dfs-rules';

async function main() {
  loadEnvFiles();
  const options = parseArgs(process.argv.slice(2));
  const contest = getWeeklyContestById(options.contestId);
  const playerPool = getDefaultPlayerPool(options.contestId);

  if (!contest) {
    throw new Error(`Unknown contestId "${options.contestId}".`);
  }
  if (!playerPool.length) {
    throw new Error(`No seeded player pool found for contest "${options.contestId}".`);
  }

  const liveUrl = buildLiveUrl(options.urlOverride);
  const golfersByName = buildGolferLookup(playerPool);
  const golfersByLastName = buildGolferLastNameLookup(playerPool);

  if (!options.dryRun) {
    initFirebaseAdmin();
  }

  console.log(`Contest: ${contest.name}`);
  console.log(`Live URL: ${redactUrl(liveUrl)}`);
  console.log(
    `Mode: ${options.dryRun ? 'dry-run' : 'write'}${options.once ? ' (once)' : ` (poll every ${options.intervalMs}ms)`} | scoring=${options.scoringMode}`
  );

  do {
    const startMs = Date.now();
    try {
      const syncResult = await syncOnce({
        liveUrl,
        contestId: options.contestId,
        golfersByName,
        golfersByLastName,
        scoringMode: options.scoringMode,
        dryRun: options.dryRun,
      });

      const elapsed = Date.now() - startMs;
      console.log(
        `[${new Date().toISOString()}] matched=${syncResult.matched} unmatched=${syncResult.unmatched} totalRows=${syncResult.totalRows} wrote=${syncResult.wrote} rules=${syncResult.scoredByRules} upstream=${syncResult.scoredByUpstream} none=${syncResult.withoutFantasyPoints} (${elapsed}ms)`
      );
      if (syncResult.unmatchedExamples.length) {
        console.log(`  Unmatched examples: ${syncResult.unmatchedExamples.join(' | ')}`);
      }
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] Sync failed: ${error instanceof Error ? error.message : String(error)}`
      );
      if (options.once) {
        process.exitCode = 1;
        return;
      }
    }

    if (!options.once) {
      await delay(options.intervalMs);
    }
  } while (!options.once);
}

async function syncOnce(input: {
  liveUrl: string;
  contestId: string;
  golfersByName: Map<string, { golferId: string; canonicalName: string }>;
  golfersByLastName: Map<string, Array<{ golferId: string; canonicalName: string }>>;
  scoringMode: DfsScoringMode;
  dryRun: boolean;
}) {
  const response = await fetch(input.liveUrl, {
    method: 'GET',
    headers: {
      Accept: 'application/json, text/csv;q=0.9, */*;q=0.8',
      'User-Agent': '5x5-studio-live-sync/1.0',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Upstream request failed (${response.status} ${response.statusText})`);
  }

  const rawBody = await response.text();
  const primaryRows = parseUpstreamRows(rawBody, response.headers.get('content-type'));
  const rows = await mergeTournamentStatsRows(input.liveUrl, primaryRows);
  const normalizedRows = rows.map(normalizeLiveRow).filter((row): row is NormalizedLiveRow => Boolean(row));
  const annotatedRows = annotateRoundStates(normalizedRows);
  const scoredRows = applyLivePositionPoints(annotatedRows);

  const db = input.dryRun ? null : getFirestore();
  let matched = 0;
  let wrote = 0;
  let unmatched = 0;
  let scoredByRules = 0;
  let scoredByUpstream = 0;
  let withoutFantasyPoints = 0;
  const unmatchedExamples: string[] = [];

  for (const row of scoredRows) {
    const golfer = resolveGolferFromLiveName(
      row.playerName,
      input.golfersByName,
      input.golfersByLastName
    );
    if (!golfer) {
      unmatched += 1;
      if (unmatchedExamples.length < 5) {
        unmatchedExamples.push(row.playerName);
      }
      continue;
    }

    matched += 1;
    const fantasy = resolveFantasyPoints(row, input.scoringMode);
    if (fantasy.source === 'dfs-rules') scoredByRules += 1;
    if (fantasy.source === 'upstream') scoredByUpstream += 1;
    if (fantasy.source === 'none') withoutFantasyPoints += 1;

    if (input.dryRun || !db) {
      continue;
    }

    await db
      .collection('test_scores')
      .doc(input.contestId)
      .collection('golfers')
      .doc(golfer.golferId)
      .set(
        {
          contestId: input.contestId,
          golferId: golfer.golferId,
          ...(row.position !== undefined ? { position: row.position } : {}),
          ...(row.scoreToPar !== undefined ? { scoreToPar: row.scoreToPar } : {}),
          ...(row.thru !== undefined ? { thru: row.thru } : {}),
          ...(row.today !== undefined ? { today: row.today } : {}),
          ...(row.status !== undefined ? { status: row.status } : {}),
          ...(typeof fantasy.value === 'number' ? { fantasyPoints: fantasy.value } : { fantasyPoints: null }),
          scoringSource: fantasy.source,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    wrote += 1;
  }

  return {
    totalRows: scoredRows.length,
    matched,
    unmatched,
    unmatchedExamples,
    scoredByRules,
    scoredByUpstream,
    withoutFantasyPoints,
    wrote,
  };
}

function loadEnvFiles() {
  loadDotenv({ path: path.resolve(process.cwd(), '.env.local') });
  loadDotenv({ path: path.resolve(process.cwd(), '.env') });
}

function parseArgs(argv: string[]): CliOptions {
  let contestId = (process.env.DATAGOLF_CONTEST_ID || '').trim() || 'week-2-arnold-palmer';
  let once = false;
  let dryRun = false;
  let intervalMs = parsePositiveInt(process.env.DATAGOLF_POLL_INTERVAL_MS, DEFAULT_INTERVAL_MS);
  let scoringMode = parseScoringMode(process.env.DATAGOLF_SCORING_MODE);
  let urlOverride: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--contest-id') {
      contestId = argv[index + 1] ?? contestId;
      index += 1;
      continue;
    }
    if (arg === '--once') {
      once = true;
      continue;
    }
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (arg === '--interval-ms') {
      intervalMs = parsePositiveInt(argv[index + 1], intervalMs);
      index += 1;
      continue;
    }
    if (arg === '--scoring-mode') {
      scoringMode = parseScoringMode(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--url') {
      urlOverride = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { contestId, once, dryRun, intervalMs, scoringMode, urlOverride };
}

function printHelp() {
  console.log(`Poll a Data Golf live endpoint and write Firestore test_scores docs.

Usage:
  tsx scripts/sync-datagolf-live-scores.ts [--contest-id week-2-arnold-palmer] [--once] [--dry-run] [--scoring-mode dfs-rules]
  tsx scripts/sync-datagolf-live-scores.ts --url "https://..." --once --dry-run

Env (required unless --url is provided):
  DATAGOLF_CONTEST_ID      Contest id to write into Firestore (default: week-2-arnold-palmer)
  DATAGOLF_LIVE_URL        Full upstream URL. Supports {key} placeholder.
  DATAGOLF_API_KEY         Optional; substituted into DATAGOLF_LIVE_URL when {key} is present.
  DATAGOLF_POLL_INTERVAL_MS  Poll interval (default 30000)
  DATAGOLF_SCORING_MODE    dfs-rules (default: dfs-rules)
  DATAGOLF_TOURNAMENT_STATS_URL Optional endpoint for position/total/thru enrichment.

Firebase Admin auth (required for writes, not for --dry-run):
  FIREBASE_SERVICE_ACCOUNT_JSON   Raw service account JSON string
  or GOOGLE_APPLICATION_CREDENTIALS path
`);
}

function buildLiveUrl(urlOverride?: string): string {
  const raw = (urlOverride ?? process.env.DATAGOLF_LIVE_URL ?? '').trim();
  if (!raw) {
    throw new Error('Missing live feed URL. Set DATAGOLF_LIVE_URL or pass --url.');
  }
  return resolveDataGolfUrl(raw);
}

function resolveDataGolfUrl(raw: string): string {
  const apiKey = (process.env.DATAGOLF_API_KEY ?? '').trim();
  if (raw.includes('{key}')) {
    if (!apiKey) {
      throw new Error('Data Golf URL contains {key} but DATAGOLF_API_KEY is missing.');
    }
    return raw.replaceAll('{key}', encodeURIComponent(apiKey));
  }
  return raw;
}

function buildTournamentStatsUrl(liveUrl: string): string | null {
  const override = (process.env.DATAGOLF_TOURNAMENT_STATS_URL ?? '').trim();
  if (override) {
    return resolveDataGolfUrl(override);
  }

  if (liveUrl.includes('live-hole-scores')) {
    return liveUrl.replace('live-hole-scores', 'live-tournament-stats');
  }
  return null;
}

function initFirebaseAdmin() {
  if (getApps().length) {
    return getApp();
  }

  const rawJson = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? '').trim();
  if (rawJson) {
    const serviceAccount = JSON.parse(rawJson) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };
    if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is missing required fields.');
    }
    return initializeApp({
      credential: cert({
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key,
      }),
    });
  }

  return initializeApp({
    credential: applicationDefault(),
  });
}

function buildGolferLookup(
  playerPool: ReturnType<typeof getDefaultPlayerPool>
): Map<string, { golferId: string; canonicalName: string }> {
  const map = new Map<string, { golferId: string; canonicalName: string }>();

  for (const golfer of playerPool) {
    const keys = buildNameKeys(golfer.name);
    for (const key of keys) {
      if (!key) continue;
      map.set(key, { golferId: golfer.golferId, canonicalName: golfer.name });
    }
  }

  return map;
}

function buildGolferLastNameLookup(
  playerPool: ReturnType<typeof getDefaultPlayerPool>
): Map<string, Array<{ golferId: string; canonicalName: string }>> {
  const map = new Map<string, Array<{ golferId: string; canonicalName: string }>>();

  for (const golfer of playerPool) {
    const [first, ...rest] = normalizeNameForMatching(golfer.name).split(' ').filter(Boolean);
    if (!first || !rest.length) continue;
    const last = rest[rest.length - 1];
    const list = map.get(last) ?? [];
    list.push({ golferId: golfer.golferId, canonicalName: golfer.name });
    map.set(last, list);
  }

  return map;
}

function resolveGolferFromLiveName(
  liveName: string,
  golfersByName: Map<string, { golferId: string; canonicalName: string }>,
  golfersByLastName: Map<string, Array<{ golferId: string; canonicalName: string }>>
) {
  const directKeys = buildNameKeys(liveName);
  for (const key of directKeys) {
    const exact = golfersByName.get(key);
    if (exact) return exact;
  }

  const parsed = parseFirstLastName(liveName);
  if (!parsed) return null;
  const candidates = golfersByLastName.get(parsed.last) ?? [];
  if (!candidates.length) return null;
  const matchedCandidates = candidates.filter((candidate) => {
    const firstCandidate = parseFirstLastName(candidate.canonicalName)?.first;
    if (!firstCandidate) return false;
    return firstNamesAppearCompatible(parsed.first, firstCandidate);
  });

  if (matchedCandidates.length === 1) {
    return matchedCandidates[0];
  }

  return null;
}

function buildNameKeys(input: string): string[] {
  const keys = new Set<string>([
    normalizeNameForMatching(input),
    normalizeNameForMatching(input.replace(/-/g, ' ')),
    normalizeNameForMatching(input.replace(/\./g, '')),
  ]);

  const parsed = parseFirstLastName(input);
  if (parsed) {
    keys.add(`${parsed.first} ${parsed.last}`.trim());
    keys.add(`${parsed.last} ${parsed.first}`.trim());
  }

  return [...keys].filter(Boolean);
}

function parseFirstLastName(input: string): { first: string; last: string } | null {
  if (input.includes(',')) {
    const [lastRaw, ...restRaw] = input.split(',');
    const last = stripSuffixes(normalizeNameForMatching(lastRaw));
    const first = normalizeNameForMatching(restRaw.join(' '));
    if (!first || !last) return null;
    return {
      first,
      last,
    };
  }

  const normalized = normalizeNameForMatching(input);
  const parts = normalized.split(' ').filter(Boolean);
  if (parts.length < 2) return null;
  if (isSuffixToken(parts[parts.length - 1]) && parts.length >= 3) {
    const trimmed = parts.slice(0, -1);
    return {
      first: trimmed.slice(0, -1).join(' '),
      last: trimmed[trimmed.length - 1],
    };
  }
  return {
    first: parts.slice(0, -1).join(' '),
    last: stripSuffixes(parts[parts.length - 1]),
  };
}

function compactNamePart(value: string): string {
  return normalizeNameForMatching(value).replace(/\s+/g, '');
}

function firstNamesAppearCompatible(liveFirst: string, candidateFirst: string): boolean {
  const liveCompact = compactNamePart(liveFirst);
  const candidateCompact = compactNamePart(candidateFirst);
  if (!liveCompact || !candidateCompact) return false;
  if (liveCompact === candidateCompact) return true;

  const liveIsInitialish = isInitialishName(liveFirst);
  const candidateIsInitialish = isInitialishName(candidateFirst);
  if (liveIsInitialish || candidateIsInitialish) {
    return initials(liveFirst) === initials(candidateFirst);
  }

  return candidateCompact.startsWith(liveCompact) || liveCompact.startsWith(candidateCompact);
}

function isInitialishName(value: string): boolean {
  const parts = normalizeNameForMatching(value).split(' ').filter(Boolean);
  if (!parts.length) return false;
  return parts.every((part) => part.length === 1);
}

function initials(value: string): string {
  const parts = normalizeNameForMatching(value).split(' ').filter(Boolean);
  return parts.map((part) => part[0] ?? '').join('');
}

function stripSuffixes(value: string): string {
  const tokens = value.split(' ').filter(Boolean);
  while (tokens.length > 1 && isSuffixToken(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  return tokens.join(' ');
}

function isSuffixToken(token: string): boolean {
  return ['jr', 'sr', 'ii', 'iii', 'iv', 'v'].includes(token);
}

function parseUpstreamRows(body: string, contentType: string | null): GenericRow[] {
  const looksLikeCsv =
    (contentType ?? '').toLowerCase().includes('csv') ||
    (/^[^{}\[\n]+,[^{}\[\n]+/m.test(body) && !body.trimStart().startsWith('{') && !body.trimStart().startsWith('['));

  if (looksLikeCsv) {
    return parseCsvRows(body);
  }

  const json = JSON.parse(body) as unknown;
  if (Array.isArray(json)) {
    return json.filter(isObject) as GenericRow[];
  }
  if (!isObject(json)) {
    throw new Error('Upstream payload is not an object/array.');
  }

  const objectRows = extractFirstArray(json);
  return objectRows.filter(isObject) as GenericRow[];
}

async function mergeTournamentStatsRows(liveUrl: string, primaryRows: GenericRow[]): Promise<GenericRow[]> {
  const statsUrl = buildTournamentStatsUrl(liveUrl);
  if (!statsUrl) return primaryRows;

  try {
    const response = await fetch(statsUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/csv;q=0.9, */*;q=0.8',
        'User-Agent': '5x5-studio-live-sync/1.0',
      },
      cache: 'no-store',
    });
    if (!response.ok) return primaryRows;

    const body = await response.text();
    const statsRows = parseUpstreamRows(body, response.headers.get('content-type'));
    if (!statsRows.length) return primaryRows;

    const statsByDgId = new Map<number, GenericRow>();
    const statsByName = new Map<string, GenericRow>();

    for (const row of statsRows) {
      const dgId = readNumber(row, ['dg_id', 'dgId']);
      if (typeof dgId === 'number') {
        statsByDgId.set(dgId, row);
      }

      const name = readString(row, ['player_name', 'name', 'player']);
      if (name) {
        statsByName.set(normalizeNameForMatching(name), row);
      }
    }

    return primaryRows.map((row) => {
      const dgId = readNumber(row, ['dg_id', 'dgId']);
      let stats: GenericRow | undefined;
      if (typeof dgId === 'number') {
        stats = statsByDgId.get(dgId);
      }
      if (!stats) {
        const name = readString(row, ['player_name', 'name', 'player']);
        if (name) {
          stats = statsByName.get(normalizeNameForMatching(name));
        }
      }
      if (!stats) return row;

      // Keep primary scorecard fields and augment with tournament-level position/total/thru data.
      return {
        ...stats,
        ...row,
      };
    });
  } catch {
    return primaryRows;
  }
}

function extractFirstArray(payload: GenericRow): unknown[] {
  const preferredKeys = [
    'field',
    'players',
    'leaderboard',
    'results',
    'data',
    'rows',
    'live_stats',
    'tournament_stats',
  ];

  for (const key of preferredKeys) {
    const value = payload[key];
    if (Array.isArray(value)) {
      return value;
    }
    if (isObject(value) && Array.isArray(value.data)) {
      return value.data;
    }
  }

  for (const value of Object.values(payload)) {
    if (Array.isArray(value)) {
      return value;
    }
    if (isObject(value) && Array.isArray(value.data)) {
      return value.data;
    }
  }

  throw new Error('Could not find an array of player rows in upstream payload.');
}

function normalizeLiveRow(row: GenericRow): NormalizedLiveRow | null {
  const playerName = readString(row, [
    'player_name',
    'name',
    'player',
    'golfer_name',
    'full_name',
  ]);
  if (!playerName) return null;

  const scorecardDerived = deriveFromHoleScorecards(row);

  return {
    playerName,
    position: readStringish(row, ['position', 'pos', 'rank', 'place']),
    scoreToPar:
      readNumberOrString(row, ['score_to_par', 'score', 'to_par', 'total_to_par', 'total']) ??
      scorecardDerived?.scoreToPar,
    thru:
      readNumberOrString(row, ['thru', 'holes_completed', 'holes', 'holes_thru']) ??
      scorecardDerived?.thru,
    today:
      readNumberOrString(row, ['today', 'round_score_to_par', 'round_to_par', 'round']) ??
      scorecardDerived?.today,
    status: readString(row, ['status', 'round_status', 'state']) ?? scorecardDerived?.status,
    upstreamFantasyPoints: readNumber(row, [
      'fantasyPoints',
      'fantasy_points',
      'dk_points',
      'dkPoints',
      'draftkings_points',
      'fpts',
      'points',
    ]),
    scorecardFantasyPoints: scorecardDerived?.fantasyPoints,
    activeRoundNumber: scorecardDerived?.activeRoundNumber,
    activeRoundHoles: scorecardDerived?.activeRoundHoles,
    rawRow: row,
  };
}

function annotateRoundStates(rows: NormalizedLiveRow[]): NormalizedLiveRow[] {
  const fieldCurrentRound = rows.reduce((maxRound, row) => {
    return Math.max(maxRound, row.activeRoundNumber ?? 0);
  }, 0);

  if (fieldCurrentRound <= 0) {
    return rows;
  }

  return rows.map((row) => {
    const activeRoundNumber = row.activeRoundNumber;
    const activeRoundHoles = row.activeRoundHoles;
    if (!activeRoundNumber || activeRoundHoles === undefined) {
      return row;
    }

    const status = (row.status ?? '').toLowerCase();
    const position = (row.position ?? '').toLowerCase();
    const isTerminal =
      status.includes('final') ||
      status.includes('finished') ||
      status.includes('cut') ||
      status.includes('wd') ||
      status.includes('dq') ||
      position === 'cut' ||
      position === 'wd' ||
      position === 'dq';

    if (isTerminal || activeRoundHoles < 18) {
      return row;
    }

    if (activeRoundNumber < fieldCurrentRound) {
      return {
        ...row,
        thru: `R${activeRoundNumber} F`,
        status: `awaiting-round-${fieldCurrentRound}`,
      };
    }

    return {
      ...row,
      thru: `R${activeRoundNumber} F`,
      status: fieldCurrentRound >= 4 ? 'final' : `round-${activeRoundNumber}-complete`,
    };
  });
}

function resolveFantasyPoints(
  row: NormalizedLiveRow,
  scoringMode: DfsScoringMode
): { value?: number; source: 'dfs-rules' | 'upstream' | 'none' } {
  const livePositionPoints = row.livePositionPoints ?? 0;
  const fromRules =
    typeof row.scorecardFantasyPoints === 'number'
      ? row.scorecardFantasyPoints
      : computeFantasyPointsFromDfsRules(row.rawRow);
  const rulesWithLivePosition =
    typeof fromRules === 'number'
      ? roundToHalf(fromRules + livePositionPoints)
      : livePositionPoints > 0
        ? roundToHalf(livePositionPoints)
        : undefined;

  if (scoringMode === 'dfs-rules') {
    if (typeof rulesWithLivePosition === 'number') return { value: rulesWithLivePosition, source: 'dfs-rules' };
    return { source: 'none' };
  }

  if (scoringMode === 'upstream') {
    if (typeof row.upstreamFantasyPoints === 'number') {
      return { value: roundToHundredth(row.upstreamFantasyPoints), source: 'upstream' };
    }
    return { source: 'none' };
  }

  if (typeof rulesWithLivePosition === 'number') {
    return { value: rulesWithLivePosition, source: 'dfs-rules' };
  }
  if (typeof row.upstreamFantasyPoints === 'number') {
    return { value: roundToHundredth(row.upstreamFantasyPoints), source: 'upstream' };
  }
  return { source: 'none' };
}

function computeFantasyPointsFromDfsRules(sourceRow: GenericRow): number | undefined {
  const scorecardDerived = deriveFromHoleScorecards(sourceRow);
  if (scorecardDerived) {
    return scorecardDerived.fantasyPoints;
  }

  const doubleEagles = readCount(sourceRow, ['double_eagles', 'double_eagle', 'albatrosses', 'albatross']);
  const eagles = readCount(sourceRow, ['eagles', 'eagle']);
  const birdies = readCount(sourceRow, ['birdies', 'birdie']);
  const pars = readCount(sourceRow, ['pars', 'pars_made', 'par_made']);
  const bogeys = readCount(sourceRow, ['bogeys', 'bogey']);
  const explicitDoubleOrWorse = readCount(sourceRow, [
    'double_bogey_or_worse',
    'dbl_bogey_or_worse',
    'double_or_worse',
  ]);
  const doubles = readCount(sourceRow, ['double_bogeys', 'double_bogey', 'doubles']);
  const triples = readCount(sourceRow, [
    'triple_bogeys',
    'triple_bogey',
    'worse_than_double_bogey',
    'worse_than_double',
  ]);
  const doubleBogeyOrWorse = explicitDoubleOrWorse ?? doubles + triples;

  const holeInOnes = readCount(sourceRow, ['hole_in_ones', 'hole_in_one', 'aces', 'ace']);
  const threeBirdieStreaksRaw = readCount(sourceRow, [
    'streak_3_birdies',
    'three_birdie_streaks',
    'streaks_of_3_birdies',
  ]);
  const threeBirdieStreaks = Math.min(4, threeBirdieStreaksRaw);
  const bogeyFreeRounds = Math.min(4, readCount(sourceRow, ['bogey_free_rounds', 'bogey_free_round']));
  const allRoundsUnder70 = readCount(sourceRow, ['all_rounds_under_70']) || asFlagCount(readUnknown(sourceRow, ['all_rounds_under_70']));

  const hasAnyScoringInputs =
    doubleEagles +
      eagles +
      birdies +
      pars +
      bogeys +
      doubleBogeyOrWorse +
      holeInOnes +
      threeBirdieStreaks +
      bogeyFreeRounds +
      allRoundsUnder70 >
      0;

  if (!hasAnyScoringInputs) {
    return undefined;
  }

  const total =
    doubleEagles * 13 +
    eagles * 8 +
    birdies * 3 +
    pars * 0.5 +
    bogeys * -0.5 +
    doubleBogeyOrWorse * -1 +
    holeInOnes * 5 +
    threeBirdieStreaks * 3 +
    bogeyFreeRounds * 3 +
    allRoundsUnder70 * 5;

  return roundToHalf(total);
}

function parseFinishingPosition(position: string): number | null {
  const cleaned = position.trim().toUpperCase();
  if (!cleaned || cleaned === 'CUT' || cleaned === 'WD' || cleaned === 'DQ') {
    return null;
  }
  const match = cleaned.match(/\d+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
}

function getFinishingPoints(position: number): number {
  if (position === 1) return 30;
  if (position === 2) return 20;
  if (position === 3) return 18;
  if (position === 4) return 16;
  if (position === 5) return 14;
  if (position === 6) return 12;
  if (position === 7) return 10;
  if (position === 8) return 9;
  if (position === 9) return 8;
  if (position === 10) return 7;
  if (position >= 11 && position <= 15) return 6;
  if (position >= 16 && position <= 20) return 5;
  if (position >= 21 && position <= 25) return 4;
  if (position >= 26 && position <= 30) return 3;
  if (position >= 31 && position <= 40) return 2;
  if (position >= 41 && position <= 50) return 1;
  return 0;
}

function applyLivePositionPoints(rows: NormalizedLiveRow[]): NormalizedLiveRow[] {
  return rows.map((row) => ({
    ...row,
    livePositionPoints: (() => {
      const parsed = parseFinishingPosition(row.position ?? '');
      return parsed ? getFinishingPoints(parsed) : 0;
    })(),
  }));
}

interface HoleScoreCell {
  hole?: unknown;
  par?: unknown;
  score?: unknown;
}

interface RoundScoreCell {
  round_num?: unknown;
  scores?: unknown;
}

function orderRoundScoresByPlaySequence(scoresRaw: HoleScoreCell[]): HoleScoreCell[] {
  if (scoresRaw.length <= 1) return [...scoresRaw];

  const parsed = scoresRaw.map((cell, index) => ({
    cell,
    index,
    hole: toSafeInt(cell.hole),
  }));

  const validHoles = parsed.filter(({ hole }) => hole !== null && hole >= 1 && hole <= 18);
  const hasOnlyValidHoleNumbers = validHoles.length === parsed.length;
  const holesAreUnique = new Set(validHoles.map(({ hole }) => hole)).size === validHoles.length;

  // If hole metadata is incomplete/duplicated, trust upstream order as-is.
  if (!hasOnlyValidHoleNumbers || !holesAreUnique || !validHoles.length) {
    return [...scoresRaw];
  }

  const startHole = validHoles[0].hole as number;

  // Sort by circular distance from the first observed hole so rounds that start on
  // hole 10 preserve real play sequence (10..18,1..9) for streak detection.
  return [...validHoles]
    .sort((left, right) => {
      const leftDistance = (left.hole! - startHole + 18) % 18;
      const rightDistance = (right.hole! - startHole + 18) % 18;
      if (leftDistance === rightDistance) {
        return left.index - right.index;
      }
      return leftDistance - rightDistance;
    })
    .map(({ cell }) => cell);
}

interface ScorecardDerived {
  fantasyPoints: number;
  scoreToPar: number;
  today: number;
  thru: string | number;
  status: string;
  activeRoundNumber: number;
  activeRoundHoles: number;
}

function deriveFromHoleScorecards(row: GenericRow): ScorecardDerived | null {
  const roundsRaw = row.rounds;
  if (!Array.isArray(roundsRaw)) return null;

  let doubleEagles = 0;
  let eagles = 0;
  let birdies = 0;
  let pars = 0;
  let bogeys = 0;
  let doubleOrWorse = 0;
  let holeInOnes = 0;
  let threeBirdieStreaks = 0;
  let bogeyFreeRounds = 0;
  let completedRoundsUnder70 = 0;

  let totalToPar = 0;
  let completedHolesTotal = 0;
  let completedRounds = 0;

  let activeRoundNumber = 1;
  let activeRoundToPar = 0;
  let activeRoundHoles = 0;

  for (let roundIndex = 0; roundIndex < roundsRaw.length; roundIndex += 1) {
    const round = roundsRaw[roundIndex] as RoundScoreCell;
    const roundNumber = toSafeInt(round.round_num) ?? roundIndex + 1;
    const scoresRaw = Array.isArray(round.scores) ? (round.scores as HoleScoreCell[]) : [];
    const ordered = orderRoundScoresByPlaySequence(scoresRaw);

    let roundToPar = 0;
    let roundStrokes = 0;
    let completedHoles = 0;
    let hasBogeyOrWorse = false;
    let currentBirdieRun = 0;
    let hasThreeBirdieStreak = false;

    for (const cell of ordered) {
      const par = toSafeInt(cell.par);
      const score = toSafeInt(cell.score);
      if (par === null || score === null) {
        currentBirdieRun = 0;
        continue;
      }

      completedHoles += 1;
      roundStrokes += score;
      const delta = score - par;
      roundToPar += delta;

      if (delta <= -3) doubleEagles += 1;
      else if (delta === -2) eagles += 1;
      else if (delta === -1) birdies += 1;
      else if (delta === 0) pars += 1;
      else if (delta === 1) bogeys += 1;
      else if (delta >= 2) doubleOrWorse += 1;

      if (par === 3 && score === 1) {
        holeInOnes += 1;
      }

      // DraftKings streak bonus is for consecutive birdies (not birdie-or-better).
      if (delta === -1) {
        currentBirdieRun += 1;
        if (currentBirdieRun >= 3) {
          hasThreeBirdieStreak = true;
        }
      } else {
        currentBirdieRun = 0;
      }

      if (delta >= 1) {
        hasBogeyOrWorse = true;
      }
    }

    if (hasThreeBirdieStreak || currentBirdieRun >= 3) {
      // DraftKings awards this bonus max once per round.
      threeBirdieStreaks += 1;
    }

    totalToPar += roundToPar;
    completedHolesTotal += completedHoles;

    if (completedHoles > 0 && roundNumber >= activeRoundNumber) {
      activeRoundNumber = roundNumber;
      activeRoundToPar = roundToPar;
      activeRoundHoles = completedHoles;
    }

    if (completedHoles === 18) {
      completedRounds += 1;
      if (!hasBogeyOrWorse) {
        bogeyFreeRounds += 1;
      }
      if (roundStrokes < 70) {
        completedRoundsUnder70 += 1;
      }
    }
  }

  const allRoundsUnder70 = completedRounds >= 4 && completedRoundsUnder70 === completedRounds ? 1 : 0;

  const fantasy =
    doubleEagles * 13 +
    eagles * 8 +
    birdies * 3 +
    pars * 0.5 +
    bogeys * -0.5 +
    doubleOrWorse * -1 +
    holeInOnes * 5 +
    threeBirdieStreaks * 3 +
    bogeyFreeRounds * 3 +
    allRoundsUnder70 * 5;

  const thru: string | number = activeRoundHoles >= 18 ? 'F' : activeRoundHoles;
  const status = completedHolesTotal === 0 ? 'upcoming' : activeRoundHoles >= 18 ? 'round-complete' : 'live';

  return {
    fantasyPoints: roundToHalf(fantasy),
    scoreToPar: totalToPar,
    today: activeRoundToPar,
    thru,
    status,
    activeRoundNumber,
    activeRoundHoles,
  };
}

function readString(row: GenericRow, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function readStringish(row: GenericRow, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function readNumber(row: GenericRow, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value.trim());
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function toSafeInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return null;
}

function readCount(row: GenericRow, keys: string[]): number {
  const numeric = readNumber(row, keys);
  if (typeof numeric === 'number') {
    return Math.max(0, Math.trunc(numeric));
  }
  const booleanValue = readBoolean(row, keys);
  if (booleanValue === true) return 1;
  return 0;
}

function readBoolean(row: GenericRow, keys: string[]): boolean | undefined {
  const raw = readUnknown(row, keys);
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') {
    if (raw === 1) return true;
    if (raw === 0) return false;
  }
  if (typeof raw === 'string') {
    const normalized = raw.trim().toLowerCase();
    if (['1', 'true', 'yes', 'y'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'n'].includes(normalized)) return false;
  }
  return undefined;
}

function readUnknown(row: GenericRow, keys: string[]): unknown {
  for (const key of keys) {
    if (key in row) {
      return row[key];
    }
    const keyLower = key.toLowerCase();
    const found = Object.entries(row).find(([candidate]) => candidate.toLowerCase() === keyLower);
    if (found) {
      return found[1];
    }
  }
  return undefined;
}

function asFlagCount(value: unknown): number {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number') return value > 0 ? 1 : 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'y'].includes(normalized)) return 1;
  }
  return 0;
}

function readNumberOrString(row: GenericRow, keys: string[]): string | number | undefined {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const trimmed = value.trim();
      const parsed = Number(trimmed);
      return Number.isFinite(parsed) ? parsed : trimmed;
    }
  }
  return undefined;
}

function parseCsvRows(csvText: string): GenericRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const row: GenericRow = {};
    for (let index = 0; index < headers.length; index += 1) {
      row[headers[index]] = cols[index] ?? '';
    }
    return row;
  });
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  result.push(current);
  return result.map((value) => value.trim());
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

function parseScoringMode(value: string | undefined): DfsScoringMode {
  const normalized = (value ?? '').trim().toLowerCase();
  if (!normalized) return DEFAULT_SCORING_MODE;
  if (normalized === 'dfs-rules') {
    return normalized;
  }
  throw new Error(`Invalid scoring mode "${value}". Only dfs-rules is supported.`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function roundToHundredth(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    for (const [key] of parsed.searchParams.entries()) {
      if (/key|token|secret/i.test(key)) {
        parsed.searchParams.set(key, '***');
      }
    }
    return parsed.toString();
  } catch {
    return url.replace(/(key=)[^&]+/gi, '$1***');
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
