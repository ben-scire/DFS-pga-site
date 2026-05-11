"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Trophy } from 'lucide-react';
import MainTabsHeader from '@/components/main-tabs-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { subscribeAuthSession, type AuthSession } from '@/lib/firebase-auth';
import {
  getQ1EventColumns,
  getQ1StandingsRows,
} from '@/lib/season-display';

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

export default function Q1SeasonPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeAuthSession((nextSession) => {
      setSession(nextSession);
      setCheckingSession(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const q1Standings = useMemo(() => getQ1StandingsRows(), []);
  const q1Columns = useMemo(() => getQ1EventColumns(), []);

  if (checkingSession) {
    return <div className="min-h-screen bg-[#040914]" />;
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#040914] px-2.5 py-4 text-zinc-100 sm:px-4 sm:py-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 top-8 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute -right-16 top-24 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl space-y-3.5">
        <MainTabsHeader session={session} activeTab="season" />

        <Link
          href="/season"
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/[0.08]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to current season
        </Link>

        <Card className="rounded-3xl border border-cyan-300/20 bg-[#0b1322]/90 text-zinc-100">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-cyan-300" />
              <CardTitle>Quarter 1 final standings</CardTitle>
            </div>
            <CardDescription className="text-zinc-400">
              Archived Q1 results from Cognizant through the Masters.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="space-y-2 md:hidden">
              {q1Standings.map((entry) => (
                <div key={entry.entryId} className="rounded-2xl border border-white/10 bg-white/[0.03] p-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-white/10 bg-white/10 px-1.5 text-[10px] font-semibold">
                      {entry.rank ?? '--'}
                    </span>
                    <p className="min-w-[96px] flex-1 truncate text-sm font-semibold">{entry.displayName}</p>
                    <span className="rounded-md border border-cyan-300/40 bg-cyan-300/15 px-2 py-0.5 text-[11px] font-bold text-cyan-200">
                      {entry.championshipPoints ?? '--'} pts
                    </span>
                    <span className="rounded-md border border-white/15 bg-white/10 px-2 py-0.5 text-[11px] font-semibold">
                      {formatNetDollars(entry.netDollars)}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {q1Columns.map((column) => (
                      <div key={`${entry.entryId}-${column.eventId}`} className="rounded-lg border border-white/10 bg-white/[0.03] px-1.5 py-1.5 text-center">
                        <p className="truncate text-[9px] font-semibold uppercase tracking-[0.1em] text-zinc-400">{column.shortLabel}</p>
                        <p className="mt-0.5 text-xs font-bold">{entry.finishByEventId[column.eventId] ?? '—'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto rounded-2xl border border-white/10 md:block">
              <table className="w-full min-w-[980px] table-fixed text-xs">
                <thead className="bg-white/[0.04] text-zinc-300">
                  <tr>
                    <th className="px-3 py-3 text-left">Rank</th>
                    <th className="px-3 py-3 text-left">User</th>
                    <th className="px-3 py-3 text-right">Champ</th>
                    <th className="px-3 py-3 text-right">Total FP</th>
                    <th className="px-3 py-3 text-right">Net $</th>
                    {q1Columns.map((column) => (
                      <th key={column.eventId} className="px-3 py-3 text-center">{column.shortLabel}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {q1Standings.map((entry) => (
                    <tr key={entry.entryId} className="border-t border-white/5">
                      <td className="px-3 py-3 font-semibold">{entry.rank ?? '--'}</td>
                      <td className="px-3 py-3">
                        <span className="block truncate">{entry.displayName}</span>
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-cyan-300">{entry.championshipPoints ?? '--'}</td>
                      <td className="px-3 py-3 text-right font-semibold">{formatFantasyPoints(entry.weeklyFantasyPointsTotal)}</td>
                      <td className="px-3 py-3 text-right font-semibold">{formatNetDollars(entry.netDollars)}</td>
                      {q1Columns.map((column) => (
                        <td key={`${entry.entryId}:${column.eventId}`} className="px-3 py-3 text-center">
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
