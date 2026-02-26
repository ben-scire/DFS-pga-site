export type ContestStatus = 'draft' | 'pool_published' | 'open' | 'locked' | 'live' | 'final';

export interface WeeklyLeagueContest {
  id: string;
  weekNumber: number;
  name: string;
  hostLabel: string;
  entryFeeDisplay: string;
  lockAtIso: string;
  status: ContestStatus;
  salaryCap: number;
  rosterSize: number;
  entryNumberLabel: string;
  isMajor?: boolean;
  lockDisabled?: boolean;
  testMode?: boolean;
}

export interface PlayerPoolGolfer {
  golferId: string;
  name: string;
  salary: number;
  position: 'G';
  headshotUrl: string;
  fppg?: number;
  avgScore?: number;
  cutsMade?: number;
  cutsAttempts?: number;
  top10s?: number;
  teeTimeDisplay?: string;
  statusTag?: string;
  countryCode?: string;
  isActive: boolean;
}

export interface LineupValidationResult {
  isLocked: boolean;
  positionsFilled: number;
  salaryCap: number;
  salaryUsed: number;
  salaryRemaining: number;
  averageRemainingPerPlayer: number;
  isUnderSalaryCap: boolean;
  canSubmit: boolean;
  errors: string[];
}

export interface PersistedLineupEntry {
  contestId: string;
  userKey: string;
  lineupGolferIds: string[];
  userDisplayName?: string;
  submittedAtIso?: string;
  lastEditedAtIso: string;
  cloudUpdatedAtIso?: string;
}
