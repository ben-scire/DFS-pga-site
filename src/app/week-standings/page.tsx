"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { RefreshCw, Trophy } from 'lucide-react';
import MainTabsHeader from '@/components/main-tabs-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { subscribeAuthSession, type AuthSession } from '@/lib/firebase-auth';
import {
  loadTestGolferScores,
  subscribeToTestGolferScores,
  type TestGolferLiveScore,
} from '@/lib/firestore-live-scores';
import {
  isFirestoreLineupStorageAvailable,
  loadTestLineup,
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
  holesRemaining: number;
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

function getLastName(displayName: string): string {
  const trimmed = displayName.trim();
  if (!trimmed) return displayName;
  const parts = trimmed.split(/\s+/);
  const lastToken = parts.at(-1) ?? trimmed;
  return lastToken.replace(/[,\s]+$/g, '');
}

function shortenName(value: string, maxChars = 8): string {
  return value.length > maxChars ? `${value.slice(0, maxChars - 1)}…` : value;
}

function toNumber(value: string | number | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function getGolferHolesRemaining(score: TestGolferLiveScore | undefined): number {
  if (!score) return 18;

  const thru = toNumber(score.thru);
  if (thru !== null) {
    return Math.max(0, 18 - Math.min(18, thru));
  }

  const status = (score.status ?? '').toLowerCase();
  if (
    status.includes('final') ||
    status.includes('complete') ||
    status.includes('finished') ||
    status.includes('cut') ||
    status.includes('wd') ||
    status.includes('dq')
  ) {
    return 0;
  }

  return 18;
}

function getRankTone(rank: number): string {
  if (rank === 1) return 'border-amber-300/50 bg-amber-300/15';
  if (rank === 2) return 'border-slate-200/50 bg-slate-200/10';
  if (rank === 3) return 'border-orange-300/50 bg-orange-300/12';
  return 'border-cyan-300/20 bg-cyan-300/[0.06]';
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
  const isAdmin = session?.isAdmin ?? false;
  const hideLineupPlayerNames = !isAdmin && (contest ? Date.now() < new Date(contest.lockAtIso).getTime() : false);
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
  const [isScoreRefreshing, setIsScoreRefreshing] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    let cancelled = false;
    const entriesByUser = new Map<string, LeaderboardLineupEntry>();

    void (async () => {
      try {
        const serverEntries = await Promise.all(
          TEST_USERS.map(async (user) => ({
            user,
            entry: await loadTestLineup(contestId, user.id, { source: 'server' }),
          }))
        );
        if (cancelled) return;

        for (const row of serverEntries) {
          const { user, entry } = row;
          if (!entry || !entry.lineupGolferIds.length) {
            entriesByUser.delete(user.id);
            continue;
          }
          entriesByUser.set(user.id, {
            userKey: user.id,
            userDisplayName: entry.userDisplayName || user.name,
            lineupGolferIds: entry.lineupGolferIds,
          });
        }
        setLineups(Array.from(entriesByUser.values()));
        setLineupStatus('live');
      } catch {
        if (!cancelled) setLineupStatus('error');
      }
    })();

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
    void (async () => {
      try {
        const serverScores = await loadTestGolferScores(contestId, { source: 'server' });
        if (cancelled) return;
        setScores(serverScores);
        setScoreStatus('live');
      } catch {
        if (!cancelled) setScoreStatus('error');
      }
    })();

    const unsubscribe = subscribeToTestGolferScores(
      contestId,
      (nextScores) => {
        if (cancelled) return;
        setScores(nextScores);
        setScoreStatus('live');
        setIsScoreRefreshing(true);
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = setTimeout(() => {
          setIsScoreRefreshing(false);
          refreshTimerRef.current = null;
        }, 850);
      },
      () => {
        if (!cancelled) setScoreStatus('error');
      }
    );

    return () => {
      cancelled = true;
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
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
      let holesRemaining = 0;

      for (const golferId of entry.lineupGolferIds) {
        const score = scores[golferId];
        const fantasy = score?.fantasyPoints;
        if (typeof fantasy === 'number') {
          totalPoints += fantasy;
        }
        holesRemaining += getGolferHolesRemaining(score);
      }

      return {
        userSlug: entry.userKey,
        userDisplayName: entry.userDisplayName || entry.userKey,
        lineupCount: entry.lineupGolferIds.length,
        totalPoints,
        holesRemaining,
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
    return <div className="min-h-screen bg-[#081325]" />;
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#1b3b67_0%,_#0d1a30_42%,_#090f1a_100%)] px-4 py-6 text-zinc-100">
      <div className="mx-auto max-w-5xl space-y-4">
        <MainTabsHeader session={session} activeTab="week-standings" contestId={contestId} />

        <header className="rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-[#1b2d4f] via-[#162a3a] to-[#103028] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100/70">5x5 Global</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">Week Standings</h1>
              <p className="mt-2 text-sm text-cyan-100/75">{contestName}</p>
            </div>
            <label className="inline-flex items-center rounded-md border border-cyan-200/30 bg-cyan-100/10 px-2 text-sm text-zinc-100">
              <span className="mr-2 text-xs uppercase tracking-wide text-cyan-100/70">Week</span>
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
                  <option key={option.id} value={option.id} className="bg-[#102137]">
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>

        <Card className="rounded-3xl border border-cyan-300/20 bg-gradient-to-b from-[#0f1d33] to-[#0b1729] text-zinc-100">
          <CardHeader>
            <div className={`rounded-xl border px-3 py-2 text-sm transition-all duration-300 ${
              isScoreRefreshing ? 'border-emerald-300/50 bg-emerald-300/15' : 'border-cyan-200/20 bg-cyan-300/10'
            }`}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-cyan-50/90">
                  {isScoreRefreshing ? 'Scores updating live...' : 'Live feed running'}
                  </p>
                  <p className="truncate text-[11px] text-cyan-100/65">
                    Lineup {lineupStatus.toUpperCase()} · Score {scoreStatus.toUpperCase()} · Updated{' '}
                    {latestUpdateIso ? new Date(latestUpdateIso).toLocaleTimeString() : '--'}
                  </p>
                </div>
                <RefreshCw className={`h-4 w-4 ${isScoreRefreshing ? 'animate-spin text-emerald-200' : 'text-cyan-200/70'}`} />
              </div>
            </div>
            <div className="flex justify-end">
              <Badge className="border border-cyan-200/40 bg-cyan-300/20 text-cyan-100">{rows.length} entries</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {rows.length ? (
              <div className="space-y-1.5">
                {rows.map((row) => {
                  const isCurrentUser = row.userSlug === viewerUserId;
                  return (
                    <Link
                      key={row.userSlug}
                      href={`/live-lineup?contestId=${contestId}&userId=${encodeURIComponent(row.userSlug)}`}
                      className={`block rounded-xl border px-3 py-2 transition-all duration-300 ${
                        isCurrentUser
                          ? 'border-emerald-300/60 bg-emerald-300/20 shadow-[0_0_0_1px_rgba(52,211,153,0.2)] hover:bg-emerald-300/25'
                          : `${getRankTone(row.rank)} hover:brightness-110`
                      }`}
                    >
                      <div className="flex min-w-0 items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">
                            {row.rank}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-zinc-100">
                              {row.userDisplayName}
                              {isCurrentUser ? ' (you)' : ''}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-semibold text-emerald-200 transition-all duration-300 ${
                            isScoreRefreshing ? 'scale-110 animate-pulse' : ''
                          }`}>{row.totalPoints.toFixed(1)}</p>
                          <p className="text-[11px] text-cyan-50/70">PHR ({row.holesRemaining})</p>
                        </div>
                      </div>

                      {hideLineupPlayerNames ? (
                        <div className="mt-1 text-xs text-zinc-400">Lineup submitted</div>
                      ) : (
                        <p className="mt-1 truncate whitespace-nowrap text-xs text-cyan-50/90">
                          {row.lineupGolferIds
                            .slice(0, 6)
                            .map((golferId) => shortenName(getLastName(golfersById.get(golferId)?.name ?? golferId)))
                            .join(' · ')}
                        </p>
                      )}
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-zinc-500">
                No submitted lineups found yet for this contest.
              </div>
            )}

            <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.08] p-4 text-sm text-cyan-100/80">
              <div className="flex items-center gap-2 font-medium text-zinc-100">
                <Trophy className="h-4 w-4 text-cyan-200" />
                Week standings source
              </div>
              <p className="mt-1 text-cyan-100/70">
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
