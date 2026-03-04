"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Medal, Trophy } from 'lucide-react';
import MainTabsHeader from '@/components/main-tabs-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { subscribeAuthSession, type AuthSession } from '@/lib/firebase-auth';
import standingsData from '../../../league-scoring/season-standings.json';
import scheduleData from '../../../league-scoring/schedule.json';
import weekOneData from '../../../league-scoring/weekly-scores/week-1-cognizant.json';

type StandingsEntry = {
  rank: number | null;
  entryId: string;
  entryName: string;
  championshipPoints: number | null;
  netDollars: number | null;
  weeklyFantasyPointsTotal: number | null;
  weeklyWins: number | null;
  previousWeekFinish: number | null;
  weeksEntered: number | null;
};

type ScheduleEvent = {
  id: number;
  name: string;
  tier: 'Standard' | 'Signature' | 'Major';
  quarter: number;
  isQuarterFinale: boolean;
};

type RecentWinner = {
  week: number;
  eventName: string;
  winnerName: string;
  winnerScore: number;
};

type WeeklyScoreEntry = {
  entryName: string;
  weeklyFantasyPoints: number;
};

type WeeklyScoreFile = {
  eventId: number;
  eventName: string;
  entries: WeeklyScoreEntry[];
};

const SCORING_MATRIX = [
  { finish: '1st', major: 50, signature: 40, standard: 30 },
  { finish: '2nd', major: 40, signature: 32, standard: 24 },
  { finish: '3rd', major: 33, signature: 26, standard: 20 },
  { finish: '4th', major: 27, signature: 22, standard: 17 },
  { finish: '5th', major: 22, signature: 18, standard: 14 },
  { finish: '6th', major: 18, signature: 15, standard: 12 },
  { finish: '7th', major: 15, signature: 13, standard: 10 },
  { finish: '8th', major: 13, signature: 11, standard: 8 },
  { finish: '9th', major: 11, signature: 9, standard: 7 },
  { finish: '10th', major: 10, signature: 8, standard: 6 },
  { finish: '11th', major: 8, signature: 6, standard: 5 },
  { finish: '12th', major: 7, signature: 5, standard: 4 },
  { finish: '13th', major: 6, signature: 4, standard: 3 },
  { finish: '14th', major: 5, signature: 3, standard: 2 },
  { finish: '15th', major: 4, signature: 2, standard: 2 },
  { finish: '16th', major: 3, signature: 2, standard: 1 },
  { finish: '17th', major: 2, signature: 1, standard: 1 },
  { finish: '18th', major: 2, signature: 1, standard: 1 },
  { finish: '19th', major: 1, signature: 1, standard: 1 },
  { finish: '20th', major: 1, signature: 1, standard: 1 },
  { finish: 'No Show', major: 0, signature: 0, standard: 0 },
];

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

  const standings = [...(standingsData as StandingsEntry[])].sort((a, b) => {
    const pointsDelta = (b.championshipPoints ?? -1) - (a.championshipPoints ?? -1);
    if (pointsDelta !== 0) return pointsDelta;
    return (b.weeklyFantasyPointsTotal ?? -1) - (a.weeklyFantasyPointsTotal ?? -1);
  });

  const weekOne = weekOneData as WeeklyScoreFile;
  const weekOneWinner = weekOne.entries
    .slice()
    .sort((a, b) => b.weeklyFantasyPoints - a.weeklyFantasyPoints)[0];
  const winners: RecentWinner[] = weekOne.entries.length
    ? [{
      week: weekOne.eventId,
      eventName: weekOne.eventName,
      winnerName: weekOneWinner?.entryName ?? '--',
      winnerScore: weekOneWinner?.weeklyFantasyPoints ?? 0,
    }]
    : [];
  const upcoming = (scheduleData as ScheduleEvent[])
    .filter((event) => event.id > weekOne.eventId)
    .slice(0, 5);

  if (checkingSession) {
    return <div className="min-h-screen bg-[#040914]" />;
  }

  if (!session) {
    return null;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#040914] px-4 py-6 text-zinc-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 top-8 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute -right-16 top-24 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl space-y-4">
        <MainTabsHeader session={session} activeTab="season" />

        <header className="rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-[#101a2c] via-[#0b1322] to-[#080d15] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.5)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/70">5x5 Global</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Season Standings</h1>
          <p className="mt-2 text-sm text-zinc-400">2026 Golf DK Championship season race and points matrix.</p>
        </header>

        <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
          <Card className="rounded-3xl border border-cyan-300/20 bg-[#0b1322]/90 text-zinc-100">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-cyan-300" />
                <CardTitle>Overall Standings</CardTitle>
              </div>
              <CardDescription className="text-zinc-400">
                Ranked by championship points, with weekly fantasy points as tiebreaker.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-white/[0.04] text-zinc-300">
                    <tr>
                      <th className="px-3 py-2 text-left">Rank</th>
                      <th className="px-3 py-2 text-left">User</th>
                      <th className="px-3 py-2 text-right">Champ Pts</th>
                      <th className="px-3 py-2 text-right">Fantasy Pts</th>
                      <th className="px-3 py-2 text-right">Net $</th>
                      <th className="px-3 py-2 text-center">Wins</th>
                      <th className="px-3 py-2 text-center">Last Wk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((entry) => (
                      <tr key={entry.entryId} className="border-t border-white/5">
                        <td className="px-3 py-2 font-semibold">{entry.rank ?? '--'}</td>
                        <td className="px-3 py-2">{entry.entryName}</td>
                        <td className="px-3 py-2 text-right text-cyan-300">{entry.championshipPoints ?? '--'}</td>
                        <td className="px-3 py-2 text-right">{entry.weeklyFantasyPointsTotal ?? '--'}</td>
                        <td className="px-3 py-2 text-right">
                          {typeof entry.netDollars === 'number'
                            ? `${entry.netDollars < 0 ? '-' : ''}$${Math.abs(entry.netDollars).toFixed(2)}`
                            : '--'}
                        </td>
                        <td className="px-3 py-2 text-center">{entry.weeklyWins ?? '--'}</td>
                        <td className="px-3 py-2 text-center">{entry.previousWeekFinish ?? '--'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="rounded-3xl border border-cyan-300/20 bg-[#0b1322]/90 text-zinc-100">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Medal className="h-5 w-5 text-cyan-300" />
                  <CardTitle>Fantasy Golf League Scoring</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-2xl border border-white/10">
                  <table className="w-full min-w-[420px] text-xs sm:text-sm">
                    <thead className="bg-white/[0.04] text-zinc-300">
                      <tr>
                        <th className="px-2 py-2 text-left">Finish</th>
                        <th className="px-2 py-2 text-right">Major (2.5x)</th>
                        <th className="px-2 py-2 text-right">Signature (2x)</th>
                        <th className="px-2 py-2 text-right">Standard (1.5x)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {SCORING_MATRIX.map((row) => (
                        <tr key={row.finish} className="border-t border-white/5">
                          <td className="px-2 py-1.5 font-medium">{row.finish}</td>
                          <td className="px-2 py-1.5 text-right">{row.major}</td>
                          <td className="px-2 py-1.5 text-right">{row.signature}</td>
                          <td className="px-2 py-1.5 text-right">{row.standard}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border border-cyan-300/20 bg-[#0b1322]/90 text-zinc-100">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-cyan-300" />
                  <CardTitle>Recent Winners</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {winners.map((winner) => (
                  <div key={`${winner.week}-${winner.winnerName}`} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                    <p className="font-semibold">Week {winner.week}: {winner.eventName}</p>
                    <p className="text-zinc-400">{winner.winnerName} · {winner.winnerScore.toFixed(1)} pts</p>
                  </div>
                ))}
                {winners.length === 0 && <p className="text-zinc-400">No completed weeks yet.</p>}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border border-cyan-300/20 bg-[#0b1322]/90 text-zinc-100">
              <CardHeader>
                <CardTitle>Upcoming Events</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {upcoming.map((event) => (
                  <div key={event.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                    <span>{event.name}</span>
                    <span className="text-xs text-zinc-400">{event.tier}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
