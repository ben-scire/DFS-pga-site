import standingsData from '../../league-scoring/season-standings.json';
import q1StandingsData from '../../league-scoring/q1-standings.json';
import q2StandingsData from '../../league-scoring/q2-standings.json';
import scheduleData from '../../league-scoring/schedule.json';
import weekOneData from '../../league-scoring/weekly-scores/Q1/week-1-cognizant.json';
import weekTwoData from '../../league-scoring/weekly-scores/Q1/week-2-arnold-palmer.json';
import weekThreeData from '../../league-scoring/weekly-scores/Q1/week-3-players.json';
import weekFourData from '../../league-scoring/weekly-scores/Q1/week-4-valspar.json';
import weekFiveData from '../../league-scoring/weekly-scores/Q1/week-5-houston-open.json';
import weekSixData from '../../league-scoring/weekly-scores/Q1/week-6-valero-texas-open.json';
import weekSevenData from '../../league-scoring/weekly-scores/Q1/week-7-masters.json';
import weekEightData from '../../league-scoring/weekly-scores/Q2/week-8-heritage.json';
import weekNineData from '../../league-scoring/weekly-scores/Q2/week-9-zurich.json';
import weekTenData from '../../league-scoring/weekly-scores/Q2/week-10-miami-championship.json';
import weekElevenData from '../../league-scoring/weekly-scores/Q2/week-11-truist-championship.json';
import weekTwelveData from '../../league-scoring/weekly-scores/Q2/week-12-pga-championship.json';
import { TEST_USER_DIRECTORY } from '@/lib/test-users';

export type StandingsEntry = {
  rank: number | null;
  entryId: string;
  entryName: string;
  championshipPoints: number | null;
  netDollars: number | null;
  weeklyFantasyPointsTotal: number | null;
  weeklyWins: number | null;
  previousWeekFinish: number | null;
  weeksEntered: number | null;
};

export type ScheduleEvent = {
  id: number;
  name: string;
  tier: 'Standard' | 'Signature' | 'Major';
  quarter: number;
  isQuarterFinale: boolean;
};

export type WeeklyScoreEntry = {
  entryId: string;
  entryName: string;
  weeklyFantasyPoints: number;
  noRank?: boolean;
};

export type WeeklyScoreFile = {
  eventId: number;
  eventName: string;
  activePlayers?: number;
  entries: WeeklyScoreEntry[];
};

export type ScoringCell = {
  points: number;
  payout?: number;
};

export type ScoringMatrixRow = {
  finish: string;
  major: ScoringCell;
  signature: ScoringCell;
  standard: ScoringCell;
};

export type EventFinishColumn = {
  eventId: number;
  eventName: string;
  shortLabel: string;
  tier: ScheduleEvent['tier'];
  finishByEntryId: Record<string, string>;
};

export type SeasonStandingsDisplayRow = StandingsEntry & {
  displayName: string;
  finishByEventId: Record<number, string>;
};

export type LatestWeeklyFinalRow = {
  rank: number;
  finishLabel: string;
  entryId: string;
  displayName: string;
  weeklyFantasyPoints: number;
  payout: number;
};

export type QuarterScheduleDisplayRow = ScheduleEvent & {
  winner: string;
};

export type QuarterFinalPayoutRow = {
  rank: number;
  entryId: string;
  displayName: string;
  championshipPoints: number;
  payout: number;
  activePlayers: number;
};

const EVENT_SHORT_LABELS: Record<number, string> = {
  1: 'Cognizant',
  2: 'Arnold Palmer',
  3: 'The Players',
  4: 'Valspar',
  5: 'Houston',
  6: 'Valero',
  7: 'Masters',
  8: 'Heritage',
  9: 'Zurich',
  10: 'Miami',
  11: 'Truist',
  12: 'PGA',
};

const USER_DIRECTORY_BY_SLUG = new Map(
  TEST_USER_DIRECTORY.map((entry) => [entry.userSlug, entry])
);

export const SCORING_MATRIX: ScoringMatrixRow[] = [
  { finish: '1st', major: { points: 50, payout: 115 }, signature: { points: 40, payout: 105 }, standard: { points: 30, payout: 75 } },
  { finish: '2nd', major: { points: 40, payout: 55 }, signature: { points: 32, payout: 50 }, standard: { points: 24, payout: 50 } },
  { finish: '3rd', major: { points: 33, payout: 25 }, signature: { points: 26, payout: 35 }, standard: { points: 20, payout: 40 } },
  { finish: '4th', major: { points: 27, payout: 15 }, signature: { points: 22, payout: 20 }, standard: { points: 17, payout: 25 } },
  { finish: '5th', major: { points: 22, payout: 10 }, signature: { points: 18, payout: 10 }, standard: { points: 14 } },
  { finish: '6th', major: { points: 18 }, signature: { points: 15 }, standard: { points: 12 } },
  { finish: '7th', major: { points: 15 }, signature: { points: 13 }, standard: { points: 10 } },
  { finish: '8th', major: { points: 13 }, signature: { points: 11 }, standard: { points: 8 } },
  { finish: '9th', major: { points: 11 }, signature: { points: 9 }, standard: { points: 7 } },
  { finish: '10th', major: { points: 10 }, signature: { points: 8 }, standard: { points: 6 } },
  { finish: '11th', major: { points: 8 }, signature: { points: 6 }, standard: { points: 5 } },
  { finish: '12th', major: { points: 7 }, signature: { points: 5 }, standard: { points: 4 } },
  { finish: '13th', major: { points: 6 }, signature: { points: 4 }, standard: { points: 3 } },
  { finish: '14th', major: { points: 5 }, signature: { points: 3 }, standard: { points: 2 } },
  { finish: '15th', major: { points: 4 }, signature: { points: 2 }, standard: { points: 2 } },
  { finish: '16th', major: { points: 3 }, signature: { points: 2 }, standard: { points: 1 } },
  { finish: '17th', major: { points: 2 }, signature: { points: 1 }, standard: { points: 1 } },
  { finish: '18th', major: { points: 2 }, signature: { points: 1 }, standard: { points: 1 } },
  { finish: '19th', major: { points: 1 }, signature: { points: 1 }, standard: { points: 1 } },
  { finish: '20th', major: { points: 1 }, signature: { points: 1 }, standard: { points: 1 } },
  { finish: 'No Show', major: { points: 0 }, signature: { points: 0 }, standard: { points: 0 } },
];

/** Q2 full-field (16 quarter pool) weekly prize splits — championship points unchanged. */
const Q2_WEEKLY_PAYOUTS_16 = {
  standard: [54, 36, 29, 18],
  signature: [76, 36, 25, 14, 7],
  major: [83, 40, 18, 10, 7],
} as const;
const BASE_POOL_SIZE = 22;
const WEEKLY_PAYOUTS = {
  Standard: [75, 50, 40, 25],
  Signature: [105, 50, 35, 20, 10],
  Major: [115, 55, 25, 15, 10],
} as const;
const QUARTERLY_PAYOUTS = [550, 275, 135, 85, 55] as const;

export const SEASON_SCHEDULE = scheduleData as ScheduleEvent[];
export const COMPLETED_WEEKLY_SCORES = [
  weekOneData,
  weekTwoData,
  weekThreeData,
  weekFourData,
  weekFiveData,
  weekSixData,
  weekSevenData,
  weekEightData,
  weekNineData,
  weekTenData,
  weekElevenData,
  weekTwelveData,
]
  .map((week) => week as WeeklyScoreFile)
  .sort((left, right) => left.eventId - right.eventId);

const Q2_COMPLETED_WEEKLY_SCORES = [weekEightData, weekNineData, weekTenData, weekElevenData, weekTwelveData]
  .map((week) => week as WeeklyScoreFile)
  .sort(
  (left, right) => left.eventId - right.eventId
);

const Q1_COMPLETED_WEEKLY_SCORES = [
  weekOneData,
  weekTwoData,
  weekThreeData,
  weekFourData,
  weekFiveData,
  weekSixData,
  weekSevenData,
]
  .map((week) => week as WeeklyScoreFile)
  .sort((left, right) => left.eventId - right.eventId);

export function formatScoringCell(cell: ScoringCell) {
  return typeof cell.payout === 'number' ? `${cell.points} ($${cell.payout})` : `${cell.points}`;
}

/** Finishes 1st–16th plus No Show; points match league matrix, payouts = Q2 16-pool weekly splits. */
export function getQ2SixteenPlayerScoringMatrix(): ScoringMatrixRow[] {
  const { standard: stdP, signature: sigP, major: majP } = Q2_WEEKLY_PAYOUTS_16;
  const top16 = SCORING_MATRIX.slice(0, 16).map((row, idx) => ({
    finish: row.finish,
    major: {
      points: row.major.points,
      payout: idx < majP.length ? majP[idx] : undefined,
    },
    signature: {
      points: row.signature.points,
      payout: idx < sigP.length ? sigP[idx] : undefined,
    },
    standard: {
      points: row.standard.points,
      payout: idx < stdP.length ? stdP[idx] : undefined,
    },
  }));
  return [...top16, SCORING_MATRIX[SCORING_MATRIX.length - 1]];
}

export function getQuarterScheduleEvents(quarter: number): ScheduleEvent[] {
  return SEASON_SCHEDULE.filter((event) => event.quarter === quarter).sort((left, right) => left.id - right.id);
}

export function getLatestWeeklyFinalStandings(): {
  eventName: string;
  tier: ScheduleEvent['tier'];
  rows: LatestWeeklyFinalRow[];
} | null {
  const latest = COMPLETED_WEEKLY_SCORES.at(-1);
  if (!latest) return null;

  const tier = SEASON_SCHEDULE.find((event) => event.id === latest.eventId)?.tier ?? 'Standard';
  const rankedEntries = rankWeeklyEntries(latest.entries);
  const scale = rankedEntries.length / BASE_POOL_SIZE;
  const payouts = WEEKLY_PAYOUTS[tier].map((value) => Math.floor(value * scale));

  const payoutByRank = new Map<number, number>();
  let idx = 0;
  while (idx < rankedEntries.length) {
    const tieRank = rankedEntries[idx].rank;
    const tieScore = rankedEntries[idx].weeklyFantasyPoints;
    let j = idx + 1;
    while (j < rankedEntries.length && rankedEntries[j].weeklyFantasyPoints === tieScore) {
      j += 1;
    }
    const tiedCount = j - idx;
    let payoutTotal = 0;
    for (let pos = tieRank; pos < tieRank + tiedCount; pos += 1) {
      payoutTotal += payouts[pos - 1] ?? 0;
    }
    payoutByRank.set(tieRank, tiedCount > 0 ? payoutTotal / tiedCount : 0);
    idx = j;
  }

  return {
    eventName: latest.eventName,
    tier,
    rows: rankedEntries.map((entry) => ({
      rank: entry.rank,
      finishLabel: entry.finishLabel,
      entryId: entry.entryId,
      displayName: getPreferredDisplayName(entry.entryId, entry.entryName),
      weeklyFantasyPoints: entry.weeklyFantasyPoints,
      payout: payoutByRank.get(entry.rank) ?? 0,
    })),
  };
}

export function getShortEventLabel(eventId: number, eventName: string): string {
  return EVENT_SHORT_LABELS[eventId] ?? eventName;
}

export function getPreferredDisplayName(entryId: string, fallbackName: string): string {
  const directoryEntry = USER_DIRECTORY_BY_SLUG.get(entryId);
  if (!directoryEntry) return fallbackName;

  const options = [directoryEntry.alias, directoryEntry.entryName]
    .map((value) => value.trim())
    .filter(Boolean);
  if (!options.length) return fallbackName;

  return options
    .slice()
    .sort((left, right) => left.length - right.length || left.localeCompare(right))[0];
}

function getStandingsDisplayRows(
  rawStandings: StandingsEntry[],
  eventColumns: EventFinishColumn[]
): SeasonStandingsDisplayRow[] {
  const sortedStandings = [...rawStandings].sort((left, right) => {
    const pointsDelta = (right.championshipPoints ?? -1) - (left.championshipPoints ?? -1);
    if (pointsDelta !== 0) return pointsDelta;
    return (right.weeklyFantasyPointsTotal ?? -1) - (left.weeklyFantasyPointsTotal ?? -1);
  });

  return sortedStandings.map((entry) => ({
    ...entry,
    displayName: getPreferredDisplayName(entry.entryId, entry.entryName),
    finishByEventId: Object.fromEntries(
      eventColumns.map((column) => [column.eventId, column.finishByEntryId[entry.entryId] ?? '—'])
    ),
  }));
}

export function getSeasonStandingsRows(): SeasonStandingsDisplayRow[] {
  return getStandingsDisplayRows(standingsData as StandingsEntry[], getSeasonEventColumns());
}

export function getQ2StandingsRows(): SeasonStandingsDisplayRow[] {
  return getStandingsDisplayRows(q2StandingsData as StandingsEntry[], getQ2EventColumns());
}

export function getQ2FinalPayoutRows(): QuarterFinalPayoutRow[] {
  const activePlayers = Q2_COMPLETED_WEEKLY_SCORES.reduce((max, week) => {
    if (typeof week.activePlayers === 'number') return Math.max(max, week.activePlayers);
    return Math.max(max, rankWeeklyEntries(week.entries).length);
  }, 0);
  const scale = activePlayers / BASE_POOL_SIZE;
  const payouts = QUARTERLY_PAYOUTS.map((value) => Math.floor(value * scale));

  return getQ2StandingsRows().slice(0, payouts.length).map((entry, index) => ({
    rank: entry.rank ?? index + 1,
    entryId: entry.entryId,
    displayName: entry.displayName,
    championshipPoints: entry.championshipPoints ?? 0,
    payout: payouts[index] ?? 0,
    activePlayers,
  }));
}

export function getQ1StandingsRows(): SeasonStandingsDisplayRow[] {
  return getStandingsDisplayRows(q1StandingsData as StandingsEntry[], getQ1EventColumns());
}

function buildEventColumnsFromWeeklies(weeklies: WeeklyScoreFile[]): EventFinishColumn[] {
  return weeklies
    .slice()
    .sort((left, right) => right.eventId - left.eventId)
    .map((weeklyScore) => {
      const scheduleEvent = SEASON_SCHEDULE.find((event) => event.id === weeklyScore.eventId);
      const finishByEntryId = buildFinishMap(weeklyScore.entries);
      return {
        eventId: weeklyScore.eventId,
        eventName: weeklyScore.eventName,
        shortLabel: getShortEventLabel(weeklyScore.eventId, weeklyScore.eventName),
        tier: scheduleEvent?.tier ?? 'Standard',
        finishByEntryId,
      };
    });
}

export function getSeasonEventColumns(): EventFinishColumn[] {
  return buildEventColumnsFromWeeklies(COMPLETED_WEEKLY_SCORES);
}

export function getQ2EventColumns(): EventFinishColumn[] {
  return buildEventColumnsFromWeeklies(Q2_COMPLETED_WEEKLY_SCORES);
}

export function getQ1EventColumns(): EventFinishColumn[] {
  return buildEventColumnsFromWeeklies(Q1_COMPLETED_WEEKLY_SCORES);
}

export function getQuarterScheduleRows(quarter: number): QuarterScheduleDisplayRow[] {
  const weeklyByEventId = new Map(COMPLETED_WEEKLY_SCORES.map((week) => [week.eventId, week]));

  return getQuarterScheduleEvents(quarter).map((event) => {
    const weeklyScore = weeklyByEventId.get(event.id);
    return {
      ...event,
      winner: weeklyScore ? getWeeklyWinnerLabel(weeklyScore) : '—',
    };
  });
}

export function getLatestCompletedEventId(): number {
  return COMPLETED_WEEKLY_SCORES.reduce((max, week) => Math.max(max, week.eventId), 0);
}

/** Latest schedule event id in this quarter that has a weekly-scores file (avoids Q3+ showing as "upcoming" when only Q2 progressed). */
export function getLatestCompletedEventIdForQuarter(quarter: number): number {
  const completedIds = new Set(COMPLETED_WEEKLY_SCORES.map((week) => week.eventId));
  let max = 0;
  for (const event of SEASON_SCHEDULE) {
    if (event.quarter === quarter && completedIds.has(event.id)) {
      max = Math.max(max, event.id);
    }
  }
  return max;
}

export function getUpcomingQuarterEvents(quarter: number): ScheduleEvent[] {
  const latestCompletedEventId = getLatestCompletedEventIdForQuarter(quarter);
  return SEASON_SCHEDULE.filter((event) => event.quarter === quarter && event.id > latestCompletedEventId);
}

export function getNextQuarterEvent(quarter: number): ScheduleEvent | null {
  return getUpcomingQuarterEvents(quarter)[0] ?? null;
}

export function getQuarterFinaleEvent(quarter: number): ScheduleEvent | null {
  return (
    SEASON_SCHEDULE.find((event) => event.quarter === quarter && event.isQuarterFinale) ?? null
  );
}

function buildFinishMap(entries: WeeklyScoreEntry[]): Record<string, string> {
  const rankedEntries = rankWeeklyEntries(entries);
  const finishByEntryId: Record<string, string> = {};

  for (const rankedEntry of rankedEntries) {
    finishByEntryId[rankedEntry.entryId] = rankedEntry.finishLabel;
  }

  return finishByEntryId;
}

function getWeeklyWinnerLabel(weeklyScore: WeeklyScoreFile): string {
  const rankedEntries = rankWeeklyEntries(weeklyScore.entries);
  const winners = rankedEntries.filter((entry) => entry.rank === 1);
  if (!winners.length) return '—';

  return winners
    .map((entry) => getPreferredDisplayName(entry.entryId, entry.entryName))
    .join(' / ');
}

function rankWeeklyEntries(entries: WeeklyScoreEntry[]) {
  const sortedEntries = entries
    .filter((entry) => !entry.noRank)
    .slice()
    .sort((left, right) => right.weeklyFantasyPoints - left.weeklyFantasyPoints || left.entryId.localeCompare(right.entryId));

  let currentRank = 1;
  let previousScore: number | null = null;
  const ranked = sortedEntries.map((entry, index) => {
    if (previousScore !== null && entry.weeklyFantasyPoints < previousScore) {
      currentRank = index + 1;
    }
    previousScore = entry.weeklyFantasyPoints;
    return { ...entry, rank: currentRank };
  });

  const rankCounts = new Map<number, number>();
  for (const entry of ranked) {
    rankCounts.set(entry.rank, (rankCounts.get(entry.rank) ?? 0) + 1);
  }

  return ranked.map((entry) => ({
    ...entry,
    finishLabel: (rankCounts.get(entry.rank) ?? 0) > 1 ? `T${entry.rank}` : toOrdinal(entry.rank),
  }));
}

function toOrdinal(value: number): string {
  const remainder100 = value % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return `${value}th`;

  const remainder10 = value % 10;
  if (remainder10 === 1) return `${value}st`;
  if (remainder10 === 2) return `${value}nd`;
  if (remainder10 === 3) return `${value}rd`;
  return `${value}th`;
}
