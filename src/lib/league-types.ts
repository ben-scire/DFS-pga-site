export interface WeeklyContestResultRow {
  uid: string;
  username: string;
  weeklyFantasyPoints: number;
}

export interface WeeklyRankedResultRow extends WeeklyContestResultRow {
  rank: number;
  championshipPointsAwarded: number;
}

export interface SeasonStandingsRow {
  uid: string;
  username: string;
  championshipPoints: number;
  fantasyPointsTotal: number;
  weeksEntered: number;
  weeksScored: number;
  rank: number;
}

export type MajorKey = 'masters' | 'pga' | 'us-open' | 'the-open';

export type MiniSeasonId = 'q1' | 'q2' | 'q3' | 'q4';

export interface MiniSeason {
  id: MiniSeasonId;
  name: string;
  endsAtMajor: MajorKey;
  weekNumbers: number[];
}

export interface ChampionshipContestConfig {
  contestId: string;
  weekNumber: number;
  contestName: string;
  miniSeasonId: MiniSeasonId;
  isMajor: boolean;
  majorKey?: MajorKey;
  championshipMultiplier: number;
}

export interface ChampionshipContestResult {
  contest: ChampionshipContestConfig;
  rankedRows: WeeklyRankedResultRow[];
}

export interface MiniSeasonStandingsRow extends SeasonStandingsRow {
  miniSeasonId: MiniSeasonId;
  eligibleForMiniSeasonPrize: boolean;
}
