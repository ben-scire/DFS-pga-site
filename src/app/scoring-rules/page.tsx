"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Medal } from 'lucide-react';
import MainTabsHeader from '@/components/main-tabs-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { subscribeAuthSession, type AuthSession } from '@/lib/firebase-auth';
import { formatScoringCell, SCORING_MATRIX } from '@/lib/season-display';

function getTierPanelClass(tier: 'Major' | 'Signature' | 'Standard') {
  if (tier === 'Major') return 'border-rose-300/35 bg-rose-300/12 text-rose-100';
  if (tier === 'Signature') return 'border-amber-300/35 bg-amber-300/12 text-amber-100';
  return 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100';
}

export default function ScoringRulesPage() {
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

  if (checkingSession) {
    return <div className="min-h-screen bg-[#040914]" />;
  }

  if (!session) {
    return null;
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#040914] px-3 py-5 text-zinc-100 sm:px-4 sm:py-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 top-8 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute right-0 top-16 h-80 w-80 rounded-full bg-amber-400/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-5xl space-y-3.5">
        <MainTabsHeader session={session} activeTab="scoring-rules" />

        <Card className="rounded-3xl border border-cyan-300/20 bg-[#0b1322]/90 text-zinc-100">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Medal className="h-5 w-5 text-cyan-300" />
              <CardTitle>Fantasy Golf League Scoring</CardTitle>
            </div>
            <CardDescription className="text-zinc-400">
              Championship points and payouts by finish for Major, Signature, and Standard events.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="space-y-2 md:hidden">
              {SCORING_MATRIX.map((row) => (
                <div key={row.finish} className="rounded-2xl border border-white/10 bg-white/[0.03] p-2.5">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-zinc-100">{row.finish}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div className={`rounded-lg border px-1.5 py-1.5 text-center ${getTierPanelClass('Major')}`}>
                      <p className="text-[9px] font-semibold uppercase tracking-[0.1em]">Major</p>
                      <p className="mt-0.5 text-xs font-bold">{formatScoringCell(row.major)}</p>
                    </div>
                    <div className={`rounded-lg border px-1.5 py-1.5 text-center ${getTierPanelClass('Signature')}`}>
                      <p className="text-[9px] font-semibold uppercase tracking-[0.1em]">Signature</p>
                      <p className="mt-0.5 text-xs font-bold">{formatScoringCell(row.signature)}</p>
                    </div>
                    <div className={`rounded-lg border px-1.5 py-1.5 text-center ${getTierPanelClass('Standard')}`}>
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
                  {SCORING_MATRIX.map((row) => (
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
      </div>
    </div>
  );
}
