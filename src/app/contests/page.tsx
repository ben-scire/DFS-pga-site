"use client";

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, ChevronRight, Trophy } from 'lucide-react';
import MainTabsHeader from '@/components/main-tabs-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { subscribeAuthSession, type AuthSession } from '@/lib/firebase-auth';
import { loadTestLineup } from '@/lib/firestore-lineups';
import { getLineupValidation } from '@/lib/lineup-builder';
import type { PersistedLineupEntry, PlayerPoolGolfer, WeeklyLeagueContest } from '@/lib/lineup-builder-types';
import {
  getNextQuarterEvent,
  getQuarterFinaleEvent,
  getSeasonEventColumns,
  getSeasonStandingsRows,
  getShortEventLabel,
  getUpcomingQuarterEvents,
} from '@/lib/season-display';
import { getDefaultContestId, getDefaultPlayerPool, getWeeklyContestById } from '@/lib/weekly-lineup-seed';
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

function getPodiumTone(place: number) {
  if (place === 1) return 'from-amber-300/30 via-amber-200/20 to-[#181f2f] border-amber-200/40';
  if (place === 2) return 'from-slate-100/40 via-slate-200/24 to-[#1b2535] border-slate-100/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.24)]';
  return 'from-orange-300/20 via-orange-200/10 to-[#151c28] border-orange-200/30';
}

function getEventTierBadgeClass(tier: 'Standard' | 'Signature' | 'Major') {
  if (tier === 'Signature') return 'border-amber-300/35 bg-amber-300/12 text-amber-100';
  if (tier === 'Major') return 'border-rose-300/35 bg-rose-300/12 text-rose-100';
  return 'border-cyan-300/35 bg-cyan-300/12 text-cyan-100';
}

function getPodiumPlaceLabel(rank: number | null): string {
  if (rank === 1) return '1st';
  if (rank === 2) return '2nd';
  if (rank === 3) return '3rd';
  if (!rank || rank < 1) return '--';
  const remainder100 = rank % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return `${rank}th`;
  const remainder10 = rank % 10;
  if (remainder10 === 1) return `${rank}st`;
  if (remainder10 === 2) return `${rank}nd`;
  if (remainder10 === 3) return `${rank}rd`;
  return `${rank}th`;
}

function ContestsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contestId = searchParams.get('contestId') ?? getDefaultContestId();

  const [session, setSession] = useState<AuthSession | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [savedEntry, setSavedEntry] = useState<PersistedLineupEntry | null>(null);
  const [savedPool, setSavedPool] = useState<PlayerPoolGolfer[]>([]);

  const contest = getWeeklyContestById(contestId) ?? getFallbackContest(contestId);
  const standings = useMemo(() => getSeasonStandingsRows(), []);
  const eventColumns = useMemo(() => getSeasonEventColumns(), []);
  const latestColumn = eventColumns[0] ?? null;
  const podium = standings.slice(0, 3);
  const inTheHunt = standings.slice(3, 10);
  const nextEvent = getNextQuarterEvent(1);
  const quarterFinale = getQuarterFinaleEvent(1);
  const q1Remaining = getUpcomingQuarterEvents(1);

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
    <div className="relative min-h-screen overflow-hidden bg-[#080c13] px-3 py-4 text-zinc-100 sm:px-4 sm:py-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-8 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl space-y-5">
        <MainTabsHeader session={session} activeTab="home" contestId={contest.id} />

        <Card className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#101823] to-[#0b1017] text-zinc-100 shadow-[0_16px_55px_rgba(0,0,0,0.35)]">
          <div className="h-1.5 bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500" />
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-cyan-300" />
              <CardTitle className="text-xl tracking-tight sm:text-2xl">Season Podium Snapshot</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="grid grid-cols-3 items-end gap-1.5 sm:gap-3">
              {[podium[1], podium[0], podium[2]].filter(Boolean).map((entry) => {
                const isLeader = entry.rank === 1;
                return (
                  <div
                    key={entry.entryId}
                    className={`min-w-0 rounded-2xl border bg-gradient-to-b p-2 sm:rounded-3xl sm:p-4 ${getPodiumTone(entry.rank ?? 3)} ${isLeader ? '-translate-y-1.5 sm:-translate-y-3' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="inline-flex shrink-0 rounded-full border border-white/20 bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-100 sm:px-2 sm:py-1 sm:text-xs">
                        {getPodiumPlaceLabel(entry.rank)}
                      </span>
                      <span className="shrink-0 text-xs font-extrabold text-cyan-300 sm:text-2xl">
                        {entry.championshipPoints}
                      </span>
                    </div>
                    <h2 className="mt-2 break-words text-[clamp(0.82rem,3.9vw,1.9rem)] font-bold leading-[1.05] text-zinc-50">
                      {entry.displayName}
                    </h2>
                  </div>
                );
              })}
            </div>

            <div className="rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-cyan-400/14 via-blue-400/8 to-[#0d1420] p-3 sm:p-4">
              <div className="mb-3">
                <h3 className="text-lg font-semibold">In the Hunt</h3>
              </div>
              <div className="space-y-2">
                {inTheHunt.map((entry) => (
                  <div key={entry.entryId} className="flex items-center justify-between gap-3 rounded-2xl border border-cyan-300/15 bg-[#0d1626]/90 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-100 sm:text-base">#{entry.rank} {entry.displayName}</p>
                      {latestColumn && (
                        <p className="text-xs text-zinc-400">
                          {latestColumn.shortLabel}: {entry.finishByEventId[latestColumn.eventId]}
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-cyan-200">{entry.championshipPoints} pts</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-3xl border border-white/10 bg-[#0c1218]/95 text-zinc-100">
            <CardHeader>
              <CardTitle>Q1 Runway</CardTitle>
              <CardDescription className="text-zinc-400">Remaining Q1 events after Valero.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {q1Remaining.map((event) => (
                <div key={event.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <div>
                    <p className="font-medium">{getShortEventLabel(event.id, event.name)}</p>
                    <p className="text-[11px] text-zinc-500">{event.name}</p>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                      {event.tier} Event
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getEventTierBadgeClass(event.tier)}>{event.tier}</Badge>
                    {event.id === nextEvent?.id && (
                      <Badge className="border border-emerald-300/30 bg-emerald-300/10 text-emerald-100">Next</Badge>
                    )}
                    {event.isQuarterFinale && (
                      <Badge className="border border-amber-300/30 bg-amber-300/10 text-amber-100">Finale</Badge>
                    )}
                    {!event.isQuarterFinale && event.id !== nextEvent?.id && (
                      <ChevronRight className="h-4 w-4 text-zinc-500" />
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-3xl border border-white/10 bg-[#0b1118]/95 text-zinc-100 shadow-[0_16px_55px_rgba(0,0,0,0.3)]">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-2xl tracking-tight">{contest.name}</CardTitle>
                <CardDescription className="mt-1 text-zinc-400">Week Hub</CardDescription>
                <p className="mt-2 text-xs text-zinc-500">Lock: {new Date(contest.lockAtIso).toLocaleString()}</p>
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
          <CardContent className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <div className="rounded-2xl border border-white/10 bg-[#0a1018]/90 p-3 sm:p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">My Lineup</p>
                <p className="text-xs text-zinc-500">{savedLineupSummary.golfers.length} selected</p>
              </div>
              {savedLineupSummary.golfers.length ? (
                <div className="grid gap-2">
                  {savedLineupSummary.golfers.map((golfer, idx) => (
                    <div
                      key={golfer.golferId}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 text-sm"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-zinc-200">
                          {idx + 1}
                        </span>
                        <span className="truncate font-medium text-zinc-100">{golfer.name}</span>
                      </div>
                      <span className="shrink-0 font-semibold text-zinc-300">${golfer.salary.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-zinc-500">
                  No lineup found yet for this week.
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2.5 text-sm sm:gap-3">
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

              <div className="flex flex-wrap gap-2">
                <Button asChild className="h-11 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 px-5 text-white hover:from-blue-400 hover:to-cyan-300">
                  <Link href={`/lineup?contestId=${contest.id}`}>My Lineup</Link>
                </Button>
                <Button asChild variant="outline" className="h-11 rounded-xl border-white/15 bg-white/5 text-zinc-100 hover:bg-white/10">
                  <Link href={`/week-standings?contestId=${contest.id}`}>Week Standings</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ContestsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#080c13]" />}>
      <ContestsContent />
    </Suspense>
  );
}
