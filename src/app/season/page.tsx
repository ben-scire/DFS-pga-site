"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trophy } from 'lucide-react';
import MainTabsHeader from '@/components/main-tabs-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  if (tier === 'Signature') return 'Signature';
  if (tier === 'Major') return 'Major';
  return 'Standard';
}

function getRankLabel(rank: number | null): string {
  if (!rank || rank < 1) return '--';
  const remainder100 = rank % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return `${rank}th`;
  const remainder10 = rank % 10;
  if (remainder10 === 1) return `${rank}st`;
  if (remainder10 === 2) return `${rank}nd`;
  if (remainder10 === 3) return `${rank}rd`;
  return `${rank}th`;
}

function getMobileRowTone(rank: number | null) {
  if (rank === 1) return 'border-amber-300/25 bg-[linear-gradient(135deg,rgba(245,158,11,0.18),rgba(11,19,34,0.92))]';
  if (rank === 2) return 'border-slate-300/20 bg-[linear-gradient(135deg,rgba(226,232,240,0.14),rgba(11,19,34,0.92))]';
  if (rank === 3) return 'border-orange-300/20 bg-[linear-gradient(135deg,rgba(251,146,60,0.14),rgba(11,19,34,0.92))]';
  return 'border-white/10 bg-white/[0.03]';
}

function formatFantasyPoints(value: number | null): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '--';
  const hasFraction = Math.abs(value % 1) > Number.EPSILON;
  return value.toLocaleString(undefined, {
    minimumFractionDigits: hasFraction ? 1 : 0,
    maximumFractionDigits: 1,
  });
}

function formatNetDollars(value: number | null): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '--';
  const hasFraction = Math.abs(value % 1) > Number.EPSILON;
  const absValue = Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: hasFraction ? 1 : 0,
    maximumFractionDigits: 1,
  });
  if (value > 0) return `+$${absValue}`;
  if (value < 0) return `-$${absValue}`;
  return '$0';
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

      <div className="relative mx-auto max-w-6xl space-y-3.5">
        <MainTabsHeader session={session} activeTab="season" />

        <Card className="rounded-3xl border border-cyan-300/20 bg-[#0b1322]/90 text-zinc-100">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-cyan-300" />
              <CardTitle>Season Standings</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="space-y-2 md:hidden">
              {standings.map((entry) => (
                <div
                  key={entry.entryId}
                  className={`rounded-2xl border p-2.5 ${getMobileRowTone(entry.rank)}`}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-white/10 bg-white/10 px-1.5 text-[10px] font-semibold text-zinc-100">
                      {getRankLabel(entry.rank)}
                    </span>
                    <p className="min-w-[96px] flex-1 truncate text-sm font-semibold text-zinc-50">{entry.displayName}</p>
                    <span className="inline-flex items-center rounded-md border border-cyan-300/40 bg-cyan-300/15 px-2 py-0.5 text-[11px] font-bold text-cyan-200">
                      {entry.championshipPoints ?? '--'} pts
                    </span>
                    <span className="inline-flex items-center rounded-md border border-white/15 bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-zinc-100">
                      {formatFantasyPoints(entry.weeklyFantasyPointsTotal)} FP
                    </span>
                    <span className="inline-flex items-center rounded-md border border-white/15 bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-zinc-100">
                      {formatNetDollars(entry.netDollars)}
                    </span>
                  </div>

                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {eventColumns.map((column) => (
                      <div
                        key={`${entry.entryId}-mobile-${column.eventId}`}
                        className={`rounded-lg border px-1.5 py-1.5 text-center ${getTierBadgeClass(column.tier)}`}
                      >
                        <p className="truncate text-[9px] font-semibold uppercase tracking-[0.1em]">
                          {column.shortLabel}
                        </p>
                        <p className="mt-0.5 text-xs font-bold text-zinc-50">
                          {entry.finishByEventId[column.eventId] ?? '—'}
                        </p>
                        <p className="truncate text-[8px] font-semibold text-zinc-300">
                          {getTierBadgeLabel(column.tier)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto rounded-2xl border border-white/10 md:block">
              <table className="w-full min-w-[760px] table-fixed text-xs sm:min-w-[980px]">
                <colgroup>
                  <col className="w-[56px] sm:w-[68px]" />
                  <col className="w-[132px] sm:w-[172px]" />
                  <col className="w-[76px] sm:w-[92px]" />
                  <col className="w-[90px] sm:w-[108px]" />
                  <col className="w-[86px] sm:w-[104px]" />
                  {eventColumns.map((column) => (
                    <col key={`col-${column.eventId}`} className="w-[82px] sm:w-[112px]" />
                  ))}
                </colgroup>
                <thead className="bg-white/[0.04] text-zinc-300">
                  <tr>
                    <th className="px-2 py-2 text-left sm:px-3 sm:py-3">Rank</th>
                    <th className="px-2 py-2 text-left sm:px-3 sm:py-3">User</th>
                    <th className="px-2 py-2 text-right sm:px-3 sm:py-3">Champ</th>
                    <th className="px-2 py-2 text-right sm:px-3 sm:py-3">Total FP</th>
                    <th className="px-2 py-2 text-right sm:px-3 sm:py-3">Net $</th>
                    {eventColumns.map((column) => (
                      <th key={column.eventId} className="px-1.5 py-2 text-center sm:px-3 sm:py-3">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[11px] leading-tight sm:text-sm">{column.shortLabel}</span>
                          <span className="text-[9px] font-semibold text-zinc-500 sm:text-[10px]">
                            {getTierBadgeLabel(column.tier)}
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
                      <td className="px-2 py-2.5 text-right font-semibold text-zinc-100 sm:px-3 sm:py-3">{formatFantasyPoints(entry.weeklyFantasyPointsTotal)}</td>
                      <td className={`px-2 py-2.5 text-right font-semibold sm:px-3 sm:py-3 ${
                        typeof entry.netDollars === 'number'
                          ? (entry.netDollars > 0 ? 'text-emerald-300' : entry.netDollars < 0 ? 'text-rose-300' : 'text-zinc-200')
                          : 'text-zinc-400'
                      }`}>{formatNetDollars(entry.netDollars)}</td>
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
