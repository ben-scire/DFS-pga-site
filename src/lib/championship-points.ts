import type {
  ChampionshipContestConfig,
  ChampionshipContestResult,
  MiniSeason,
  MiniSeasonId,
  MiniSeasonStandingsRow,
  WeeklyContestResultRow,
  WeeklyRankedResultRow,
} from '@/lib/league-types';

export const CHAMPIONSHIP_POINTS_TOP_10 = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1] as const;
export const DEFAULT_MAJOR_CHAMPIONSHIP_MULTIPLIER = 2;

export const MINI_SEASONS: MiniSeason[] = [
  { id: 'q1', name: 'Mini Season 1 (to Masters)', endsAtMajor: 'masters', weekNumbers: [1, 2, 3, 4, 5, 6, 7] },
  { id: 'q2', name: 'Mini Season 2 (to PGA Championship)', endsAtMajor: 'pga', weekNumbers: [8, 9, 10, 11, 12, 13] },
  { id: 'q3', name: 'Mini Season 3 (to U.S. Open)', endsAtMajor: 'us-open', weekNumbers: [14, 15, 16, 17, 18, 19] },
  { id: 'q4', name: 'Mini Season 4 (to The Open)', endsAtMajor: 'the-open', weekNumbers: [20, 21, 22, 23, 24, 25] },
];

export function rankWeeklyResults(
  rows: WeeklyContestResultRow[],
  multiplier = 1
): WeeklyRankedResultRow[] {
  const sorted = [...rows].sort((a, b) => b.weeklyFantasyPoints - a.weeklyFantasyPoints);

  let rank = 1;
  let lastScore = sorted[0]?.weeklyFantasyPoints;

  return sorted.map((row, index) => {
    if (index > 0 && row.weeklyFantasyPoints < (lastScore ?? row.weeklyFantasyPoints)) {
      rank = index + 1;
    }
    lastScore = row.weeklyFantasyPoints;

    const basePoints = rank <= CHAMPIONSHIP_POINTS_TOP_10.length ? CHAMPIONSHIP_POINTS_TOP_10[rank - 1] : 0;
    return {
      ...row,
      rank,
      championshipPointsAwarded: basePoints * multiplier,
    };
  });
}

export function scoreChampionshipContest(
  contest: ChampionshipContestConfig,
  rows: WeeklyContestResultRow[]
): ChampionshipContestResult {
  return {
    contest,
    rankedRows: rankWeeklyResults(rows, contest.championshipMultiplier),
  };
}

export function computeMiniSeasonStandings(
  miniSeasonId: MiniSeasonId,
  contests: ChampionshipContestResult[]
): MiniSeasonStandingsRow[] {
  const contestResults = contests.filter((contest) => contest.contest.miniSeasonId === miniSeasonId);
  const expectedWeeks = new Set(contestResults.map((contest) => contest.contest.contestId));
  const byUser = new Map<
    string,
    Omit<MiniSeasonStandingsRow, 'rank'> & { contestsPlayed: Set<string> }
  >();

  for (const contest of contestResults) {
    for (const row of contest.rankedRows) {
      const existing = byUser.get(row.uid);
      if (existing) {
        existing.championshipPoints += row.championshipPointsAwarded;
        existing.fantasyPointsTotal += row.weeklyFantasyPoints;
        existing.weeksEntered += 1;
        existing.weeksScored += 1;
        existing.contestsPlayed.add(contest.contest.contestId);
      } else {
        byUser.set(row.uid, {
          miniSeasonId,
          uid: row.uid,
          username: row.username,
          championshipPoints: row.championshipPointsAwarded,
          fantasyPointsTotal: row.weeklyFantasyPoints,
          weeksEntered: 1,
          weeksScored: 1,
          eligibleForMiniSeasonPrize: false,
          contestsPlayed: new Set([contest.contest.contestId]),
        });
      }
    }
  }

  const standings = [...byUser.values()]
    .map((row) => ({
      ...row,
      eligibleForMiniSeasonPrize: row.contestsPlayed.size === expectedWeeks.size && expectedWeeks.size > 0,
    }))
    .sort((a, b) => {
      if (b.championshipPoints !== a.championshipPoints) {
        return b.championshipPoints - a.championshipPoints;
      }
      return b.fantasyPointsTotal - a.fantasyPointsTotal;
    });

  let rank = 1;
  let lastPoints = standings[0]?.championshipPoints;
  let lastFantasy = standings[0]?.fantasyPointsTotal;

  return standings.map((row, index) => {
    if (
      index > 0 &&
      (row.championshipPoints < (lastPoints ?? row.championshipPoints) ||
        row.fantasyPointsTotal < (lastFantasy ?? row.fantasyPointsTotal))
    ) {
      rank = index + 1;
    }
    lastPoints = row.championshipPoints;
    lastFantasy = row.fantasyPointsTotal;

    return {
      miniSeasonId: row.miniSeasonId,
      uid: row.uid,
      username: row.username,
      championshipPoints: row.championshipPoints,
      fantasyPointsTotal: row.fantasyPointsTotal,
      weeksEntered: row.weeksEntered,
      weeksScored: row.weeksScored,
      eligibleForMiniSeasonPrize: row.eligibleForMiniSeasonPrize,
      rank,
    };
  });
}

export function getMiniSeasonById(miniSeasonId: MiniSeasonId): MiniSeason {
  const miniSeason = MINI_SEASONS.find((row) => row.id === miniSeasonId);
  if (!miniSeason) {
    throw new Error(`Mini season not found: ${miniSeasonId}`);
  }
  return miniSeason;
}
