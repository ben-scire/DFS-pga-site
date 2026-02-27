"use client";

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Sparkles } from 'lucide-react';
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
  const searchParams = useSearchParams();
  const userId = searchParams.get('userId') ?? 'guest';

  const featuredContest = WEEKLY_CONTESTS[0];
  const featuredContestDef = getWeeklyContestById(featuredContest.id);
  const resolvedUserName = getTestUserName(userId);
  const userLabel = resolvedUserName ?? 'Guest';
  const isValidTestUser = Boolean(resolvedUserName);

  const [savedEntry, setSavedEntry] = useState<PersistedLineupEntry | null>(null);
  const [savedPool, setSavedPool] = useState<PlayerPoolGolfer[]>([]);

  useEffect(() => {
    const contest = getWeeklyContestById(featuredContest.id);
    if (!contest) return;
    if (!isValidTestUser) {
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
        // Keep local fallback for this session.
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

  if (!featuredContestDef) {
    return <div className="min-h-screen bg-[#080c13]" />;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#080c13] px-4 py-6 text-zinc-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-8 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-4xl space-y-5">
        <header className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#171f2d] via-[#111827] to-[#0b1018] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.5)]">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-400">5x5 Global</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">2026 Golf DK Championship</h1>
          <div className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
            <Sparkles className="h-4 w-4 text-emerald-300" />
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Logged In As</p>
              <p className="text-sm font-semibold text-zinc-100">{userLabel}</p>
            </div>
          </div>
        </header>

        <Card className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#101823] to-[#0b1017] text-zinc-100 shadow-[0_16px_55px_rgba(0,0,0,0.35)]">
          <div className="h-1.5 bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500" />
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-2xl tracking-tight">{featuredContestDef.name}</CardTitle>
                <CardDescription className="mt-1 text-zinc-400">Tournament Event</CardDescription>
              </div>
              <Badge className={savedLineupSummary?.validation.isLocked ? 'bg-zinc-700 text-zinc-100' : 'bg-blue-500/20 text-blue-300'}>
                {savedLineupSummary?.validation.isLocked ? 'LOCKED' : 'OPEN'}
              </Badge>
            </div>
            {!isValidTestUser && (
              <p className="text-sm font-medium text-amber-300">
                Select one of the approved users from the home page to open lineup and leaderboard views.
              </p>
            )}
            {savedEntry?.submittedAtIso && (
              <p className="text-sm text-zinc-400">Submitted {new Date(savedEntry.submittedAtIso).toLocaleString()}</p>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Roster</p>
                <p className="mt-1 font-semibold text-zinc-100">{featuredContestDef.rosterSize} golfers</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Salary Cap</p>
                <p className="mt-1 font-semibold text-zinc-100">${featuredContestDef.salaryCap.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Selected</p>
                <p className="mt-1 font-semibold text-zinc-100">
                  {savedLineupSummary ? `${savedLineupSummary.validation.positionsFilled}/${featuredContestDef.rosterSize}` : `0/${featuredContestDef.rosterSize}`}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Status</p>
                <p className="mt-1 font-semibold text-zinc-100">{featuredContestDef.status.toUpperCase()}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0a1018]/90 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Lineup</p>
                <p className="text-xs text-zinc-500">{savedLineupSummary?.golfers.length ?? 0} selected</p>
              </div>
              {savedLineupSummary?.golfers.length ? (
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
                  No lineup found for this user.
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild disabled={!isValidTestUser} className="h-11 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 px-5 text-white hover:from-blue-400 hover:to-cyan-300 disabled:pointer-events-none disabled:opacity-50">
                <Link href={isValidTestUser ? `/lineup?contestId=${featuredContestDef.id}&userId=${encodeURIComponent(userId)}&viewerId=${encodeURIComponent(userId)}` : '/'}>
                  View Lineup
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-11 rounded-xl border-white/15 bg-white/5 text-zinc-100 hover:bg-white/10">
                <Link href={isValidTestUser ? `/live-lineup?contestId=${featuredContestDef.id}&userId=${encodeURIComponent(userId)}&viewerId=${encodeURIComponent(userId)}` : '/'}>
                  View Live Lineup
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-11 rounded-xl border-white/15 bg-white/5 text-zinc-100 hover:bg-white/10">
                <Link href={isValidTestUser ? `/live-leaderboard?contestId=${featuredContestDef.id}&userId=${encodeURIComponent(userId)}` : '/'}>
                  View Live Leaderboard
                </Link>
              </Button>
              {!isValidTestUser && (
                <Button asChild variant="outline" className="h-11 rounded-xl border-amber-300/30 bg-amber-300/10 text-amber-200 hover:bg-amber-300/20">
                  <Link href="/">Choose User</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
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
