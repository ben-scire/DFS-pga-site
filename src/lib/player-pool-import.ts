import type { PlayerPoolGolfer } from '@/lib/lineup-builder-types';

type CsvRow = Record<string, string>;

const HEADERS = {
  golferId: ['id', 'golferid', 'playerid', 'dk_id'],
  name: ['name', 'player', 'golfer', 'player_name'],
  salary: ['salary', 'dk_salary', 'price'],
  fppg: ['fppg', 'avg_points', 'fantasy_points_per_game', 'avgpointspergame'],
  avgScore: ['avg', 'avg_score', 'average', 'scoring_avg'],
  cutsMade: ['cutsmade', 'cuts_made'],
  cutsAttempts: ['cutsattempts', 'cuts_attempts', 'cuts'],
  top10s: ['top10s', 'top_10s', 't10s'],
  teeTimeDisplay: ['teetime', 'tee_time', 'teetimedisplay'],
  headshotUrl: ['headshoturl', 'image', 'imageurl', 'headshot'],
  statusTag: ['status', 'status_tag'],
} as const;

export function parsePlayerPoolCsv(csvText: string): PlayerPoolGolfer[] {
  const rows = parseCsv(csvText);
  return rows
    .map((row, index) => toPlayerPoolGolfer(row, index))
    .filter((row): row is PlayerPoolGolfer => row !== null);
}

function toPlayerPoolGolfer(row: CsvRow, index: number): PlayerPoolGolfer | null {
  const golferId =
    pick(row, HEADERS.golferId) ||
    pick(row, ['nameid'])
      ?.match(/\((\d+)\)/)?.[1] ||
    null;
  const name = pick(row, HEADERS.name);
  const salary = toNumber(pick(row, HEADERS.salary));
  if (!name || salary === null) {
    return null;
  }

  return {
    golferId: golferId ?? (slugify(name) || `golfer-${index + 1}`),
    name,
    salary,
    position: 'G',
    headshotUrl: pick(row, HEADERS.headshotUrl) || 'https://placehold.co/80x80/png',
    fppg: toOptionalNumber(pick(row, HEADERS.fppg)),
    avgScore: toOptionalNumber(pick(row, HEADERS.avgScore)),
    cutsMade: toOptionalInt(pick(row, HEADERS.cutsMade)),
    cutsAttempts: toOptionalInt(pick(row, HEADERS.cutsAttempts)),
    top10s: toOptionalInt(pick(row, HEADERS.top10s)),
    teeTimeDisplay: pick(row, HEADERS.teeTimeDisplay) || undefined,
    statusTag: pick(row, HEADERS.statusTag) || undefined,
    isActive: true,
  };
}

function pick(row: CsvRow, aliases: readonly string[]): string | null {
  for (const alias of aliases) {
    const match = Object.keys(row).find((key) => normalizeHeader(key) === alias);
    if (match) {
      const value = row[match]?.trim();
      if (value) return value;
    }
  }
  return null;
}

function parseCsv(csvText: string): CsvRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    return headers.reduce<CsvRow>((acc, header, idx) => {
      acc[header] = cols[idx] ?? '';
      return acc;
    }, {});
  });
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
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

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function toNumber(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/[$,]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function toOptionalNumber(value: string | null): number | undefined {
  const parsed = toNumber(value);
  return parsed ?? undefined;
}

function toOptionalInt(value: string | null): number | undefined {
  const parsed = toNumber(value);
  return parsed === null ? undefined : Math.trunc(parsed);
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}
