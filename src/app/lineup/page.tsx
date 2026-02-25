"use client";

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, Check, ChevronLeft, MoreVertical } from 'lucide-react';
import DraftGolferPanel from '@/components/lineup/draft-golfer-panel';
import DraftGolferSheet from '@/components/lineup/draft-golfer-sheet';
import LineupSlotRow from '@/components/lineup/lineup-slot-row';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getLineupValidation } from '@/lib/lineup-builder';
import type { PlayerPoolGolfer } from '@/lib/lineup-builder-types';
import { upsertLineupEntryLocal } from '@/lib/lineup-submission';
import { getDefaultPlayerPool, getWeeklyContestById } from '@/lib/weekly-lineup-seed';
import {
  loadImportedPlayerPool,
  loadPersistedLineup,
  savePersistedLineup,
} from '@/lib/weekly-lineup-storage';
import { toast } from '@/hooks/use-toast';

function formatCountdown(lockAtIso: string): string {
  const ms = new Date(lockAtIso).getTime() - Date.now();
  if (ms <= 0) return 'LOCKED';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

function LineupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contestId = searchParams.get('contestId') ?? 'week-1-cognizant';
  const userId = searchParams.get('userId') ?? 'guest';
  const contest = getWeeklyContestById(contestId);

  const [playerPool, setPlayerPool] = useState<PlayerPoolGolfer[]>([]);
  const [lineupGolferIds, setLineupGolferIds] = useState<string[]>([]);
  const [submittedAtIso, setSubmittedAtIso] = useState<string | null>(null);
  const [draftOpen, setDraftOpen] = useState(false);
  const [countdown, setCountdown] = useState<string>('');
  const [didHydratePersistedEntry, setDidHydratePersistedEntry] = useState(false);

  useEffect(() => {
    if (!contest) return;
    const imported = loadImportedPlayerPool(contest.id);
    setPlayerPool(imported && imported.length ? imported : getDefaultPlayerPool(contest.id));

    const persisted = loadPersistedLineup(contest.id, userId);
    if (persisted) {
      setLineupGolferIds(persisted.lineupGolferIds);
      setSubmittedAtIso(persisted.submittedAtIso ?? null);
    }
    setDidHydratePersistedEntry(true);
  }, [contest, userId]);

  useEffect(() => {
    if (!contest) return;
    const update = () => setCountdown(formatCountdown(contest.lockAtIso));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [contest]);

  const validation = useMemo(() => {
    if (!contest) {
      return null;
    }
    return getLineupValidation(lineupGolferIds, playerPool, contest);
  }, [contest, lineupGolferIds, playerPool]);

  const lineupGolfers = useMemo(() => {
    const map = new Map(playerPool.map((golfer) => [golfer.golferId, golfer]));
    return lineupGolferIds.map((id) => map.get(id)).filter((g): g is PlayerPoolGolfer => Boolean(g));
  }, [lineupGolferIds, playerPool]);

  useEffect(() => {
    if (!contest || !didHydratePersistedEntry) return;
    savePersistedLineup({
      contestId: contest.id,
      userKey: userId,
      lineupGolferIds,
      submittedAtIso: submittedAtIso ?? undefined,
      lastEditedAtIso: new Date().toISOString(),
    });
  }, [contest, didHydratePersistedEntry, lineupGolferIds, submittedAtIso, userId]);

  const toggleGolfer = (golferId: string) => {
    if (!contest || validation?.isLocked) return;
    setLineupGolferIds((current) => {
      if (current.includes(golferId)) {
        return current.filter((id) => id !== golferId);
      }
      if (current.length >= contest.rosterSize) {
        toast({ title: 'Roster full', description: `You can only select ${contest.rosterSize} golfers.`, variant: 'destructive' });
        return current;
      }
      return [...current, golferId];
    });
  };

  const removeAtSlot = (slotIndex: number) => {
    if (validation?.isLocked) return;
    setLineupGolferIds((current) => current.filter((_, idx) => idx !== slotIndex));
  };

  const clearLineup = () => {
    if (validation?.isLocked) return;
    setLineupGolferIds([]);
    setSubmittedAtIso(null);
  };

  const handleSubmit = async () => {
    if (!contest) return;
    const response = await upsertLineupEntryLocal({
      contest,
      playerPool,
      userKey: userId,
      lineupGolferIds,
    });

    if (!response.success) {
      toast({
        title: 'Lineup invalid',
        description: response.validation.errors[0] ?? 'Fix lineup errors before submitting.',
        variant: 'destructive',
      });
      return;
    }

    setSubmittedAtIso(response.submittedAtIso ?? new Date().toISOString());
    router.push(`/contests?userId=${encodeURIComponent(userId)}`);
  };

  if (!contest || !validation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#111318] text-zinc-100">
        Contest not found.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1116] text-zinc-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col bg-[#101216] shadow-2xl">
        <header className="flex items-center justify-between border-b border-zinc-800 bg-[#101216] px-4 py-4 lg:px-6">
          <Link href={`/contests?userId=${encodeURIComponent(userId)}`} className="text-zinc-300">
            <ChevronLeft className="h-8 w-8" />
          </Link>
          <h1 className="text-2xl font-semibold">Create Lineup</h1>
          <div className="w-16" />
        </header>

        <div className="grid flex-1 lg:grid-cols-[1.02fr_1fr]">
          <section className="flex min-h-0 flex-col border-r border-zinc-800">
            <div className="border-b border-zinc-300 bg-[#ececec] px-4 py-4 text-zinc-800">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xl font-semibold tracking-tight">
                  {contest.name} <span className="font-normal text-zinc-600">{contest.hostLabel}</span>
                </p>
                <MoreVertical className="h-6 w-6 text-zinc-400" />
              </div>
            </div>

            <div className="grid grid-cols-4 border-b border-zinc-300 bg-[#f2f2f2] text-center text-sm text-zinc-700">
              <div className="px-2 py-3">Entry: {contest.entryFeeDisplay}</div>
              <div className="px-2 py-3">{new Date(contest.lockAtIso).toLocaleString()}</div>
              <div className="px-2 py-3 font-mono">{countdown}</div>
              <div className="px-2 py-3">{contest.entryNumberLabel}</div>
            </div>

            {submittedAtIso && (
              <div className="flex items-center gap-2 border-b border-zinc-800 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
                <Check className="h-4 w-4" />
                Lineup submitted {new Date(submittedAtIso).toLocaleString()}
              </div>
            )}

            {!validation.canSubmit && validation.errors.length > 0 && !validation.isLocked && (
              <div className="flex items-start gap-2 border-b border-zinc-800 bg-red-500/10 px-4 py-2 text-sm text-red-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>{validation.errors[0]}</div>
              </div>
            )}

            <main className="flex-1 overflow-y-auto bg-[#dfdfdf] pb-28">
              {Array.from({ length: contest.rosterSize }).map((_, slotIndex) => (
                <LineupSlotRow
                  key={slotIndex}
                  slotIndex={slotIndex}
                  golfer={lineupGolfers[slotIndex]}
                  onOpenDraft={() => setDraftOpen(true)}
                  onRemove={() => removeAtSlot(slotIndex)}
                  disabled={validation.isLocked}
                />
              ))}
              <div className="px-4 py-4 text-sm text-zinc-600">
                Player Pool loaded: <span className="font-semibold">{playerPool.length}</span>
              </div>
            </main>

            <div className="sticky bottom-0 z-20 mt-auto border-t border-zinc-800 bg-[#1a1a1d] pb-[env(safe-area-inset-bottom)]">
              <div className="grid grid-cols-2 gap-2 px-4 py-3 text-white">
                <div>
                  <p className="text-sm text-zinc-300">
                    Positions Filled:{' '}
                    <span className="text-emerald-400">
                      {validation.positionsFilled}/{contest.rosterSize}
                    </span>
                  </p>
                  <p className="text-lg font-semibold">
                    Under Salary Cap{' '}
                    {validation.isUnderSalaryCap ? (
                      <span className="text-emerald-400">✓</span>
                    ) : (
                      <span className="text-red-400">✕</span>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-zinc-300">
                    Rem Salary:{' '}
                    <span className={validation.salaryRemaining >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                      ${validation.salaryRemaining.toLocaleString()}
                    </span>
                  </p>
                  <p className="text-sm text-zinc-300">
                    Avg Rem/Player:{' '}
                    <span className={validation.averageRemainingPerPlayer >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                      ${validation.averageRemainingPerPlayer.toLocaleString()}
                    </span>
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1 border-t border-zinc-800 px-2 py-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={clearLineup}
                  disabled={validation.isLocked}
                  className="h-11 text-lg font-semibold text-zinc-200 hover:bg-zinc-800"
                >
                  Clear
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDraftOpen(true)}
                  disabled={validation.isLocked}
                  className="h-11 text-lg font-semibold text-blue-400 hover:bg-zinc-800 lg:hidden"
                >
                  Draft
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleSubmit}
                  disabled={!validation.canSubmit}
                  className="h-11 text-lg font-semibold text-blue-400 hover:bg-zinc-800 lg:col-span-2"
                >
                  Submit
                </Button>
              </div>
            </div>
          </section>

          <aside className="hidden min-h-0 lg:block">
            <DraftGolferPanel
              playerPool={playerPool}
              selectedGolferIds={lineupGolferIds}
              salaryRemaining={Math.max(0, validation.salaryRemaining)}
              averageRemainingPerPlayer={validation.averageRemainingPerPlayer}
              positionsFilled={validation.positionsFilled}
              rosterSize={contest.rosterSize}
              isUnderSalaryCap={validation.isUnderSalaryCap}
              onSelectGolfer={toggleGolfer}
              compactHeader={false}
              className="h-[calc(100vh-73px)]"
            />
          </aside>
        </div>
      </div>

      <DraftGolferSheet
        open={draftOpen}
        onOpenChange={setDraftOpen}
        playerPool={playerPool}
        selectedGolferIds={lineupGolferIds}
        salaryRemaining={Math.max(0, validation.salaryRemaining)}
        averageRemainingPerPlayer={validation.averageRemainingPerPlayer}
        positionsFilled={validation.positionsFilled}
        rosterSize={contest.rosterSize}
        isUnderSalaryCap={validation.isUnderSalaryCap}
        onSelectGolfer={toggleGolfer}
        onClearLineup={clearLineup}
        onSubmitLineup={() => {
          void handleSubmit();
        }}
        canSubmit={validation.canSubmit}
        isLocked={validation.isLocked}
      />
    </div>
  );
}

export default function LineupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#111318]" />}>
      <LineupContent />
    </Suspense>
  );
}
