import standingsData from '../../league-scoring/season-standings.json';
import scheduleData from '../../league-scoring/schedule.json';
import weekOneData from '../../league-scoring/weekly-scores/week-1-cognizant.json';
import weekTwoData from '../../league-scoring/weekly-scores/week-2-arnold-palmer.json';
import weekThreeData from '../../league-scoring/weekly-scores/week-3-players.json';
import weekFourData from '../../league-scoring/weekly-scores/week-4-valspar.json';
import weekFiveData from '../../league-scoring/weekly-scores/week-5-houston-open.json';
import weekSixData from '../../league-scoring/weekly-scores/week-6-valero-texas-open.json';
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
};

export type WeeklyScoreFile = {
  eventId: number;
  eventName: string;
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

const EVENT_SHORT_LABELS: Record<number, string> = {
  1: 'Cognizant',
  2: 'Arnold Palmer',
  3: 'The Players',
  4: 'Valspar',
  5: 'Houston',
  6: 'Valero',
  7: 'Masters',
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

export const SEASON_SCHEDULE = scheduleData as ScheduleEvent[];
export const COMPLETED_WEEKLY_SCORES = [weekOneData, weekTwoData, weekThreeData, weekFourData, weekFiveData, weekSixData]
  .map((week) => week as WeeklyScoreFile)
  .sort((left, right) => left.eventId - right.eventId);

export function formatScoringCell(cell: ScoringCell) {
  return typeof cell.payout === 'number' ? `${cell.points} ($${cell.payout})` : `${cell.points}`;
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

export function getSeasonStandingsRows(): SeasonStandingsDisplayRow[] {
  const eventColumns = getSeasonEventColumns();
  const sortedStandings = [...(standingsData as StandingsEntry[])].sort((left, right) => {
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

export function getSeasonEventColumns(): EventFinishColumn[] {
  return COMPLETED_WEEKLY_SCORES
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

export function getLatestCompletedEventId(): number {
  return COMPLETED_WEEKLY_SCORES.at(-1)?.eventId ?? 0;
}

export function getUpcomingQuarterEvents(quarter: number): ScheduleEvent[] {
  const latestCompletedEventId = getLatestCompletedEventId();
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

function rankWeeklyEntries(entries: WeeklyScoreEntry[]) {
  const sortedEntries = entries
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
