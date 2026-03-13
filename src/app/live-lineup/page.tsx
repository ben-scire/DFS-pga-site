"use client";

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
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
import type { PersistedLineupEntry, PlayerPoolGolfer, WeeklyLeagueContest } from '@/lib/lineup-builder-types';
import { getTestUserName, isTestUserId } from '@/lib/test-users';
import { getDefaultContestId, getDefaultPlayerPool, getWeeklyContestById } from '@/lib/weekly-lineup-seed';
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

function toNumber(value: string | number | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function getGolferHolesRemaining(score: TestGolferLiveScore | null): number {
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
    status: 'live',
    salaryCap: 50000,
    rosterSize: 6,
    entryNumberLabel: '--/--',
    testMode: true,
    lockDisabled: true,
  };
}

function LiveLineupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contestId = searchParams.get('contestId') ?? getDefaultContestId();

  const [session, setSession] = useState<AuthSession | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  const viewerUserId = session?.userSlug ?? 'guest';
  const lineupUserIdRaw = searchParams.get('userId')?.trim() || viewerUserId;
  const lineupUserId = isTestUserId(lineupUserIdRaw) ? lineupUserIdRaw : viewerUserId;

  const contest = getWeeklyContestById(contestId) ?? getFallbackContest(contestId);
  const lineupUserName = getTestUserName(lineupUserId) ?? lineupUserId;
  const isValidUser = Boolean(getTestUserName(lineupUserId));

  const [playerPool, setPlayerPool] = useState<PlayerPoolGolfer[]>([]);
  const [entry, setEntry] = useState<PersistedLineupEntry | null>(null);
  const [liveScores, setLiveScores] = useState<Record<string, TestGolferLiveScore>>({});

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

    const local = loadPersistedLineup(contestId, lineupUserId);
    setEntry(local);

    if (!isValidUser || !isFirestoreLineupStorageAvailable()) return;

    let cancelled = false;
    void (async () => {
      try {
        const cloudEntry = await loadTestLineup(contestId, lineupUserId, { source: 'server' });
        if (cancelled) return;
        if (cloudEntry) {
          setEntry(cloudEntry);
          savePersistedLineup({ ...cloudEntry, userKey: lineupUserId });
        }
      } catch {}
    })();

    const unsubscribe = subscribeToTestLineup(
      contestId,
      lineupUserId,
      (nextEntry) => {
        if (cancelled) return;
        if (nextEntry) {
          setEntry(nextEntry);
          savePersistedLineup({ ...nextEntry, userKey: lineupUserId });
        }
      },
      () => {}
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [contestId, isValidUser, lineupUserId]);

  useEffect(() => {
    if (!isFirestoreLineupStorageAvailable()) return;

    let cancelled = false;
    void (async () => {
      try {
        const serverScores = await loadTestGolferScores(contestId, { source: 'server' });
        if (cancelled) return;
        setLiveScores(serverScores);
      } catch {}
    })();

    const unsubscribe = subscribeToTestGolferScores(
      contestId,
      (scoresByGolferId) => {
        if (cancelled) return;
        setLiveScores(scoresByGolferId);
      },
      () => {}
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [contestId]);

  const lineupGolfers = useMemo(() => {
    if (!entry) return [];
    const map = new Map(playerPool.map((g) => [g.golferId, g]));
    return entry.lineupGolferIds.map((id) => map.get(id)).filter((g): g is PlayerPoolGolfer => Boolean(g));
  }, [entry, playerPool]);

  const lineupLiveStats = useMemo(() => {
    const rows = lineupGolfers.map((golfer) => ({
      golfer,
      score: liveScores[golfer.golferId] ?? null,
    }));
    const totalLivePoints = rows.reduce((sum, row) => sum + (row.score?.fantasyPoints ?? 0), 0);
    const totalHolesRemaining = rows.reduce((sum, row) => sum + getGolferHolesRemaining(row.score), 0);

    return {
      rows,
      totalLivePoints,
      totalHolesRemaining,
    };
  }, [lineupGolfers, liveScores]);

  if (checkingSession) {
    return <div className="min-h-screen bg-[#080c13] text-zinc-100" />;
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#080c13] text-zinc-100">
      <div className="mx-auto max-w-3xl">
        <header className="sticky top-0 z-10 border-b border-cyan-300/15 bg-[#05080f] text-white">
          <div className="flex items-center justify-between px-4 py-3">
            <Link href={`/week-standings?contestId=${contestId}`} className="inline-flex h-8 w-8 items-center justify-center">
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight">Entry Details</h1>
            <div className="h-8 w-8" />
          </div>
          <div className="bg-[#20232b] px-4 py-2 text-center text-sm uppercase tracking-[0.12em] text-zinc-200">Golf | Classic</div>
        </header>

        <section className="border-b border-cyan-300/15 bg-gradient-to-r from-[#0e1a2f] to-[#0f2c2a] px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-2xl font-bold">{lineupUserName}</p>
              <p className="mt-1 text-sm text-cyan-100/70">{contest.name}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold leading-none text-emerald-300">{lineupLiveStats.totalLivePoints.toFixed(2)}</p>
              <p className="mt-1 text-sm font-semibold text-cyan-100/70">PHR ({lineupLiveStats.totalHolesRemaining})</p>
            </div>
          </div>
        </section>

        {lineupGolfers.length ? (
          <div className="divide-y divide-cyan-200/10">
            {lineupLiveStats.rows.map(({ golfer, score }) => (
              <article key={golfer.golferId} className="bg-[#101722] px-3 py-1.5">
                <div className="flex items-start gap-2">
                  <div className="pt-0.5 text-base font-bold leading-none text-cyan-200">G</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-semibold leading-tight text-zinc-100">{golfer.name}</p>
                    <p className="mt-0.5 text-lg leading-tight text-zinc-200">
                      POS {formatPosition(score?.position)} ({formatToPar(score?.scoreToPar)})
                    </p>
                    <p className="mt-0.5 text-sm text-zinc-400">
                      {score?.thru !== undefined ? `Thru ${score.thru}` : 'Pre-round'} ·{' '}
                      {score?.status ? score.status.toUpperCase() : golfer.teeTimeDisplay ?? '--'}
                    </p>
                  </div>
                  <div className="min-w-[88px] border-l border-cyan-200/15 pl-2.5 text-right">
                    <p className="text-2xl font-semibold leading-none text-zinc-100">
                      {typeof score?.fantasyPoints === 'number' ? score.fantasyPoints.toFixed(2) : '--'}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-zinc-400">No lineup saved for this user yet.</div>
        )}
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
