import type {
  LineupValidationResult,
  PlayerPoolGolfer,
  WeeklyLeagueContest,
} from '@/lib/lineup-builder-types';

export function getLineupValidation(
  lineupGolferIds: string[],
  playerPool: PlayerPoolGolfer[],
  contest: WeeklyLeagueContest,
  now = new Date()
): LineupValidationResult {
  const poolById = new Map(playerPool.map((golfer) => [golfer.golferId, golfer]));
  const lineupGolfers = lineupGolferIds
    .map((id) => poolById.get(id))
    .filter((golfer): golfer is PlayerPoolGolfer => Boolean(golfer));

  const salaryUsed = lineupGolfers.reduce((sum, golfer) => sum + golfer.salary, 0);
  const positionsFilled = lineupGolfers.length;
  const salaryRemaining = contest.salaryCap - salaryUsed;
  const slotsRemaining = Math.max(0, contest.rosterSize - positionsFilled);
  const isLocked = now >= new Date(contest.lockAtIso) || ['locked', 'live', 'final'].includes(contest.status);
  const duplicateCount = new Set(lineupGolferIds).size !== lineupGolferIds.length;

  const errors: string[] = [];
  if (isLocked) errors.push('Contest is locked. Lineups can no longer be edited.');
  if (duplicateCount) errors.push('Lineup cannot contain duplicate golfers.');
  if (salaryRemaining < 0) errors.push('Lineup exceeds the salary cap.');
  if (positionsFilled > contest.rosterSize) errors.push('Too many golfers selected.');
  if (lineupGolfers.length !== lineupGolferIds.length) errors.push('One or more selected golfers are not in the player pool.');
  if (positionsFilled < contest.rosterSize) errors.push(`Select ${contest.rosterSize} golfers to submit.`);

  return {
    isLocked,
    positionsFilled,
    salaryCap: contest.salaryCap,
    salaryUsed,
    salaryRemaining,
    averageRemainingPerPlayer: slotsRemaining > 0 ? Math.floor(Math.max(0, salaryRemaining) / slotsRemaining) : 0,
    isUnderSalaryCap: salaryRemaining >= 0,
    canSubmit:
      !isLocked &&
      positionsFilled === contest.rosterSize &&
      salaryRemaining >= 0 &&
      !duplicateCount &&
      lineupGolfers.length === lineupGolferIds.length,
    errors,
  };
}

export function sortPlayerPool(
  golfers: PlayerPoolGolfer[],
  sortBy: 'salary_desc' | 'salary_asc' | 'name_asc' | 'fppg_desc'
): PlayerPoolGolfer[] {
  const rows = [...golfers];
  rows.sort((a, b) => {
    switch (sortBy) {
      case 'salary_asc':
        return a.salary - b.salary;
      case 'name_asc':
        return a.name.localeCompare(b.name);
      case 'fppg_desc':
        return (b.fppg ?? -Infinity) - (a.fppg ?? -Infinity);
      case 'salary_desc':
      default:
        return b.salary - a.salary;
    }
  });
  return rows;
}

export function formatCurrency(num: number): string {
  return `$${num.toLocaleString()}`;
}
