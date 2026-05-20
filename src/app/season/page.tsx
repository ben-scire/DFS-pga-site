"use client";

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Scale, Trophy } from 'lucide-react';
import MainTabsHeader from '@/components/main-tabs-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { subscribeAuthSession, type AuthSession } from '@/lib/firebase-auth';
import {
  formatScoringCell,
  getLatestWeeklyFinalStandings,
  getQ2EventColumns,
  getQ2FinalPayoutRows,
  getQ2SixteenPlayerScoringMatrix,
  getQ2StandingsRows,
  getQuarterScheduleRows,
  getSeasonEventColumns,
  getSeasonStandingsRows,
  type EventFinishColumn,
  type QuarterFinalPayoutRow,
  type QuarterScheduleDisplayRow,
  type ScheduleEvent,
  type SeasonStandingsDisplayRow,
} from '@/lib/season-display';

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

function formatPayoutDollars(value: number): string {
  const hasFraction = Math.abs(value % 1) > Number.EPSILON;
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: hasFraction ? 1 : 0,
    maximumFractionDigits: 1,
  })}`;
}

function getScoringTierPanelClass(tier: 'Major' | 'Signature' | 'Standard') {
  if (tier === 'Major') return 'border-rose-300/35 bg-rose-300/12 text-rose-100';
  if (tier === 'Signature') return 'border-amber-300/35 bg-amber-300/12 text-amber-100';
  return 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100';
}

function StandingsTableCard({
  title,
  description,
  icon,
  standings,
  eventColumns,
}: {
  title: string;
  description?: string;
  icon: ReactNode;
  standings: SeasonStandingsDisplayRow[];
  eventColumns: EventFinishColumn[];
}) {
  return (
    <Card className="rounded-3xl border border-cyan-300/20 bg-[#0b1322]/90 text-zinc-100">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          {icon}
          <CardTitle>{title}</CardTitle>
        </div>
        {description ? <CardDescription className="text-zinc-400">{description}</CardDescription> : null}
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
                  <td className="px-2 py-2.5 text-right font-semibold text-cyan-300 sm:px-3 sm:py-3">
                    {entry.championshipPoints ?? '--'}
                  </td>
                  <td className="px-2 py-2.5 text-right font-semibold text-zinc-100 sm:px-3 sm:py-3">
                    {formatFantasyPoints(entry.weeklyFantasyPointsTotal)}
                  </td>
                  <td
                    className={`px-2 py-2.5 text-right font-semibold sm:px-3 sm:py-3 ${
                      typeof entry.netDollars === 'number'
                        ? entry.netDollars > 0
                          ? 'text-emerald-300'
                          : entry.netDollars < 0
                            ? 'text-rose-300'
                            : 'text-zinc-200'
                        : 'text-zinc-400'
                    }`}
                  >
                    {formatNetDollars(entry.netDollars)}
                  </td>
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
  );
}

function QuarterFinalPayoutsCard({ payouts }: { payouts: QuarterFinalPayoutRow[] }) {
  const activePlayers = payouts[0]?.activePlayers ?? 0;

  return (
    <Card className="rounded-3xl border border-emerald-300/20 bg-[#0b1322]/90 text-zinc-100">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-emerald-300" />
          <CardTitle>Q2 final quarter payouts</CardTitle>
        </div>
        <CardDescription className="text-zinc-400">
          Gross quarter-prize payouts for the final Q2 standings, based on the {activePlayers || '--'}-player active
          quarter pool. This is separate from Net $.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[420px] text-sm">
            <thead className="bg-white/[0.04] text-zinc-300">
              <tr>
                <th className="px-3 py-2 text-left">Finish</th>
                <th className="px-3 py-2 text-left">User</th>
                <th className="px-3 py-2 text-right">Q2 points</th>
                <th className="px-3 py-2 text-right">Payout</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((row) => (
                <tr key={row.entryId} className="border-t border-white/5">
                  <td className="px-3 py-2.5 font-semibold">{getRankLabel(row.rank)}</td>
                  <td className="px-3 py-2.5">{row.displayName}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-cyan-300">{row.championshipPoints}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-emerald-300">{formatPayoutDollars(row.payout)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SeasonPage() {
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

  const overallStandings = useMemo(() => getSeasonStandingsRows(), []);
  const overallColumns = useMemo(() => getSeasonEventColumns(), []);
  const q2Standings = useMemo(() => getQ2StandingsRows(), []);
  const q2Columns = useMemo(() => getQ2EventColumns(), []);
  const q2FinalPayouts = useMemo(() => getQ2FinalPayoutRows(), []);
  const q2ScoringMatrix = useMemo(() => getQ2SixteenPlayerScoringMatrix(), []);
  const q2Schedule = useMemo(() => getQuarterScheduleRows(2), []);
  const latestWeeklyFinal = useMemo(() => getLatestWeeklyFinalStandings(), []);

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

        <Tabs defaultValue="q2" className="w-full">
          <TabsList className="flex h-auto min-h-10 w-full flex-wrap justify-start gap-1 rounded-xl border border-white/10 bg-[#111827]/90 p-1.5 text-zinc-400">
            <TabsTrigger
              value="q2"
              className="rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 data-[state=active]:bg-blue-500/25 data-[state=active]:text-blue-100 data-[state=active]:shadow-none sm:text-sm"
            >
              Q2 standings
            </TabsTrigger>
            <TabsTrigger
              value="overall"
              className="rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 data-[state=active]:bg-blue-500/25 data-[state=active]:text-blue-100 data-[state=active]:shadow-none sm:text-sm"
            >
              Season-long
            </TabsTrigger>
            <TabsTrigger
              value="q2-scoring"
              className="rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 data-[state=active]:bg-blue-500/25 data-[state=active]:text-blue-100 data-[state=active]:shadow-none sm:text-sm"
            >
              Q2 points &amp; payouts
            </TabsTrigger>
            <TabsTrigger
              value="last-week"
              className="rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 data-[state=active]:bg-blue-500/25 data-[state=active]:text-blue-100 data-[state=active]:shadow-none sm:text-sm"
            >
              Last week final
            </TabsTrigger>
            <TabsTrigger
              value="q2-schedule"
              className="rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 data-[state=active]:bg-blue-500/25 data-[state=active]:text-blue-100 data-[state=active]:shadow-none sm:text-sm"
            >
              Q2 schedule
            </TabsTrigger>
            <Link
              href="/season/q1"
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/[0.08] hover:text-zinc-100 sm:text-sm"
            >
              Q1 history
            </Link>
          </TabsList>

          <TabsContent value="overall" className="mt-3">
            <StandingsTableCard
              title="Season standings (full league)"
              description="Season-long totals across all completed weeks. Use Q2 standings for the current quarter view."
              icon={<Trophy className="h-5 w-5 text-cyan-300" />}
              standings={overallStandings}
              eventColumns={overallColumns}
            />
          </TabsContent>

          <TabsContent value="q2" className="mt-3">
            <div className="space-y-3">
              <QuarterFinalPayoutsCard payouts={q2FinalPayouts} />
              <StandingsTableCard
                title="Quarter 2 standings"
                description="Computed Q2 snapshot from league-scoring/q2-standings.json with Q2 weekly finish columns only. Net $ includes weekly payouts, quarter payouts, and entry fees."
                icon={<Trophy className="h-5 w-5 text-amber-300" />}
                standings={q2Standings}
                eventColumns={q2Columns}
              />
            </div>
          </TabsContent>

          <TabsContent value="q2-scoring" className="mt-3">
            <Card className="rounded-3xl border border-cyan-300/20 bg-[#0b1322]/90 text-zinc-100">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Scale className="h-5 w-5 text-cyan-300" />
                  <CardTitle>Q2 championship points &amp; weekly payouts (16-pool)</CardTitle>
                </div>
                <CardDescription className="text-zinc-400">
                  Points follow the league matrix by finish and event tier. Dollar amounts are the Q2 full-field weekly
                  splits when all 16 quarter players enter. Special weeks (for example 15 paid entries) use adjusted
                  payouts from your league README.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="space-y-2 md:hidden">
                  {q2ScoringMatrix.map((row) => (
                    <div key={row.finish} className="rounded-2xl border border-white/10 bg-white/[0.03] p-2.5">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-semibold text-zinc-100">{row.finish}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        <div className={`rounded-lg border px-1.5 py-1.5 text-center ${getScoringTierPanelClass('Major')}`}>
                          <p className="text-[9px] font-semibold uppercase tracking-[0.1em]">Major</p>
                          <p className="mt-0.5 text-xs font-bold">{formatScoringCell(row.major)}</p>
                        </div>
                        <div className={`rounded-lg border px-1.5 py-1.5 text-center ${getScoringTierPanelClass('Signature')}`}>
                          <p className="text-[9px] font-semibold uppercase tracking-[0.1em]">Signature</p>
                          <p className="mt-0.5 text-xs font-bold">{formatScoringCell(row.signature)}</p>
                        </div>
                        <div className={`rounded-lg border px-1.5 py-1.5 text-center ${getScoringTierPanelClass('Standard')}`}>
                          <p className="text-[9px] font-semibold uppercase tracking-[0.1em]">Standard</p>
                          <p className="mt-0.5 text-xs font-bold">{formatScoringCell(row.standard)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden overflow-hidden rounded-2xl border border-white/10 md:block">
                  <table className="w-full table-fixed text-sm">
                    <thead className="bg-white/[0.04] text-zinc-300">
                      <tr>
                        <th className="px-3 py-2 text-left">Finish</th>
                        <th className="px-3 py-2 text-right text-rose-100">Major</th>
                        <th className="px-3 py-2 text-right text-amber-100">Signature</th>
                        <th className="px-3 py-2 text-right text-cyan-100">Standard</th>
                      </tr>
                    </thead>
                    <tbody>
                      {q2ScoringMatrix.map((row) => (
                        <tr key={row.finish} className="border-t border-white/5">
                          <td className="px-3 py-2 font-medium">{row.finish}</td>
                          <td className="px-3 py-2 text-right text-rose-100">{formatScoringCell(row.major)}</td>
                          <td className="px-3 py-2 text-right text-amber-100">{formatScoringCell(row.signature)}</td>
                          <td className="px-3 py-2 text-right text-cyan-100">{formatScoringCell(row.standard)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="last-week" className="mt-3">
            <Card className="rounded-3xl border border-cyan-300/20 bg-[#0b1322]/90 text-zinc-100">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-cyan-300" />
                  <CardTitle>Last week final standings &amp; payouts</CardTitle>
                </div>
                <CardDescription className="text-zinc-400">
                  {latestWeeklyFinal
                    ? `${latestWeeklyFinal.eventName} (${latestWeeklyFinal.tier}) final rank with tie-adjusted payouts.`
                    : 'No completed weekly scores found yet.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                {latestWeeklyFinal ? (
                  <div className="overflow-x-auto rounded-2xl border border-white/10">
                    <table className="w-full min-w-[520px] text-sm">
                      <thead className="bg-white/[0.04] text-zinc-300">
                        <tr>
                          <th className="px-3 py-2 text-left">Finish</th>
                          <th className="px-3 py-2 text-left">User</th>
                          <th className="px-3 py-2 text-right">Weekly FP</th>
                          <th className="px-3 py-2 text-right">Payout</th>
                        </tr>
                      </thead>
                      <tbody>
                        {latestWeeklyFinal.rows.map((row) => (
                          <tr key={row.entryId} className="border-t border-white/5">
                            <td className="px-3 py-2.5 font-semibold">{row.finishLabel}</td>
                            <td className="px-3 py-2.5">{row.displayName}</td>
                            <td className="px-3 py-2.5 text-right font-semibold">{formatFantasyPoints(row.weeklyFantasyPoints)}</td>
                            <td className={`px-3 py-2.5 text-right font-semibold ${row.payout > 0 ? 'text-emerald-300' : 'text-zinc-400'}`}>
                              {row.payout > 0 ? `+$${row.payout.toFixed(1).replace(/\\.0$/, '')}` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="q2-schedule" className="mt-3">
            <Card className="rounded-3xl border border-cyan-300/20 bg-[#0b1322]/90 text-zinc-100">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-cyan-300" />
                  <CardTitle>Quarter 2 schedule</CardTitle>
                </div>
                <CardDescription className="text-zinc-400">
                  Events in Q2 from league-scoring/schedule.json. Major / Signature / Standard sets weekly payout tier.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="overflow-x-auto rounded-2xl border border-white/10">
                  <table className="w-full min-w-[320px] text-sm">
                    <thead className="bg-white/[0.04] text-zinc-300">
                      <tr>
                        <th className="px-3 py-2 text-left">#</th>
                        <th className="px-3 py-2 text-left">Event</th>
                        <th className="px-3 py-2 text-left">Type</th>
                        <th className="px-3 py-2 text-left">Winner</th>
                      </tr>
                    </thead>
                    <tbody>
                      {q2Schedule.map((event: QuarterScheduleDisplayRow) => (
                        <tr key={event.id} className="border-t border-white/5">
                          <td className="px-3 py-2.5 font-mono text-zinc-400">{event.id}</td>
                          <td className="px-3 py-2.5 font-medium text-zinc-100">{event.name}</td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${getTierBadgeClass(event.tier)}`}
                            >
                              {getTierBadgeLabel(event.tier)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-zinc-400">
                            {event.winner}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
