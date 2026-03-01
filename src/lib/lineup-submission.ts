import { getLineupValidation } from '@/lib/lineup-builder';
import { submitTestLineup } from '@/lib/firestore-lineups';
import type { PlayerPoolGolfer, WeeklyLeagueContest } from '@/lib/lineup-builder-types';
import { savePersistedLineup } from '@/lib/weekly-lineup-storage';

export interface UpsertLineupEntryRequest {
  contest: WeeklyLeagueContest;
  playerPool: PlayerPoolGolfer[];
  userKey: string;
  userDisplayName?: string;
  lineupGolferIds: string[];
}

export interface UpsertLineupEntryResponse {
  success: boolean;
  validation: ReturnType<typeof getLineupValidation>;
  submittedAtIso?: string;
}

export async function upsertLineupEntryLocal(
  request: UpsertLineupEntryRequest
): Promise<UpsertLineupEntryResponse> {
  const validation = getLineupValidation(
    request.lineupGolferIds,
    request.playerPool,
    request.contest
  );

  if (!validation.canSubmit) {
    return {
      success: false,
      validation,
    };
  }

  const nowIso = new Date().toISOString();
  savePersistedLineup({
    contestId: request.contest.id,
    userKey: request.userKey,
    lineupGolferIds: request.lineupGolferIds,
    submittedAtIso: nowIso,
    lastEditedAtIso: nowIso,
  });

  return {
    success: true,
    validation,
    submittedAtIso: nowIso,
  };
}

export async function upsertLineupEntryTestFirestore(
  request: UpsertLineupEntryRequest
): Promise<UpsertLineupEntryResponse> {
  const validation = getLineupValidation(
    request.lineupGolferIds,
    request.playerPool,
    request.contest
  );

  if (!validation.canSubmit) {
    return {
      success: false,
      validation,
    };
  }

  const nowIso = new Date().toISOString();
  const localEntry = {
    contestId: request.contest.id,
    userKey: request.userKey,
    userDisplayName: request.userDisplayName,
    lineupGolferIds: request.lineupGolferIds,
    submittedAtIso: nowIso,
    lastEditedAtIso: nowIso,
  };

  // Always keep local fallback copy for offline/retry scenarios.
  savePersistedLineup(localEntry);

  if (!request.userDisplayName) {
    return {
      success: true,
      validation,
      submittedAtIso: nowIso,
    };
  }

  const result = await submitTestLineup({
    ...localEntry,
    userDisplayName: request.userDisplayName,
  });

  return {
    success: true,
    validation,
    submittedAtIso: result.submittedAtIso,
  };
}
