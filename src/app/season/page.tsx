import fs from 'node:fs/promises';
import path from 'node:path';
import Link from 'next/link';
import { ArrowLeft, Calendar, Medal, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import standingsData from '../../../league-scoring/season-standings.json';
import scheduleData from '../../../league-scoring/schedule.json';

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

type ScoringCell = {
  points: number;
  payout?: number;
};

const SCORING_MATRIX: Array<{
  finish: string;
  major: ScoringCell;
  signature: ScoringCell;
  standard: ScoringCell;
}> = [
  { finish: '1st', major: { points: 50, payout: 115 }, signature: { points: 40, payout: 105 }, standard: { points: 30, payout: 75 } },
  { finish: '2nd', major: { points: 40, payout: 55 }, signature: { points: 32, payout: 50 }, standard: { points: 24, payout: 50 } },
  { finish: '3rd', major: { points: 33, payout: 25 }, signature: { points: 26, payout: 35 }, standard: { points: 20, payout: 40 } },
  { finish: '4th', major: { points: 27, payout: 15 }, signature: { points: 22, payout: 20 }, standard: { points: 17, payout: 25 } },
  { finish: '5th', major: { points: 22, payout: 10 }, signature: { points: 18, payout: 10 }, standard: { points: 14 } },
  { finish: '6th', major: { points: 18 }, signature: { points: 15 }, standard: { points: 12 } },
  { finish: '7th', major: { points: 15 }, signature: { points: 13 }, standard: { points: 10 } },
  { finish: '8th', major: { points: 13 }, signature: { points: 11 }, standard: { points: 8 } },
  { finish: '9th', major: { points: 11 }, signature: { points: 9 }, standard: { points: 7 } },
  { finish: '10th', major: { points: 10 }, signature: { points: 8 }, standard: { points: 6 } },
  { finish: '11th', major: { points: 8 }, signature: { points: 6 }, standard: { points: 5 } },
  { finish: '12th', major: { points: 7 }, signature: { points: 5 }, standard: { points: 4 } },
  { finish: '13th', major: { points: 6 }, signature: { points: 4 }, standard: { points: 3 } },
  { finish: '14th', major: { points: 5 }, signature: { points: 3 }, standard: { points: 2 } },
  { finish: '15th', major: { points: 4 }, signature: { points: 2 }, standard: { points: 2 } },
  { finish: '16th', major: { points: 3 }, signature: { points: 2 }, standard: { points: 1 } },
  { finish: '17th', major: { points: 2 }, signature: { points: 1 }, standard: { points: 1 } },
  { finish: '18th', major: { points: 2 }, signature: { points: 1 }, standard: { points: 1 } },
  { finish: '19th', major: { points: 1 }, signature: { points: 1 }, standard: { points: 1 } },
  { finish: '20th', major: { points: 1 }, signature: { points: 1 }, standard: { points: 1 } },
  { finish: 'No Show', major: { points: 0 }, signature: { points: 0 }, standard: { points: 0 } },
];

function formatScoringCell(cell: ScoringCell) {
  return typeof cell.payout === 'number' ? `${cell.points} ($${cell.payout})` : `${cell.points}`;
}

async function loadWeeklyScores(): Promise<WeeklyScoreFile[]> {
  const weeklyScoresDir = path.join(process.cwd(), 'league-scoring', 'weekly-scores');
  const fileNames = await fs.readdir(weeklyScoresDir);
  const weeklyFiles = await Promise.all(
    fileNames
      .filter((fileName) => fileName.endsWith('.json'))
      .map(async (fileName) => {
        const filePath = path.join(weeklyScoresDir, fileName);
        const fileContents = await fs.readFile(filePath, 'utf8');
        return JSON.parse(fileContents) as WeeklyScoreFile;
      })
  );

  return weeklyFiles.sort((a, b) => a.eventId - b.eventId);
}

export default async function SeasonPage() {
  const standings = [...(standingsData as StandingsEntry[])].sort((a, b) => {
    const pointsDelta = (b.championshipPoints ?? -1) - (a.championshipPoints ?? -1);
    if (pointsDelta !== 0) return pointsDelta;
    return (b.weeklyFantasyPointsTotal ?? -1) - (a.weeklyFantasyPointsTotal ?? -1);
  });

  const weeklyScores = await loadWeeklyScores();
  const completedThroughEventId = weeklyScores.at(-1)?.eventId ?? 0;
  const winners: RecentWinner[] = weeklyScores
    .filter((week) => week.entries.length > 0)
    .map((week) => {
      const weekWinner = week.entries
        .slice()
        .sort((a, b) => b.weeklyFantasyPoints - a.weeklyFantasyPoints)[0];

      return {
        week: week.eventId,
        eventName: week.eventName,
        winnerName: weekWinner?.entryName ?? '--',
        winnerScore: weekWinner?.weeklyFantasyPoints ?? 0,
      };
    })
    .sort((a, b) => b.week - a.week)
    .slice(0, 5);
  const upcoming = (scheduleData as ScheduleEvent[])
    .filter((event) => event.id > completedThroughEventId)
    .slice(0, 5);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#040914] px-4 py-6 text-zinc-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 top-8 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute -right-16 top-24 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl space-y-4">
        <header className="rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-[#101a2c] via-[#0b1322] to-[#080d15] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.5)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/70">5x5 Global</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">League Standings</h1>
          <p className="mt-2 text-sm text-zinc-400">2026 Golf DK Championship season race and points matrix.</p>
          <div className="mt-4">
            <Button asChild variant="outline" className="border-cyan-300/25 bg-white/[0.03] text-zinc-100 hover:bg-white/10">
              <Link href="/contests">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Contests
              </Link>
            </Button>
          </div>
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
                        <th className="px-2 py-2 text-right">Major</th>
                        <th className="px-2 py-2 text-right">Signature</th>
                        <th className="px-2 py-2 text-right">Standard</th>
                      </tr>
                    </thead>
                    <tbody>
                      {SCORING_MATRIX.map((row) => (
                        <tr key={row.finish} className="border-t border-white/5">
                          <td className="px-2 py-1.5 font-medium">{row.finish}</td>
                          <td className="px-2 py-1.5 text-right">{formatScoringCell(row.major)}</td>
                          <td className="px-2 py-1.5 text-right">{formatScoringCell(row.signature)}</td>
                          <td className="px-2 py-1.5 text-right">{formatScoringCell(row.standard)}</td>
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
