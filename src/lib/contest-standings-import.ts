export interface ContestStandingsEntryRow {
  rank?: number;
  entryId: string;
  entryName: string;
  timeRemaining?: number;
  points?: number;
  lineupRaw: string;
  lineupPlayerNames: string[];
}

export interface ContestStandingsPlayerStatRow {
  playerName: string;
  rosterPosition?: string;
  draftedPct?: number;
  fantasyPoints?: number;
}

export interface ContestStandingsImportResult {
  entries: ContestStandingsEntryRow[];
  playerStats: ContestStandingsPlayerStatRow[];
  warnings: string[];
}

type CsvRow = Record<string, string>;

export function parseContestStandingsCsv(csvText: string): ContestStandingsImportResult {
  const rows = parseCsv(csvText);
  const warnings: string[] = [];
  const entries: ContestStandingsEntryRow[] = [];
  const playerStats: ContestStandingsPlayerStatRow[] = [];

  for (const row of rows) {
    const entryId = read(row, 'EntryId');
    const entryName = read(row, 'EntryName');
    const lineupRaw = read(row, 'Lineup');
    const lineupFromPlayerColumns = entryName ? parseLineupFromPlayerColumns(row) : [];

    if (entryId && entryName && lineupRaw) {
      const lineupPlayerNames = parseLineupNames(lineupRaw);
      if (!lineupPlayerNames.length) {
        warnings.push(`Could not parse lineup players for entry "${entryName}".`);
      }

      entries.push({
        rank: toNumber(read(row, 'Rank')) ?? undefined,
        entryId,
        entryName,
        timeRemaining: toNumber(read(row, 'TimeRemaining')) ?? undefined,
        points:
          toNumber(read(row, 'Points')) ??
          toNumber(read(row, 'FPTS')) ??
          toNumber(read(row, 'FantasyPoints')) ??
          undefined,
        lineupRaw,
        lineupPlayerNames,
      });
      continue;
    }

    if (entryName && lineupFromPlayerColumns.length) {
      entries.push({
        entryId: entryId ?? entryName,
        entryName,
        lineupRaw: lineupFromPlayerColumns.join(', '),
        lineupPlayerNames: lineupFromPlayerColumns,
      });
      continue;
    }

    const playerName = read(row, 'Player');
    if (playerName && !entryId && !entryName) {
      playerStats.push({
        playerName,
        rosterPosition: read(row, 'Roster Position') || undefined,
        draftedPct: parsePercent(read(row, '%Drafted')) ?? undefined,
        fantasyPoints: toNumber(read(row, 'FPTS')) ?? undefined,
      });
    }
  }

  return { entries, playerStats, warnings };
}

export function normalizeNameForMatching(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’.]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseLineupNames(lineupRaw: string): string[] {
  const cleaned = lineupRaw.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];

  const withoutLeadingPos = cleaned.replace(/^G\s+/i, '');
  return withoutLeadingPos
    .split(/\s+G\s+/i)
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseLineupFromPlayerColumns(row: CsvRow): string[] {
  const playerCells = Object.entries(row)
    .filter(([key]) => /^player\s*\d+$/i.test(key.trim()))
    .sort(([left], [right]) => {
      const leftNum = Number(left.replace(/[^\d]/g, ''));
      const rightNum = Number(right.replace(/[^\d]/g, ''));
      return leftNum - rightNum;
    })
    .map(([, value]) => value.trim())
    .filter(Boolean);

  if (playerCells.length) {
    return playerCells;
  }

  // Fallback to common compact keys like player1, player2, etc.
  const compact = [1, 2, 3, 4, 5, 6]
    .map((index) => read(row, `Player${index}`) ?? read(row, `player${index}`))
    .filter((value): value is string => Boolean(value));

  return compact;
}

function parsePercent(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/[%,$]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function toNumber(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/[$,]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function read(row: CsvRow, key: string): string | null {
  const value = row[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function parseCsv(csvText: string): CsvRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const row: CsvRow = {};
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
