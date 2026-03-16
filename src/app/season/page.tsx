"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trophy } from 'lucide-react';
import MainTabsHeader from '@/components/main-tabs-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { subscribeAuthSession, type AuthSession } from '@/lib/firebase-auth';
import { getSeasonEventColumns, getSeasonStandingsRows, type ScheduleEvent } from '@/lib/season-display';

function getTierBadgeClass(tier: ScheduleEvent['tier']) {
  if (tier === 'Signature') {
    return 'border-amber-300/40 bg-amber-300/15 text-amber-100';
  }
  if (tier === 'Major') {
    return 'border-rose-300/40 bg-rose-300/15 text-rose-100';
  }
  return 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100';
}

function getTierBadgeLabel(tier: ScheduleEvent['tier']) {
  if (tier === 'Signature') return 'SIG';
  if (tier === 'Major') return 'MAJ';
  return 'STD';
}

function getMobileRowTone(rank: number | null) {
  if (rank === 1) return 'border-amber-300/25 bg-[linear-gradient(135deg,rgba(245,158,11,0.18),rgba(11,19,34,0.92))]';
  if (rank === 2) return 'border-slate-300/20 bg-[linear-gradient(135deg,rgba(226,232,240,0.14),rgba(11,19,34,0.92))]';
  if (rank === 3) return 'border-orange-300/20 bg-[linear-gradient(135deg,rgba(251,146,60,0.14),rgba(11,19,34,0.92))]';
  return 'border-white/10 bg-white/[0.03]';
}

export default function SeasonPage() {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

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

  const standings = useMemo(() => getSeasonStandingsRows(), []);
  const eventColumns = useMemo(() => getSeasonEventColumns(), []);

  if (checkingSession) {
    return <div className="min-h-screen bg-[#040914]" />;
  }

  if (!session) {
    return null;
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#040914] px-2.5 py-4 text-zinc-100 sm:px-4 sm:py-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 top-8 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute -right-16 top-24 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl space-y-4">
        <MainTabsHeader session={session} activeTab="season" />

        <header className="rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-[#101a2c] via-[#0b1322] to-[#080d15] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.5)] sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/70">5x5 Global</p>
          <h1 className="mt-2 text-[2.7rem] font-bold leading-none tracking-tight sm:text-3xl">Season Standings</h1>
          <p className="mt-3 max-w-3xl text-base text-zinc-400 sm:mt-2 sm:text-sm">Championship points first, with each completed Q1 finish shown from most recent to oldest.</p>
        </header>

        <Card className="rounded-3xl border border-cyan-300/20 bg-[#0b1322]/90 text-zinc-100">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-cyan-300" />
              <CardTitle>Overall Standings</CardTitle>
            </div>
            <CardDescription className="text-zinc-400">
              Ranked by championship points, with weekly fantasy points retained only as the internal tiebreak.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 md:hidden">
              {standings.map((entry) => (
                <div
                  key={entry.entryId}
                  className={`rounded-3xl border p-3 ${getMobileRowTone(entry.rank)}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-white/10 bg-white/10 px-2 text-xs font-semibold text-zinc-100">
                          {entry.rank ?? '--'}
                        </span>
                        <p className="truncate text-base font-semibold text-zinc-50">{entry.displayName}</p>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-right">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/70">Champ</p>
                      <p className="text-sm font-bold text-cyan-100">{entry.championshipPoints ?? '--'}</p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {eventColumns.map((column) => (
                      <div
                        key={`${entry.entryId}-mobile-${column.eventId}`}
                        className={`rounded-2xl border px-2 py-2 text-center ${getTierBadgeClass(column.tier)}`}
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em]">
                          {column.shortLabel}
                        </p>
                        <p className="mt-1 text-sm font-bold text-zinc-50">
                          {entry.finishByEventId[column.eventId] ?? '—'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto rounded-2xl border border-white/10 md:block">
              <table className="w-full min-w-[620px] table-fixed text-xs sm:min-w-[760px] sm:text-sm">
                <colgroup>
                  <col className="w-[56px] sm:w-[72px]" />
                  <col className="w-[132px] sm:w-[188px]" />
                  <col className="w-[76px] sm:w-[100px]" />
                  {eventColumns.map((column) => (
                    <col key={`col-${column.eventId}`} className="w-[86px] sm:w-[124px]" />
                  ))}
                </colgroup>
                <thead className="bg-white/[0.04] text-zinc-300">
                  <tr>
                    <th className="px-2 py-2 text-left sm:px-3 sm:py-3">Rank</th>
                    <th className="px-2 py-2 text-left sm:px-3 sm:py-3">User</th>
                    <th className="px-2 py-2 text-right sm:px-3 sm:py-3">Champ</th>
                    {eventColumns.map((column) => (
                      <th key={column.eventId} className="px-1.5 py-2 text-center sm:px-3 sm:py-3">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[11px] leading-tight sm:text-sm">{column.shortLabel}</span>
                          <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] sm:px-2 sm:text-[10px] sm:tracking-[0.18em] ${getTierBadgeClass(column.tier)}`}>
                            <span className="sm:hidden">{getTierBadgeLabel(column.tier)}</span>
                            <span className="hidden sm:inline">{column.tier}</span>
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {standings.map((entry) => (
                    <tr key={entry.entryId} className="border-t border-white/5">
                      <td className="px-2 py-2.5 font-semibold sm:px-3 sm:py-3">{entry.rank ?? '--'}</td>
                      <td className="px-2 py-2.5 sm:px-3 sm:py-3">
                        <span className="block truncate">{entry.displayName}</span>
                      </td>
                      <td className="px-2 py-2.5 text-right font-semibold text-cyan-300 sm:px-3 sm:py-3">{entry.championshipPoints ?? '--'}</td>
                      {eventColumns.map((column) => (
                        <td key={`${entry.entryId}:${column.eventId}`} className="px-1.5 py-2.5 text-center sm:px-3 sm:py-3">
                          {entry.finishByEventId[column.eventId] ?? '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
