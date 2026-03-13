"use client";

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Check, Sparkles } from 'lucide-react';
import MainTabsHeader from '@/components/main-tabs-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { subscribeAuthSession, type AuthSession } from '@/lib/firebase-auth';
import { loadTestLineup } from '@/lib/firestore-lineups';
import { getLineupValidation } from '@/lib/lineup-builder';
import type { PersistedLineupEntry, PlayerPoolGolfer, WeeklyLeagueContest } from '@/lib/lineup-builder-types';
import { getDefaultContestId, getDefaultPlayerPool, getWeeklyContestById, WEEKLY_CONTESTS } from '@/lib/weekly-lineup-seed';
import { loadImportedPlayerPool, loadPersistedLineup, savePersistedLineup } from '@/lib/weekly-lineup-storage';

function getContestLabel(contestId: string) {
  const contest = getWeeklyContestById(contestId);
  if (contest) return contest.name;

  const match = contestId.match(/^week-(\d+)-(.+)$/i);
  if (!match) return contestId;
  const week = Number(match[1]);
  const name = match[2].replace(/-/g, ' ');
  const title = name.replace(/\b\w/g, (char) => char.toUpperCase());
  return `Week ${week} ${title}`;
}

function getFallbackContest(contestId: string): WeeklyLeagueContest {
  const weekMatch = contestId.match(/^week-(\d+)-/i);
  const weekNumber = weekMatch ? Number(weekMatch[1]) : 0;
  return {
    id: contestId,
    weekNumber,
    name: getContestLabel(contestId),
    hostLabel: 'unknown host',
    entryFeeDisplay: '$0',
    lockAtIso: '2026-01-01T00:00:00.000Z',
    status: 'open',
    salaryCap: 50000,
    rosterSize: 6,
    entryNumberLabel: '--/--',
    testMode: true,
    lockDisabled: true,
  };
}

function ContestsContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const contestId = searchParams.get('contestId') ?? getDefaultContestId();

  const [session, setSession] = useState<AuthSession | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [savedEntry, setSavedEntry] = useState<PersistedLineupEntry | null>(null);
  const [savedPool, setSavedPool] = useState<PlayerPoolGolfer[]>([]);

  const contest = getWeeklyContestById(contestId) ?? getFallbackContest(contestId);
  const contestOptions = useMemo(() => {
    const ids = [contestId, ...WEEKLY_CONTESTS.map((item) => item.id)];
    return Array.from(new Set(ids)).map((id) => ({ id, label: getContestLabel(id) }));
  }, [contestId]);

  useEffect(() => {
    const unsubscribe = subscribeAuthSession((nextSession) => {
      setSession(nextSession);
      setCheckingSession(false);
      if (!nextSession) {
        router.replace('/');
      }
    });

    return () => {
      unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (!session) {
      setSavedEntry(null);
      return;
    }

    const importedPool = loadImportedPlayerPool(contest.id);
    setSavedPool(importedPool && importedPool.length ? importedPool : getDefaultPlayerPool(contest.id));

    const localEntry = loadPersistedLineup(contest.id, session.userSlug);
    setSavedEntry(localEntry);

    let cancelled = false;
    void (async () => {
      try {
        const cloudEntry = await loadTestLineup(contest.id, session.userSlug);
        if (cancelled || !cloudEntry) return;
        setSavedEntry(cloudEntry);
        savePersistedLineup({
          ...cloudEntry,
          userKey: session.userSlug,
        });
      } catch {
        // local fallback remains
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [contest.id, session]);

  const savedLineupIds = savedEntry?.lineupGolferIds ?? [];
  const savedLineupSummary = useMemo(() => {
    const validation = getLineupValidation(savedLineupIds, savedPool, contest);
    const golferMap = new Map(savedPool.map((golfer) => [golfer.golferId, golfer]));
    const golfers = savedLineupIds
      .map((id) => golferMap.get(id))
      .filter((g): g is PlayerPoolGolfer => Boolean(g));
    return { validation, golfers };
  }, [contest, savedLineupIds, savedPool]);

  if (checkingSession) {
    return <div className="min-h-screen bg-[#080c13]" />;
  }

  if (!session) {
    return null;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#080c13] px-4 py-6 text-zinc-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-8 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-5xl space-y-5">
        <MainTabsHeader session={session} activeTab="home" contestId={contest.id} />

        <header className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#171f2d] via-[#111827] to-[#0b1018] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.5)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-400">5x5 Global</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">2026 Golf DK Championship</h1>
            </div>
            <label className="inline-flex items-center rounded-md border border-white/15 bg-white/5 px-2 text-sm text-zinc-200">
              <span className="mr-2 text-xs uppercase tracking-wide text-zinc-500">Week</span>
              <select
                value={contest.id}
                onChange={(event) => {
                  const next = new URLSearchParams(searchParams.toString());
                  next.set('contestId', event.target.value);
                  router.push(`${pathname}?${next.toString()}`);
                }}
                className="bg-transparent py-2 text-sm text-zinc-100 outline-none"
              >
                {contestOptions.map((option) => (
                  <option key={option.id} value={option.id} className="bg-[#0d1420]">
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
            <Sparkles className="h-4 w-4 text-emerald-300" />
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Logged In As</p>
              <p className="text-sm font-semibold text-zinc-100">{session.userDisplayName}</p>
            </div>
          </div>
        </header>

        <Card className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#101823] to-[#0b1017] text-zinc-100 shadow-[0_16px_55px_rgba(0,0,0,0.35)]">
          <div className="h-1.5 bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500" />
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-2xl tracking-tight">{contest.name}</CardTitle>
                <CardDescription className="mt-1 text-zinc-400">Home</CardDescription>
                <p className="mt-2 text-xs text-zinc-400">
                  Lock: {new Date(contest.lockAtIso).toLocaleString()}
                </p>
              </div>
              <Badge className={savedLineupSummary.validation.isLocked ? 'bg-zinc-700 text-zinc-100' : 'bg-blue-500/20 text-blue-300'}>
                {savedLineupSummary.validation.isLocked ? 'LOCKED' : 'OPEN'}
              </Badge>
            </div>
            {savedEntry?.submittedAtIso && (
              <div className="inline-flex items-center gap-2 text-sm text-emerald-300">
                <Check className="h-4 w-4" />
                Submitted {new Date(savedEntry.submittedAtIso).toLocaleString()}
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Roster</p>
                <p className="mt-1 font-semibold text-zinc-100">{contest.rosterSize} golfers</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Salary Cap</p>
                <p className="mt-1 font-semibold text-zinc-100">${contest.salaryCap.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Selected</p>
                <p className="mt-1 font-semibold text-zinc-100">
                  {`${savedLineupSummary.validation.positionsFilled}/${contest.rosterSize}`}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Status</p>
                <p className="mt-1 font-semibold text-zinc-100">{contest.status.toUpperCase()}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0a1018]/90 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">My Lineup</p>
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
                  No lineup found yet for this week.
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild className="h-11 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 px-5 text-white hover:from-blue-400 hover:to-cyan-300">
                <Link href={`/lineup?contestId=${contest.id}`}>My Lineup</Link>
              </Button>
              <Button asChild variant="outline" className="h-11 rounded-xl border-white/15 bg-white/5 text-zinc-100 hover:bg-white/10">
                <Link href={`/week-standings?contestId=${contest.id}`}>Week Standings</Link>
              </Button>
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
