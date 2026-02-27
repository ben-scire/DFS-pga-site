import fs from 'node:fs/promises';
import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { doc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  normalizeNameForMatching,
  parseContestStandingsCsv,
  type ContestStandingsEntryRow,
} from '../src/lib/contest-standings-import';
import { getTestUserName } from '../src/lib/test-users';
import { getDefaultPlayerPool, getWeeklyContestById } from '../src/lib/weekly-lineup-seed';
import { resolveTestUserFromEntryName } from '../src/lib/test-user-entry-aliases';

type CliOptions = {
  csvPath: string;
  contestId: string;
  write: boolean;
  allowUnmapped: boolean;
  entryOverrides: Record<string, string>;
};

type FirebasePublicConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

type PreparedImportRow = {
  entryName: string;
  userSlug: string;
  userDisplayName: string;
  lineupGolferIds: string[];
  lineupPlayerNames: string[];
  points?: number;
};

type PreparedImportError = {
  entryName: string;
  reason: string;
};

async function main() {
  loadEnvFiles();
  const options = parseArgs(process.argv.slice(2));
  const csvText = await fs.readFile(options.csvPath, 'utf8');
  const parsed = parseContestStandingsCsv(csvText);
  const contest = getWeeklyContestById(options.contestId);
  const playerPool = getDefaultPlayerPool(options.contestId);

  if (!contest) {
    throw new Error(`Unknown contestId "${options.contestId}".`);
  }
  if (!playerPool.length) {
    throw new Error(`No seeded player pool found for contest "${options.contestId}".`);
  }

  const golfersByNameKey = buildGolferLookup(playerPool);
  const preparedRows: PreparedImportRow[] = [];
  const errors: PreparedImportError[] = [];

  for (const entry of parsed.entries) {
    const prepared = prepareEntry(entry, golfersByNameKey, options.entryOverrides);
    if ('reason' in prepared) {
      errors.push(prepared);
      continue;
    }
    preparedRows.push(prepared);
  }

  printSummary({
    csvPath: options.csvPath,
    contestName: contest.name,
    parsedEntries: parsed.entries,
    preparedRows,
    errors,
    warnings: parsed.warnings,
  });

  if (errors.length && !options.allowUnmapped) {
    console.error('\nAborting write because unresolved entries were found. Re-run with --allow-unmapped to import only matched rows.');
    process.exitCode = 1;
    return;
  }

  if (!options.write) {
    console.log('\nDry run only. Re-run with --write to push matched lineups to Firestore test_lineups.');
    return;
  }

  if (!preparedRows.length) {
    console.error('\nNo valid rows to write.');
    process.exitCode = 1;
    return;
  }

  const firebaseConfig = readFirebasePublicConfig();
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const nowIso = new Date().toISOString();

  for (const row of preparedRows) {
    const ref = doc(db, 'test_lineups', options.contestId, 'entries', row.userSlug);
    await setDoc(
      ref,
      {
        contestId: options.contestId,
        userSlug: row.userSlug,
        userDisplayName: row.userDisplayName,
        lineupGolferIds: row.lineupGolferIds,
        submittedAtIso: nowIso,
        lastEditedAtIso: nowIso,
        updatedAt: serverTimestamp(),
        source: 'web-test',
        version: 1,
      },
      { merge: true }
    );
  }

  console.log(`\nWrote ${preparedRows.length} lineup docs to test_lineups/${options.contestId}/entries.`);
}

function loadEnvFiles() {
  loadDotenv({ path: path.resolve(process.cwd(), '.env.local') });
  loadDotenv({ path: path.resolve(process.cwd(), '.env') });
}

function parseArgs(argv: string[]): CliOptions {
  let csvPath = '';
  let contestId = 'week-1-cognizant';
  let write = false;
  let allowUnmapped = false;
  const entryOverrides: Record<string, string> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--csv') {
      csvPath = argv[index + 1] ?? '';
      index += 1;
      continue;
    }
    if (arg === '--contest-id') {
      contestId = argv[index + 1] ?? contestId;
      index += 1;
      continue;
    }
    if (arg === '--write') {
      write = true;
      continue;
    }
    if (arg === '--allow-unmapped') {
      allowUnmapped = true;
      continue;
    }
    if (arg === '--map') {
      const mapping = argv[index + 1] ?? '';
      index += 1;
      const [entryNameRaw, userSlugRaw] = mapping.split('=');
      const entryName = (entryNameRaw ?? '').trim().toLowerCase();
      const userSlug = (userSlugRaw ?? '').trim();
      if (!entryName || !userSlug) {
        throw new Error(`Invalid --map value "${mapping}". Expected entryName=userSlug`);
      }
      entryOverrides[entryName] = userSlug;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!csvPath) {
    throw new Error('Missing required --csv <path> argument.');
  }

  return {
    csvPath: path.resolve(process.cwd(), csvPath),
    contestId,
    write,
    allowUnmapped,
    entryOverrides,
  };
}

function printHelp() {
  console.log(`Import contest standings CSV into Firestore test_lineups.

Usage:
  tsx scripts/import-contest-standings.ts --csv /path/to/contest-standings.csv [--contest-id week-1-cognizant] [--write] [--allow-unmapped]
  tsx scripts/import-contest-standings.ts --csv /path/to/file.csv --map cm30=coach --map capc=ceec --write

Defaults:
  Runs in dry-run mode unless --write is provided.
`);
}

function readFirebasePublicConfig(): FirebasePublicConfig {
  const config = {
    apiKey: (process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '').trim(),
    authDomain: (process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '').trim(),
    projectId: (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '').trim(),
    storageBucket: (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '').trim(),
    messagingSenderId: (process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '').trim(),
    appId: (process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '').trim(),
  };

  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length) {
    throw new Error(`Missing Firebase public env vars: ${missing.join(', ')}`);
  }

  return config;
}

function buildGolferLookup(
  playerPool: ReturnType<typeof getDefaultPlayerPool>
): Map<string, { golferId: string; name: string }> {
  const map = new Map<string, { golferId: string; name: string }>();

  for (const golfer of playerPool) {
    const keys = new Set<string>([
      normalizeNameForMatching(golfer.name),
      normalizeNameForMatching(golfer.name.replace(/-/g, ' ')),
    ]);

    for (const key of keys) {
      if (!key) continue;
      map.set(key, { golferId: golfer.golferId, name: golfer.name });
    }
  }

  return map;
}

function prepareEntry(
  entry: ContestStandingsEntryRow,
  golfersByNameKey: Map<string, { golferId: string; name: string }>,
  entryOverrides: Record<string, string>
): PreparedImportRow | PreparedImportError {
  const overrideSlug = entryOverrides[entry.entryName.trim().toLowerCase()];
  const resolvedUser = overrideSlug
    ? resolveOverrideUser(overrideSlug)
    : resolveTestUserFromEntryName(entry.entryName);
  if (!resolvedUser) {
    return {
      entryName: entry.entryName,
      reason: 'No test-user mapping found',
    };
  }

  if (entry.lineupPlayerNames.length !== 6) {
    return {
      entryName: entry.entryName,
      reason: `Expected 6 golfers in lineup, found ${entry.lineupPlayerNames.length}`,
    };
  }

  const lineupGolferIds: string[] = [];
  const missingNames: string[] = [];

  for (const name of entry.lineupPlayerNames) {
    const match = golfersByNameKey.get(normalizeNameForMatching(name));
    if (!match) {
      missingNames.push(name);
      continue;
    }
    lineupGolferIds.push(match.golferId);
  }

  if (missingNames.length) {
    return {
      entryName: entry.entryName,
      reason: `Missing golfers in contest pool: ${missingNames.join(', ')}`,
    };
  }

  return {
    entryName: entry.entryName,
    userSlug: resolvedUser.userSlug,
    userDisplayName: resolvedUser.userDisplayName,
    lineupGolferIds,
    lineupPlayerNames: entry.lineupPlayerNames,
    points: entry.points,
  };
}

function resolveOverrideUser(userSlug: string) {
  const normalizedSlug = userSlug.trim();
  const resolved = resolveTestUserFromEntryName(normalizedSlug);
  if (resolved) {
    return resolved;
  }

  const displayName = getTestUserName(normalizedSlug);
  if (displayName) {
    return {
      userSlug: normalizedSlug,
      userDisplayName: displayName,
      source: 'exact' as const,
    };
  }

  return null;
}

function printSummary(input: {
  csvPath: string;
  contestName: string;
  parsedEntries: ContestStandingsEntryRow[];
  preparedRows: PreparedImportRow[];
  errors: PreparedImportError[];
  warnings: string[];
}) {
  console.log(`CSV: ${input.csvPath}`);
  console.log(`Contest: ${input.contestName}`);
  console.log(`Parsed entries: ${input.parsedEntries.length}`);
  console.log(`Prepared imports: ${input.preparedRows.length}`);
  console.log(`Skipped: ${input.errors.length}`);

  if (input.warnings.length) {
    console.log('\nParser warnings:');
    for (const warning of input.warnings) {
      console.log(`- ${warning}`);
    }
  }

  if (input.preparedRows.length) {
    console.log('\nMatched rows:');
    for (const row of input.preparedRows) {
      const points = typeof row.points === 'number' ? ` (${row.points.toFixed(1)} pts)` : '';
      console.log(`- ${row.entryName} -> ${row.userSlug}${points}`);
    }
  }

  if (input.errors.length) {
    console.log('\nUnresolved rows:');
    for (const error of input.errors) {
      console.log(`- ${error.entryName}: ${error.reason}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
