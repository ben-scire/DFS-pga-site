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

function LiveLineupContent() {
  const searchParams = useSearchParams();
  const contestId = searchParams.get('contestId') ?? 'week-1-cognizant';
  const userId = searchParams.get('userId') ?? 'guest';

  const contest = getWeeklyContestById(contestId);
  const userName = getTestUserName(userId) ?? userId;
  const isValidUser = Boolean(getTestUserName(userId));

  const [playerPool, setPlayerPool] = useState<PlayerPoolGolfer[]>([]);
  const [entry, setEntry] = useState<PersistedLineupEntry | null>(null);
  const [cloudStatus, setCloudStatus] = useState<'checking' | 'live' | 'local-only' | 'error'>('checking');
  const [liveScores, setLiveScores] = useState<Record<string, TestGolferLiveScore>>({});
  const [scoreStatus, setScoreStatus] = useState<'checking' | 'live' | 'no-feed' | 'error'>('checking');

  useEffect(() => {
    if (!contest) return;
    const imported = loadImportedPlayerPool(contest.id);
    setPlayerPool(imported && imported.length ? imported : getDefaultPlayerPool(contest.id));

    const local = loadPersistedLineup(contest.id, userId);
    setEntry(local);

    if (!isValidUser || !isFirestoreLineupStorageAvailable()) {
      setCloudStatus('local-only');
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const cloudEntry = await loadTestLineup(contest.id, userId);
        if (cancelled) return;
        if (cloudEntry) {
          setEntry(cloudEntry);
          savePersistedLineup({ ...cloudEntry, userKey: userId });
        }
        setCloudStatus('live');
      } catch {
        if (!cancelled) setCloudStatus('error');
      }
    })();

    const unsubscribe = subscribeToTestLineup(
      contest.id,
      userId,
      (nextEntry) => {
        if (cancelled) return;
        if (nextEntry) {
          setEntry(nextEntry);
          savePersistedLineup({ ...nextEntry, userKey: userId });
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
  }, [contest, isValidUser, userId]);

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
    <div className="min-h-screen bg-[#080c13] px-4 py-6 text-zinc-100">
      <div className="mx-auto max-w-4xl space-y-4">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#171f2d] via-[#111827] to-[#0b1018] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">5x5 Global</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">Live Lineup View</h1>
              <p className="mt-2 text-sm text-zinc-400">{contest.name} · {userName}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" className="border-white/15 bg-white/5 text-zinc-100 hover:bg-white/10">
                <Link href={`/contests?userId=${encodeURIComponent(userId)}`}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to Contests
                </Link>
              </Button>
              <Button asChild className="bg-blue-500 text-white hover:bg-blue-400">
                <Link href={`/lineup?contestId=${contest.id}&userId=${encodeURIComponent(userId)}`}>
                  <RefreshCcw className="mr-2 h-4 w-4" /> Edit Lineup
                </Link>
              </Button>
              <Button asChild variant="outline" className="border-white/15 bg-white/5 text-zinc-100 hover:bg-white/10">
                <Link href={`/live-leaderboard?contestId=${contest.id}&userId=${encodeURIComponent(userId)}`}>
                  <TrendingUp className="mr-2 h-4 w-4" /> Leaderboard
                </Link>
              </Button>
            </div>
          </div>
        </header>

        <Card className="rounded-3xl border border-white/10 bg-[#101722] text-zinc-100">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-xl">Lineup Status</CardTitle>
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
            <div className="text-sm text-zinc-300">
              {cloudStatus === 'live' && 'Cloud connected. This lineup updates if the same user entry changes elsewhere.'}
              {cloudStatus === 'local-only' && 'Cloud not available for this session. Showing local browser copy.'}
              {cloudStatus === 'error' && 'Cloud sync error. Showing last available lineup data.'}
              {cloudStatus === 'checking' && 'Checking cloud lineup...'}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Filled</p>
                <p className="mt-1 font-semibold">{validation.positionsFilled}/{contest.rosterSize}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Salary Used</p>
                <p className="mt-1 font-semibold">${validation.salaryUsed.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Remaining</p>
                <p className={validation.salaryRemaining >= 0 ? 'mt-1 font-semibold text-emerald-300' : 'mt-1 font-semibold text-red-300'}>
                  ${validation.salaryRemaining.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Cap Status</p>
                <p className={validation.isUnderSalaryCap ? 'mt-1 font-semibold text-emerald-300' : 'mt-1 font-semibold text-red-300'}>
                  {validation.isUnderSalaryCap ? 'Under Cap' : 'Over Cap'}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Live Points</p>
                <p className="mt-1 font-semibold text-emerald-300">{lineupLiveStats.totalLivePoints.toFixed(1)}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Live Feed</p>
                <p className="mt-1 font-semibold">
                  {scoreStatus === 'live' ? `${lineupLiveStats.golfersWithLivePoints}/${lineupGolfers.length} players` : '--'}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 md:col-span-2">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Last Live Update</p>
                <p className="mt-1 font-semibold text-zinc-100">
                  {lineupLiveStats.latestUpdateIso ? new Date(lineupLiveStats.latestUpdateIso).toLocaleString() : 'Waiting for live score docs'}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-blue-400/10 bg-blue-400/5 p-4 text-sm text-zinc-300">
              <div className="flex items-center gap-2 font-medium text-zinc-100">
                <TrendingUp className="h-4 w-4 text-blue-300" />
                Live points feed status
              </div>
              <p className="mt-1 text-zinc-400">
                {scoreStatus === 'live' && 'Reading live golfer score docs from Firestore (`test_scores`).'}
                {scoreStatus === 'checking' && 'Connecting to live score docs...'}
                {scoreStatus === 'no-feed' && 'Firestore is not configured in this build, so live score docs are unavailable.'}
                {scoreStatus === 'error' && 'Live score subscription failed. Showing lineup without live points.'}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0a1018] p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Submitted Roster</p>
                <div className="flex items-center gap-1 text-xs text-zinc-400">
                  <Radio className="h-3.5 w-3.5 text-emerald-300" /> Live view
                </div>
              </div>

              {lineupGolfers.length ? (
                <div className="space-y-2">
                  {lineupLiveStats.rows.map(({ golfer, score }, idx) => (
                    <div key={golfer.golferId} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2">
                      <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-zinc-200">
                        {idx + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-zinc-100">{golfer.name}</p>
                        <p className="text-xs text-zinc-400">
                          {score?.position ? `POS ${score.position}` : 'POS --'} ·{' '}
                          {score?.scoreToPar !== undefined ? `Score ${score.scoreToPar}` : 'Score --'} ·{' '}
                          {score?.thru !== undefined ? `Thru ${score.thru}` : 'Thru --'} ·{' '}
                          {score?.status ? score.status.toUpperCase() : golfer.teeTimeDisplay ?? 'Pre-round'}
                        </p>
                      </div>
                      <div className="min-w-[108px] text-right">
                        <p className="font-semibold text-emerald-300">
                          {typeof score?.fantasyPoints === 'number' ? score.fantasyPoints.toFixed(1) : '--'}
                        </p>
                        <p className="text-xs text-zinc-500">LIVE PTS</p>
                      </div>
                      <div className="min-w-[86px] text-right">
                        <p className="font-semibold text-zinc-200">${golfer.salary.toLocaleString()}</p>
                        <p className="text-xs text-zinc-500">SALARY</p>
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

            <div className="rounded-2xl border border-emerald-400/10 bg-emerald-400/5 p-4 text-sm text-zinc-300">
              <p className="font-medium text-zinc-100">Live points are now supported</p>
              <p className="mt-1 text-zinc-400">
                Populate Firestore docs at <span className="font-mono text-zinc-300">test_scores/{contest.id}/golfers/&lt;golferId&gt;</span> with a{' '}
                <span className="font-mono text-zinc-300">fantasyPoints</span> field (and optional position/thru/status) to drive this view.
              </p>
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
