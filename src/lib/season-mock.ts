import { initialContestData } from '@/lib/mock-data';
import {
  DEFAULT_MAJOR_CHAMPIONSHIP_MULTIPLIER,
  MINI_SEASONS,
  computeMiniSeasonStandings,
  scoreChampionshipContest,
} from '@/lib/championship-points';
import type { ChampionshipContestResult, MiniSeasonId, MajorKey, WeeklyContestResultRow } from '@/lib/league-types';

const MAJOR_WEEKS: Record<number, MajorKey> = {
  7: 'masters',
  13: 'pga',
  19: 'us-open',
  25: 'the-open',
};

const PLAYER_SEEDS = initialContestData.players.map((player, index) => ({
  uid: `user-${player.id}`,
  username: player.name.toLowerCase(),
  baseSkill: 70 + (index % 8) * 4,
}));

function getMiniSeasonIdForWeek(weekNumber: number): MiniSeasonId {
  const season = MINI_SEASONS.find((miniSeason) => miniSeason.weekNumbers.includes(weekNumber));
  if (!season) {
    throw new Error(`No mini-season configured for week ${weekNumber}`);
  }
  return season.id;
}

function buildWeeklyRows(weekNumber: number): WeeklyContestResultRow[] {
  return PLAYER_SEEDS.map((player, index) => {
    const oscillation = ((weekNumber * (index + 3)) % 17) * 2.4;
    const trend = (weekNumber % 5) * 1.7;
    const weeklyFantasyPoints = Number((player.baseSkill + oscillation + trend).toFixed(2));
    return {
      uid: player.uid,
      username: player.username,
      weeklyFantasyPoints,
    };
  });
}

export const mockChampionshipContestResults: ChampionshipContestResult[] = Array.from(
  { length: 25 },
  (_, i) => {
    const weekNumber = i + 1;
    const majorKey = MAJOR_WEEKS[weekNumber];
    return scoreChampionshipContest(
      {
        contestId: `week-${weekNumber}`,
        weekNumber,
        contestName: `Week ${weekNumber}`,
        miniSeasonId: getMiniSeasonIdForWeek(weekNumber),
        isMajor: Boolean(majorKey),
        majorKey,
        championshipMultiplier: majorKey ? DEFAULT_MAJOR_CHAMPIONSHIP_MULTIPLIER : 1,
      },
      buildWeeklyRows(weekNumber)
    );
  }
);

export function getMockMiniSeasonStandings(miniSeasonId: MiniSeasonId) {
  return computeMiniSeasonStandings(miniSeasonId, mockChampionshipContestResults);
}
