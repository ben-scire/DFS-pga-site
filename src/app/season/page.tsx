"use client";

import { useMemo, useState } from 'react';
import { MINI_SEASONS, CHAMPIONSHIP_POINTS_TOP_10, DEFAULT_MAJOR_CHAMPIONSHIP_MULTIPLIER } from '@/lib/championship-points';
import type { MiniSeasonId } from '@/lib/league-types';
import { getMockMiniSeasonStandings, mockChampionshipContestResults } from '@/lib/season-mock';

function ordinalLabel(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n}st`;
  if (mod10 === 2 && mod100 !== 12) return `${n}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${n}rd`;
  return `${n}th`;
}

function majorName(key?: string): string {
  switch (key) {
    case 'masters':
      return 'Masters';
    case 'pga':
      return 'PGA Championship';
    case 'us-open':
      return 'U.S. Open';
    case 'the-open':
      return 'The Open Championship';
    default:
      return 'Major';
  }
}

export default function SeasonPage() {
  const [selectedMiniSeason, setSelectedMiniSeason] = useState<MiniSeasonId>('q1');

  const standings = useMemo(() => getMockMiniSeasonStandings(selectedMiniSeason), [selectedMiniSeason]);

  const selectedMiniSeasonContests = useMemo(
    () => mockChampionshipContestResults.filter((contest) => contest.contest.miniSeasonId === selectedMiniSeason),
    [selectedMiniSeason]
  );

  return (
    <div className="min-h-screen bg-[#12131a] px-4 py-4 text-zinc-100 md:px-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="rounded-2xl border border-zinc-700/60 bg-[#191b24] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">5x5 Global</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">Season Championship Standings</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Weekly top-10 championship points only. Major weeks apply a{' '}
            <span className="font-semibold text-emerald-400">{DEFAULT_MAJOR_CHAMPIONSHIP_MULTIPLIER}x multiplier</span>.
          </p>
        </header>

        <div className="grid gap-5 lg:grid-cols-[1.15fr_1.85fr]">
          <section className="rounded-2xl border border-zinc-700/60 bg-[#191b24]">
            <div className="border-b border-zinc-700/60 px-5 py-4">
              <h2 className="text-xl font-semibold tracking-[0.08em] text-zinc-100">Championship Points System Overview</h2>
            </div>
            <div className="overflow-hidden rounded-b-2xl">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-zinc-700/60 bg-[#171922] text-xs uppercase tracking-[0.15em] text-zinc-400">
                    <th className="px-5 py-4">Position</th>
                    <th className="px-5 py-4">Championship Points</th>
                  </tr>
                </thead>
                <tbody>
                  {CHAMPIONSHIP_POINTS_TOP_10.map((points, index) => (
                    <tr key={index} className="border-b border-zinc-700/50 last:border-b-0">
                      <td className="px-5 py-5 text-xl text-zinc-200">{ordinalLabel(index + 1)}</td>
                      <td className="px-5 py-5 text-xl font-medium text-zinc-100">{points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-2xl border border-zinc-700/60 bg-[#191b24] p-3">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {MINI_SEASONS.map((miniSeason) => {
                  const isSelected = miniSeason.id === selectedMiniSeason;
                  return (
                    <button
                      key={miniSeason.id}
                      type="button"
                      onClick={() => setSelectedMiniSeason(miniSeason.id)}
                      className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                          : 'border-zinc-700 bg-[#151720] text-zinc-300 hover:bg-[#1c1f29]'
                      }`}
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.12em]">{miniSeason.id.toUpperCase()}</p>
                      <p className="mt-1 text-sm font-medium">{miniSeason.name.replace('Mini Season ', 'MS ')}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-700/60 bg-[#191b24]">
              <div className="flex items-center justify-between border-b border-zinc-700/60 px-5 py-4">
                <div>
                  <h2 className="text-xl font-semibold text-zinc-100">
                    {MINI_SEASONS.find((row) => row.id === selectedMiniSeason)?.name}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    Standings reset each mini-season. Top 2 payout eligibility can require all weeks played.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-700/60 bg-[#171922] text-left text-xs uppercase tracking-[0.14em] text-zinc-400">
                      <th className="px-4 py-3">Rank</th>
                      <th className="px-4 py-3">Player</th>
                      <th className="px-4 py-3">Champ Pts</th>
                      <th className="px-4 py-3">Fantasy Pts (Tie)</th>
                      <th className="px-4 py-3">Weeks</th>
                      <th className="px-4 py-3">Prize Eligible</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((row) => (
                      <tr key={row.uid} className="border-b border-zinc-700/50 text-sm last:border-b-0">
                        <td className="px-4 py-4 text-lg font-semibold text-zinc-100">{row.rank}</td>
                        <td className="px-4 py-4 font-medium text-zinc-200">{row.username}</td>
                        <td className="px-4 py-4 text-lg font-bold text-emerald-400">{row.championshipPoints}</td>
                        <td className="px-4 py-4 text-zinc-200">{row.fantasyPointsTotal.toFixed(2)}</td>
                        <td className="px-4 py-4 text-zinc-300">
                          {row.weeksScored}/{selectedMiniSeasonContests.length}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                              row.eligibleForMiniSeasonPrize
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : 'bg-zinc-700/60 text-zinc-300'
                            }`}
                          >
                            {row.eligibleForMiniSeasonPrize ? 'Eligible' : 'Not Eligible'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-700/60 bg-[#191b24] p-4">
              <h3 className="text-base font-semibold text-zinc-100">Mini-Season Weekly Schedule (Championship Scoring)</h3>
              <div className="mt-3 space-y-2">
                {selectedMiniSeasonContests.map(({ contest }) => (
                  <div
                    key={contest.contestId}
                    className="flex items-center justify-between rounded-lg border border-zinc-700/60 bg-[#151720] px-3 py-2"
                  >
                    <div>
                      <p className="font-medium text-zinc-200">
                        Week {contest.weekNumber}: {contest.contestName}
                      </p>
                      <p className="text-xs text-zinc-400">
                        {contest.isMajor ? `${majorName(contest.majorKey)} major week` : 'Standard week'}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        contest.isMajor ? 'bg-amber-500/20 text-amber-300' : 'bg-zinc-700/60 text-zinc-300'
                      }`}
                    >
                      {contest.championshipMultiplier}x points
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
