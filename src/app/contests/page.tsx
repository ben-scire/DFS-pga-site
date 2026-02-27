"use client";

import { Suspense } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarDays, Clock3, Flag, Sparkles, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { loadTestLineup } from '@/lib/firestore-lineups';
import { getLineupValidation } from '@/lib/lineup-builder';
import type { PersistedLineupEntry, PlayerPoolGolfer } from '@/lib/lineup-builder-types';
import { getTestUserName } from '@/lib/test-users';
import { getDefaultPlayerPool, getWeeklyContestById, WEEKLY_CONTESTS } from '@/lib/weekly-lineup-seed';
import { loadImportedPlayerPool, loadPersistedLineup, savePersistedLineup } from '@/lib/weekly-lineup-storage';

function ContestsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get('userId') ?? 'guest';
  const [savedEntry, setSavedEntry] = useState<PersistedLineupEntry | null>(null);
  const [savedPool, setSavedPool] = useState<PlayerPoolGolfer[]>([]);

  const featuredContest = WEEKLY_CONTESTS[0];
  const featuredContestDef = getWeeklyContestById(featuredContest.id);
  const resolvedUserName = getTestUserName(userId);
  const userLabel = resolvedUserName ?? 'Guest';
  const isValidTestUser = Boolean(resolvedUserName);

  useEffect(() => {
    const contest = getWeeklyContestById(featuredContest.id);
    if (!contest) return;
    if (contest.testMode && !isValidTestUser) {
      setSavedEntry(null);
      return;
    }
    const importedPool = loadImportedPlayerPool(contest.id);
    setSavedPool(importedPool && importedPool.length ? importedPool : getDefaultPlayerPool(contest.id));
    const localEntry = loadPersistedLineup(contest.id, userId);
    setSavedEntry(localEntry);

    let cancelled = false;
    void (async () => {
      try {
        const cloudEntry = await loadTestLineup(contest.id, userId);
        if (cancelled || !cloudEntry) return;
        setSavedEntry(cloudEntry);
        savePersistedLineup({
          ...cloudEntry,
          userKey: userId,
        });
      } catch {
        // local fallback remains in place for this session
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [featuredContest.id, isValidTestUser, userId]);

  const savedLineupIds = savedEntry?.lineupGolferIds ?? [];

  const savedLineupSummary = useMemo(() => {
    if (!featuredContestDef) return null;
    const validation = getLineupValidation(savedLineupIds, savedPool, featuredContestDef);
    const golferMap = new Map(savedPool.map((golfer) => [golfer.golferId, golfer]));
    const golfers = savedLineupIds
      .map((id) => golferMap.get(id))
      .filter((g): g is PlayerPoolGolfer => Boolean(g));

    return { validation, golfers };
  }, [featuredContestDef, savedLineupIds, savedPool]);

  const lockDate = featuredContestDef ? new Date(featuredContestDef.lockAtIso) : null;
  const lineupFillPct =
    savedLineupSummary && featuredContestDef
      ? Math.round((savedLineupSummary.validation.positionsFilled / featuredContestDef.rosterSize) * 100)
      : 0;
  const salaryUsePct =
    savedLineupSummary && featuredContestDef
      ? Math.min(100, Math.round((savedLineupSummary.validation.salaryUsed / featuredContestDef.salaryCap) * 100))
      : 0;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#080c13] px-4 py-6 text-zinc-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-8 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-amber-400/5 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.18) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
      </div>

      <div className="relative mx-auto max-w-5xl space-y-5">
        <header className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#171f2d] via-[#111827] to-[#0b1018] shadow-[0_24px_90px_rgba(0,0,0,0.5)]">
          <div className="border-b border-white/10 px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-400">5x5 Global</p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Weekly Contest Hub</h1>
                <p className="mt-2 max-w-2xl text-sm text-zinc-400">
                  Build your lineup for the upcoming tournament. One entry per user, editable until lock.
                </p>
                {!isValidTestUser && (
                  <p className="mt-2 text-sm font-medium text-amber-300">
                    Select an approved test user from the home page before submitting lineups.
                  </p>
                )}
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-300" />
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Player</p>
                    <p className="text-sm font-semibold text-zinc-100">{userLabel}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {featuredContestDef && lockDate && (
            <div className="grid gap-3 px-5 py-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Event</p>
                <p className="mt-1 text-base font-semibold text-zinc-100">{featuredContestDef.name}</p>
                <p className="text-sm text-zinc-400">
                  {featuredContestDef.hostLabel}
                  {featuredContestDef.testMode ? ' · Test mode (lock disabled)' : ''}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-500">
                  <CalendarDays className="h-3.5 w-3.5" /> Lock Date
                </p>
                <p className="mt-1 text-base font-semibold text-zinc-100">{lockDate.toLocaleDateString()}</p>
                <p className="text-sm text-zinc-400">{lockDate.toLocaleTimeString()}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-500">
                  <Clock3 className="h-3.5 w-3.5" /> Roster
                </p>
                <p className="mt-1 text-base font-semibold text-zinc-100">{featuredContestDef.rosterSize} Golfers</p>
                <p className="text-sm text-zinc-400">Classic format</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-500">
                  <Flag className="h-3.5 w-3.5" /> Salary Cap
                </p>
                <p className="mt-1 text-base font-semibold text-zinc-100">${featuredContestDef.salaryCap.toLocaleString()}</p>
                <p className="text-sm text-zinc-400">{featuredContestDef.status.toUpperCase()}</p>
              </div>
            </div>
          )}
        </header>

        <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
          {savedLineupSummary && featuredContestDef && (
            <Card className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#101823] to-[#0b1017] text-zinc-100 shadow-[0_16px_55px_rgba(0,0,0,0.35)]">
              <div className="h-1.5 bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500" />
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-2xl tracking-tight">Your Lineup</CardTitle>
                    <CardDescription className="mt-1 text-zinc-400">{featuredContestDef.name}</CardDescription>
                  </div>
                    <Badge className={featuredContestDef.testMode ? 'bg-amber-500/20 text-amber-300' : (savedLineupSummary.validation.isLocked ? 'bg-zinc-700 text-zinc-100' : 'bg-blue-500/20 text-blue-300')}>
                    {featuredContestDef.testMode ? 'TEST MODE' : savedLineupSummary.validation.isLocked ? 'LOCKED' : 'EDITABLE'}
                  </Badge>
                </div>
                <p className="text-sm text-zinc-400">
                  {savedEntry?.submittedAtIso
                    ? `Submitted ${new Date(savedEntry.submittedAtIso).toLocaleString()}`
                    : savedLineupSummary.golfers.length
                      ? 'Draft in progress (not submitted)'
                      : 'No lineup started yet'}
                </p>
                {featuredContestDef.testMode && (
                  <p className="text-xs font-medium text-amber-300">
                    Test Mode: lineup lock is disabled for this week&apos;s live tracking run.
                  </p>
                )}
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Roster Fill</p>
                      <p className="text-sm font-semibold text-zinc-100">
                        {savedLineupSummary.validation.positionsFilled}/{featuredContestDef.rosterSize}
                      </p>
                    </div>
                    <div className="h-2 rounded-full bg-white/10">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
                        style={{ width: `${lineupFillPct}%` }}
                      />
                    </div>
                    <p className="mt-3 text-sm text-zinc-400">
                      {savedLineupSummary.validation.positionsFilled === featuredContestDef.rosterSize
                        ? 'Roster complete'
                        : `${featuredContestDef.rosterSize - savedLineupSummary.validation.positionsFilled} spots remaining`}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Salary Used</p>
                      <p className="text-sm font-semibold text-zinc-100">${savedLineupSummary.validation.salaryUsed.toLocaleString()}</p>
                    </div>
                    <div className="h-2 rounded-full bg-white/10">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-amber-300 to-orange-400"
                        style={{ width: `${salaryUsePct}%` }}
                      />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="text-zinc-400">Remaining</span>
                      <span
                        className={
                          savedLineupSummary.validation.salaryRemaining >= 0 ? 'font-semibold text-emerald-300' : 'font-semibold text-red-300'
                        }
                      >
                        ${savedLineupSummary.validation.salaryRemaining.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs uppercase tracking-wide text-zinc-500">Avg Rem / Player</p>
                    <p className="mt-1 font-semibold text-zinc-100">${savedLineupSummary.validation.averageRemainingPerPlayer.toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs uppercase tracking-wide text-zinc-500">Entry</p>
                    <p className="mt-1 font-semibold text-zinc-100">{featuredContestDef.entryFeeDisplay}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs uppercase tracking-wide text-zinc-500">Cap Status</p>
                    <p className={savedLineupSummary.validation.isUnderSalaryCap ? 'mt-1 font-semibold text-emerald-300' : 'mt-1 font-semibold text-red-300'}>
                      {savedLineupSummary.validation.isUnderSalaryCap ? 'Under Cap' : 'Over Cap'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs uppercase tracking-wide text-zinc-500">Lock</p>
                    <p className="mt-1 font-semibold text-zinc-100">{lockDate ? lockDate.toLocaleTimeString() : '--'}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#0a1018]/90 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Roster</p>
                    <p className="text-xs text-zinc-500">{savedLineupSummary.golfers.length} selected</p>
                  </div>
                  {savedLineupSummary.golfers.length ? (
                    <div className="grid gap-2">
                      {savedLineupSummary.golfers.map((golfer, idx) => (
                        <div
                          key={golfer.golferId}
                          className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-zinc-200">
                              {idx + 1}
                            </span>
                            <span className="font-medium text-zinc-100">{golfer.name}</span>
                          </div>
                          <span className="font-semibold text-zinc-300">${golfer.salary.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-zinc-500">
                      No golfers selected yet. Build your lineup before lock.
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    asChild
                    disabled={!isValidTestUser}
                    className="h-11 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 px-5 text-white hover:from-blue-400 hover:to-cyan-300 disabled:pointer-events-none disabled:opacity-50"
                  >
                    <Link href={isValidTestUser ? `/lineup?contestId=${featuredContestDef.id}&userId=${encodeURIComponent(userId)}` : '/'}>
                      {savedLineupSummary.validation.isLocked
                        ? 'View Lineup'
                        : savedLineupSummary.golfers.length
                          ? 'Edit Lineup'
                          : 'Build Lineup'}
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="h-11 rounded-xl border-white/15 bg-white/5 text-zinc-100 hover:bg-white/10">
                    <Link
                      href={
                        isValidTestUser
                          ? `/live-lineup?contestId=${featuredContestDef.id}&userId=${encodeURIComponent(userId)}`
                          : '/'
                      }
                    >
                      View Live Lineup
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="h-11 rounded-xl border-white/15 bg-white/5 text-zinc-100 hover:bg-white/10">
                    <Link
                      href={
                        isValidTestUser
                          ? `/live-leaderboard?contestId=${featuredContestDef.id}&userId=${encodeURIComponent(userId)}`
                          : '/'
                      }
                    >
                      View Live Leaderboard
                    </Link>
                  </Button>
                  {!isValidTestUser && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => router.push('/')}
                      className="h-11 rounded-xl border-amber-300/30 bg-amber-300/10 text-amber-200 hover:bg-amber-300/20"
                    >
                      Choose User
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {featuredContestDef && lockDate && (
            <div className="space-y-5">
              <Card className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#15131c] to-[#0f1017] text-zinc-100 shadow-[0_10px_40px_rgba(0,0,0,0.3)]">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-2">
                        <Trophy className="h-4 w-4 text-emerald-300" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">This Week</CardTitle>
                        <CardDescription className="text-zinc-400">Contest settings</CardDescription>
                      </div>
                    </div>
                    <Badge className={featuredContestDef.testMode ? 'rounded-full bg-amber-500/20 text-amber-300' : 'rounded-full bg-emerald-500/20 text-emerald-300'}>
                      {featuredContestDef.testMode ? 'TEST MODE' : featuredContestDef.status.toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-2 text-sm">
                    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <span className="text-zinc-400">Week</span>
                      <span className="font-semibold text-zinc-100">{featuredContestDef.weekNumber}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <span className="text-zinc-400">Roster Format</span>
                      <span className="font-semibold text-zinc-100">{featuredContestDef.rosterSize} golfers</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <span className="text-zinc-400">Salary Cap</span>
                      <span className="font-semibold text-zinc-100">${featuredContestDef.salaryCap.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <span className="text-zinc-400">Lock Time</span>
                      <span className="font-semibold text-zinc-100">{lockDate.toLocaleString()}</span>
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed text-zinc-500">
                    One lineup entry per user. Edit any time before lock, then lineups freeze automatically.
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#101723] to-[#0a101a] text-zinc-100">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Live Lineup Tracker</CardTitle>
                  <CardDescription className="text-zinc-400">Read your saved test-week lineup directly from Firestore</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <p className="text-xs uppercase tracking-wide text-zinc-500">Source</p>
                      <p className="mt-1 font-semibold text-zinc-100">Cloud Firestore</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <p className="text-xs uppercase tracking-wide text-zinc-500">Mode</p>
                      <p className="mt-1 font-semibold text-zinc-100">Test Week</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <p className="text-xs uppercase tracking-wide text-zinc-500">Updates</p>
                      <p className="mt-1 font-semibold text-zinc-100">Live subscribe</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <p className="text-xs uppercase tracking-wide text-zinc-500">Scoring</p>
                      <p className="mt-1 font-semibold text-zinc-100">Live DFS Rules</p>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Button asChild variant="outline" className="w-full rounded-xl border-white/15 bg-white/5 text-zinc-100 hover:bg-white/10">
                      <Link
                        href={
                          isValidTestUser
                            ? `/live-lineup?contestId=${featuredContestDef.id}&userId=${encodeURIComponent(userId)}`
                            : '/'
                        }
                      >
                        Open Live Lineup View
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="w-full rounded-xl border-white/15 bg-white/5 text-zinc-100 hover:bg-white/10">
                      <Link
                        href={
                          isValidTestUser
                            ? `/live-leaderboard?contestId=${featuredContestDef.id}&userId=${encodeURIComponent(userId)}`
                            : '/'
                        }
                      >
                        Open Live Leaderboard
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ContestsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#111318]" />}>
      <ContestsContent />
    </Suspense>
  );
}
