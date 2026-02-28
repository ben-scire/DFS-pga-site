"use client";

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Radio, RefreshCcw, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { subscribeToTestGolferScores, type TestGolferLiveScore } from '@/lib/firestore-live-scores';
import {
  isFirestoreLineupStorageAvailable,
  loadTestLineup,
  subscribeToTestLineup,
} from '@/lib/firestore-lineups';
import { getLineupValidation } from '@/lib/lineup-builder';
import type { PersistedLineupEntry, PlayerPoolGolfer } from '@/lib/lineup-builder-types';
import { getTestUserName } from '@/lib/test-users';
import { getDefaultPlayerPool, getWeeklyContestById } from '@/lib/weekly-lineup-seed';
import { loadImportedPlayerPool, loadPersistedLineup, savePersistedLineup } from '@/lib/weekly-lineup-storage';

function formatToPar(value: string | number | undefined): string {
  if (value === undefined) return '--';
  if (typeof value === 'number') {
    if (value === 0) return 'E';
    return value > 0 ? `+${value}` : `${value}`;
  }

  const trimmed = value.trim();
  if (!trimmed) return '--';
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return trimmed.toUpperCase();
  if (parsed === 0) return 'E';
  return parsed > 0 ? `+${parsed}` : `${parsed}`;
}

function formatPosition(value: string | undefined): string {
  if (!value?.trim()) return '--';
  return value.trim().toUpperCase();
}

function LiveLineupContent() {
  const searchParams = useSearchParams();
  const contestId = searchParams.get('contestId') ?? 'week-1-cognizant';
  const lineupUserId = searchParams.get('userId') ?? 'guest';
  const viewerUserId = searchParams.get('viewerId')?.trim() || lineupUserId;

  const contest = getWeeklyContestById(contestId);
  const lineupUserName = getTestUserName(lineupUserId) ?? lineupUserId;
  const isValidUser = Boolean(getTestUserName(lineupUserId));

  const [playerPool, setPlayerPool] = useState<PlayerPoolGolfer[]>([]);
  const [entry, setEntry] = useState<PersistedLineupEntry | null>(null);
  const [cloudStatus, setCloudStatus] = useState<'checking' | 'live' | 'local-only' | 'error'>('checking');
  const [liveScores, setLiveScores] = useState<Record<string, TestGolferLiveScore>>({});
  const [scoreStatus, setScoreStatus] = useState<'checking' | 'live' | 'no-feed' | 'error'>('checking');

  useEffect(() => {
    if (!contest) return;
    const imported = loadImportedPlayerPool(contest.id);
    setPlayerPool(imported && imported.length ? imported : getDefaultPlayerPool(contest.id));

    const local = loadPersistedLineup(contest.id, lineupUserId);
    setEntry(local);

    if (!isValidUser || !isFirestoreLineupStorageAvailable()) {
      setCloudStatus('local-only');
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const cloudEntry = await loadTestLineup(contest.id, lineupUserId);
        if (cancelled) return;
        if (cloudEntry) {
          setEntry(cloudEntry);
          savePersistedLineup({ ...cloudEntry, userKey: lineupUserId });
        }
        setCloudStatus('live');
      } catch {
        if (!cancelled) setCloudStatus('error');
      }
    })();

    const unsubscribe = subscribeToTestLineup(
      contest.id,
      lineupUserId,
      (nextEntry) => {
        if (cancelled) return;
        if (nextEntry) {
          setEntry(nextEntry);
          savePersistedLineup({ ...nextEntry, userKey: lineupUserId });
        }
        setCloudStatus('live');
      },
      () => {
        if (!cancelled) setCloudStatus('error');
      }
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [contest, isValidUser, lineupUserId]);

  useEffect(() => {
    if (!contest) return;
    if (!isFirestoreLineupStorageAvailable()) {
      setScoreStatus('no-feed');
      return;
    }

    let cancelled = false;
    const unsubscribe = subscribeToTestGolferScores(
      contest.id,
      (scoresByGolferId) => {
        if (cancelled) return;
        setLiveScores(scoresByGolferId);
        setScoreStatus('live');
      },
      () => {
        if (!cancelled) setScoreStatus('error');
      }
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [contest]);

  const lineupGolfers = useMemo(() => {
    if (!entry) return [];
    const map = new Map(playerPool.map((g) => [g.golferId, g]));
    return entry.lineupGolferIds.map((id) => map.get(id)).filter((g): g is PlayerPoolGolfer => Boolean(g));
  }, [entry, playerPool]);

  const validation = useMemo(() => {
    if (!contest) return null;
    return getLineupValidation(entry?.lineupGolferIds ?? [], playerPool, contest);
  }, [contest, entry?.lineupGolferIds, playerPool]);

  const lineupLiveStats = useMemo(() => {
    const rows = lineupGolfers.map((golfer) => ({
      golfer,
      score: liveScores[golfer.golferId] ?? null,
    }));
    const totalLivePoints = rows.reduce((sum, row) => sum + (row.score?.fantasyPoints ?? 0), 0);
    const golfersWithLivePoints = rows.filter((row) => typeof row.score?.fantasyPoints === 'number').length;
    const latestUpdateIso = rows
      .map((row) => row.score?.updatedAtIso)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1);

    return {
      rows,
      totalLivePoints,
      golfersWithLivePoints,
      latestUpdateIso,
    };
  }, [lineupGolfers, liveScores]);

  if (!contest || !validation) {
    return <div className="min-h-screen bg-[#080c13] text-zinc-100" />;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050a12] px-3 py-4 text-zinc-100 sm:px-4 sm:py-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 top-4 h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute -right-20 top-24 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(45,212,191,0.45) 1px, transparent 1px), linear-gradient(90deg, rgba(45,212,191,0.45) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      <div className="relative mx-auto max-w-4xl space-y-4">
        <header className="rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-[#101a2c] via-[#0b1322] to-[#080d15] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.55)] sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-200/70">5x5 Global</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl">Live Lineup View</h1>
              <p className="mt-2 text-sm text-zinc-400">{contest.name} · {lineupUserName}</p>
            </div>
            <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-3">
              <Button asChild variant="outline" className="border-cyan-300/25 bg-white/[0.03] text-zinc-100 hover:bg-white/10">
                <Link href={`/contests?userId=${encodeURIComponent(viewerUserId)}`}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Link>
              </Button>
              <Button asChild className="bg-cyan-500 text-[#061420] hover:bg-cyan-400">
                <Link href={`/lineup?contestId=${contest.id}&userId=${encodeURIComponent(viewerUserId)}&viewerId=${encodeURIComponent(viewerUserId)}`}>
                  <RefreshCcw className="mr-2 h-4 w-4" /> Lineup
                </Link>
              </Button>
              <Button asChild variant="outline" className="border-cyan-300/25 bg-white/[0.03] text-zinc-100 hover:bg-white/10">
                <Link href={`/live-leaderboard?contestId=${contest.id}&userId=${encodeURIComponent(viewerUserId)}`}>
                  <TrendingUp className="mr-2 h-4 w-4" /> Board
                </Link>
              </Button>
            </div>
          </div>
        </header>

        <Card className="rounded-3xl border border-cyan-300/20 bg-[#0b1322]/90 text-zinc-100 shadow-[0_16px_48px_rgba(0,0,0,0.45)]">
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-xl text-zinc-100">Lineup Status</CardTitle>
                <CardDescription className="text-zinc-400">
                  {entry?.submittedAtIso ? `Submitted ${new Date(entry.submittedAtIso).toLocaleString()}` : 'Draft only (not submitted yet)'}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {contest.testMode && <Badge className="bg-amber-500/20 text-amber-300">TEST MODE</Badge>}
                <Badge className={validation.isLocked ? 'bg-zinc-700 text-zinc-100' : 'bg-blue-500/20 text-blue-300'}>
                  {validation.isLocked ? 'LOCKED' : 'EDITABLE'}
                </Badge>
              </div>
            </div>
            <div className="rounded-xl border border-cyan-300/10 bg-cyan-400/[0.04] px-3 py-2 text-sm text-zinc-300">
              {cloudStatus === 'live' && 'Cloud connected. This lineup updates when source entries update.'}
              {cloudStatus === 'local-only' && 'Cloud unavailable in this session. Showing local copy.'}
              {cloudStatus === 'error' && 'Cloud sync error. Showing last available lineup data.'}
              {cloudStatus === 'checking' && 'Checking cloud lineup...'}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Filled</p>
                <p className="mt-1 font-semibold">{validation.positionsFilled}/{contest.rosterSize}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Salary</p>
                <p className="mt-1 font-semibold">${validation.salaryUsed.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Remaining</p>
                <p className={validation.salaryRemaining >= 0 ? 'mt-1 font-semibold text-emerald-300' : 'mt-1 font-semibold text-red-300'}>
                  ${validation.salaryRemaining.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Live Pts</p>
                <p className="mt-1 font-semibold text-cyan-300">{lineupLiveStats.totalLivePoints.toFixed(1)}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 sm:col-span-3 lg:col-span-2">
                <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Feed</p>
                <p className="mt-1 font-semibold text-zinc-200">
                  {scoreStatus === 'live' ? `${lineupLiveStats.golfersWithLivePoints}/${lineupGolfers.length} players live` : 'Waiting for feed'}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 sm:col-span-3 lg:col-span-2">
                <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Updated</p>
                <p className="mt-1 text-sm font-semibold text-zinc-100">
                  {lineupLiveStats.latestUpdateIso ? new Date(lineupLiveStats.latestUpdateIso).toLocaleString() : 'No live update yet'}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.04] p-3 text-sm text-zinc-300">
              <div className="flex items-center gap-2 font-medium text-zinc-100">
                <TrendingUp className="h-4 w-4 text-cyan-300" />
                Live feed status
              </div>
              <p className="mt-1 text-zinc-400">
                {scoreStatus === 'live' && 'Reading live golfer score docs from Firestore (`test_scores`).'}
                {scoreStatus === 'checking' && 'Connecting to live score docs...'}
                {scoreStatus === 'no-feed' && 'Firestore is not configured in this build, so live score docs are unavailable.'}
                {scoreStatus === 'error' && 'Live score subscription failed. Showing lineup without live points.'}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#070d18]/90 p-3 sm:p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Submitted Roster</p>
                <div className="flex items-center gap-1 text-xs text-zinc-400">
                  <Radio className="h-3.5 w-3.5 text-cyan-300" /> Live
                </div>
              </div>

              {lineupGolfers.length ? (
                <div className="space-y-3">
                  {lineupLiveStats.rows.map(({ golfer, score }, idx) => (
                    <div key={golfer.golferId} className="rounded-2xl border border-cyan-300/10 bg-white/[0.03] p-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-400/10 text-xs font-semibold text-cyan-200">
                          {idx + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-base font-semibold leading-tight text-zinc-100 break-words">{golfer.name}</p>
                          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                            <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-zinc-300">
                              POS {formatPosition(score?.position)}
                            </span>
                            <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-zinc-300">
                              TO PAR {formatToPar(score?.scoreToPar)}
                            </span>
                            <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-zinc-300">
                              THRU {score?.thru !== undefined ? score.thru : '--'}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-zinc-400">
                            {score?.status ? score.status.toUpperCase() : golfer.teeTimeDisplay ?? 'Pre-round'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 sm:ml-auto sm:max-w-xs">
                        <div className="rounded-xl border border-cyan-300/15 bg-cyan-400/[0.06] px-3 py-2 text-center">
                          <p className="text-sm font-semibold text-cyan-200">
                            {typeof score?.fantasyPoints === 'number' ? score.fantasyPoints.toFixed(1) : '--'}
                          </p>
                          <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Live Pts</p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-center">
                          <p className="text-sm font-semibold text-zinc-200">${golfer.salary.toLocaleString()}</p>
                          <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Salary</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-zinc-500">
                  No lineup saved for this user yet.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function LiveLineupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#080c13]" />}>
      <LiveLineupContent />
    </Suspense>
  );
}
