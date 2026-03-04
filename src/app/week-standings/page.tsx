"use client";

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Radio, Trophy } from 'lucide-react';
import MainTabsHeader from '@/components/main-tabs-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { subscribeAuthSession, type AuthSession } from '@/lib/firebase-auth';
import { subscribeToTestGolferScores, type TestGolferLiveScore } from '@/lib/firestore-live-scores';
import {
  isFirestoreLineupStorageAvailable,
  subscribeToTestLineup,
} from '@/lib/firestore-lineups';
import type { PlayerPoolGolfer } from '@/lib/lineup-builder-types';
import { TEST_USERS } from '@/lib/test-users';
import { getDefaultPlayerPool, getWeeklyContestById, WEEKLY_CONTESTS } from '@/lib/weekly-lineup-seed';
import { loadImportedPlayerPool } from '@/lib/weekly-lineup-storage';

interface LeaderboardRow {
  rank: number;
  userSlug: string;
  userDisplayName: string;
  lineupCount: number;
  totalPoints: number;
  golfersWithScores: number;
  lineupGolferIds: string[];
}

interface LeaderboardLineupEntry {
  userKey: string;
  userDisplayName: string;
  lineupGolferIds: string[];
}

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

function WeekStandingsContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const contestId = searchParams.get('contestId') ?? 'week-2-arnold-palmer';

  const [session, setSession] = useState<AuthSession | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  const contest = getWeeklyContestById(contestId);
  const contestName = contest?.name ?? getContestLabel(contestId);
  const viewerUserId = session?.userSlug ?? 'guest';
  const contestOptions = useMemo(() => {
    const ids = [contestId, ...WEEKLY_CONTESTS.map((item) => item.id)];
    return Array.from(new Set(ids)).map((id) => ({ id, label: getContestLabel(id) }));
  }, [contestId]);

  const [playerPool, setPlayerPool] = useState<PlayerPoolGolfer[]>([]);
  const [lineups, setLineups] = useState<LeaderboardLineupEntry[]>([]);
  const [scores, setScores] = useState<Record<string, TestGolferLiveScore>>({});
  const [lineupStatus, setLineupStatus] = useState<'checking' | 'live' | 'no-feed' | 'error'>('checking');
  const [scoreStatus, setScoreStatus] = useState<'checking' | 'live' | 'no-feed' | 'error'>('checking');

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
    const imported = loadImportedPlayerPool(contestId);
    setPlayerPool(imported && imported.length ? imported : getDefaultPlayerPool(contestId));
  }, [contestId]);

  useEffect(() => {
    if (!isFirestoreLineupStorageAvailable()) {
      setLineupStatus('no-feed');
      return;
    }

    const entriesByUser = new Map<string, LeaderboardLineupEntry>();
    let cancelled = false;
    const unsubscribes = TEST_USERS.map((user) =>
      subscribeToTestLineup(
        contestId,
        user.id,
        (entry) => {
          if (cancelled) return;
          if (!entry || !entry.lineupGolferIds.length) {
            entriesByUser.delete(user.id);
          } else {
            entriesByUser.set(user.id, {
              userKey: user.id,
              userDisplayName: entry.userDisplayName || user.name,
              lineupGolferIds: entry.lineupGolferIds,
            });
          }
          setLineups(Array.from(entriesByUser.values()));
          setLineupStatus('live');
        },
        () => {
          if (!cancelled) setLineupStatus('error');
        }
      )
    );

    return () => {
      cancelled = true;
      for (const unsubscribe of unsubscribes) {
        unsubscribe();
      }
    };
  }, [contestId]);

  useEffect(() => {
    if (!isFirestoreLineupStorageAvailable()) {
      setScoreStatus('no-feed');
      return;
    }

    let cancelled = false;
    const unsubscribe = subscribeToTestGolferScores(
      contestId,
      (nextScores) => {
        if (cancelled) return;
        setScores(nextScores);
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
  }, [contestId]);

  const golfersById = useMemo(
    () => new Map(playerPool.map((golfer) => [golfer.golferId, golfer])),
    [playerPool]
  );

  const rows = useMemo<LeaderboardRow[]>(() => {
    const unranked = lineups.map((entry) => {
      let totalPoints = 0;
      let golfersWithScores = 0;

      for (const golferId of entry.lineupGolferIds) {
        const fantasy = scores[golferId]?.fantasyPoints;
        if (typeof fantasy === 'number') {
          totalPoints += fantasy;
          golfersWithScores += 1;
        }
      }

      return {
        userSlug: entry.userKey,
        userDisplayName: entry.userDisplayName || entry.userKey,
        lineupCount: entry.lineupGolferIds.length,
        totalPoints,
        golfersWithScores,
        lineupGolferIds: entry.lineupGolferIds,
      };
    });

    unranked.sort((left, right) => {
      if (right.totalPoints !== left.totalPoints) {
        return right.totalPoints - left.totalPoints;
      }
      return left.userDisplayName.localeCompare(right.userDisplayName);
    });

    let currentRank = 1;
    let previousPoints: number | null = null;
    return unranked.map((row, index) => {
      if (previousPoints !== null && row.totalPoints < previousPoints) {
        currentRank = index + 1;
      }
      previousPoints = row.totalPoints;
      return { ...row, rank: currentRank };
    });
  }, [lineups, scores]);

  const latestUpdateIso = useMemo(() => {
    return Object.values(scores)
      .map((score) => score.updatedAtIso)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1);
  }, [scores]);

  if (checkingSession) {
    return <div className="min-h-screen bg-[#080c13]" />;
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#080c13] px-4 py-6 text-zinc-100">
      <div className="mx-auto max-w-5xl space-y-4">
        <MainTabsHeader session={session} activeTab="week-standings" contestId={contestId} />

        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#171f2d] via-[#111827] to-[#0b1018] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">5x5 Global</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">Week Standings</h1>
              <p className="mt-2 text-sm text-zinc-400">{contestName}</p>
            </div>
            <label className="inline-flex items-center rounded-md border border-white/15 bg-white/5 px-2 text-sm text-zinc-200">
              <span className="mr-2 text-xs uppercase tracking-wide text-zinc-500">Week</span>
              <select
                value={contestId}
                onChange={(event) => {
                  const nextContestId = event.target.value;
                  const next = new URLSearchParams(searchParams.toString());
                  next.set('contestId', nextContestId);
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
        </header>

        <Card className="rounded-3xl border border-white/10 bg-[#101722] text-zinc-100">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-xl">Standings</CardTitle>
                <CardDescription className="text-zinc-400">
                  Ranked by summed lineup fantasy points from Firestore.
                </CardDescription>
              </div>
              <Badge className="bg-blue-500/20 text-blue-300">{rows.length} entries</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Lineup Feed</p>
                <p className="mt-1 font-semibold">{lineupStatus.toUpperCase()}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Score Feed</p>
                <p className="mt-1 font-semibold">{scoreStatus.toUpperCase()}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Tracked Golfers</p>
                <p className="mt-1 font-semibold">{Object.keys(scores).length}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Last Update</p>
                <p className="mt-1 font-semibold text-xs">
                  {latestUpdateIso ? new Date(latestUpdateIso).toLocaleString() : '--'}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {rows.length ? (
              <div className="space-y-2">
                {rows.map((row) => {
                  const isCurrentUser = row.userSlug === viewerUserId;
                  return (
                    <div
                      key={row.userSlug}
                      className={`rounded-xl border px-3 py-3 ${
                        isCurrentUser ? 'border-emerald-300/50 bg-emerald-400/10' : 'border-white/10 bg-white/[0.03]'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm font-semibold">
                            {row.rank}
                          </div>
                          <div>
                            <p className="font-semibold text-zinc-100">
                              {row.userDisplayName}
                              {isCurrentUser ? ' (you)' : ''}
                            </p>
                            <p className="text-xs text-zinc-400">
                              {row.golfersWithScores}/{row.lineupCount} golfers with scores
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-emerald-300">{row.totalPoints.toFixed(1)}</p>
                          <p className="text-xs text-zinc-500">PTS</p>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Link
                          href={`/live-lineup?contestId=${contestId}&userId=${encodeURIComponent(row.userSlug)}`}
                          className="inline-flex items-center rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-zinc-200 hover:bg-white/10"
                        >
                          <Radio className="mr-1.5 h-3.5 w-3.5" />
                          Open lineup
                        </Link>
                        <div className="flex flex-wrap gap-1 text-xs text-zinc-400">
                          {row.lineupGolferIds.slice(0, 6).map((golferId) => (
                            <span key={golferId} className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5">
                              {golfersById.get(golferId)?.name ?? golferId}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-zinc-500">
                No submitted lineups found yet for this contest.
              </div>
            )}

            <div className="mt-4 rounded-2xl border border-blue-400/10 bg-blue-400/5 p-4 text-sm text-zinc-300">
              <div className="flex items-center gap-2 font-medium text-zinc-100">
                <Trophy className="h-4 w-4 text-blue-300" />
                Week standings source
              </div>
              <p className="mt-1 text-zinc-400">
                `test_lineups/{'{contestId}'}/entries` + `test_scores/{'{contestId}'}/golfers` from Firestore.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function WeekStandingsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#080c13]" />}>
      <WeekStandingsContent />
    </Suspense>
  );
}
