"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Medal } from 'lucide-react';
import MainTabsHeader from '@/components/main-tabs-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { subscribeAuthSession, type AuthSession } from '@/lib/firebase-auth';
import { formatScoringCell, SCORING_MATRIX } from '@/lib/season-display';

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

      <div className="relative mx-auto max-w-5xl space-y-4">
        <MainTabsHeader session={session} activeTab="scoring-rules" />

        <header className="rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-[#101a2c] via-[#0b1322] to-[#080d15] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.5)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/70">5x5 Global</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Scoring Rules</h1>
          <p className="mt-2 text-sm text-zinc-400">Championship points and weekly payout structure for Standard, Signature, and Major events.</p>
        </header>

        <Card className="rounded-3xl border border-cyan-300/20 bg-[#0b1322]/90 text-zinc-100">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Medal className="h-5 w-5 text-cyan-300" />
              <CardTitle>Fantasy Golf League Scoring</CardTitle>
            </div>
            <CardDescription className="text-zinc-400">
              Weekly finish determines both championship points and event payouts. Signature columns are highlighted in gold.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full min-w-[700px] text-sm">
                <thead className="bg-white/[0.04] text-zinc-300">
                  <tr>
                    <th className="px-3 py-2 text-left">Finish</th>
                    <th className="px-3 py-2 text-right">Major</th>
                    <th className="px-3 py-2 text-right text-amber-200">Signature</th>
                    <th className="px-3 py-2 text-right">Standard</th>
                  </tr>
                </thead>
                <tbody>
                  {SCORING_MATRIX.map((row) => (
                    <tr key={row.finish} className="border-t border-white/5">
                      <td className="px-3 py-2 font-medium">{row.finish}</td>
                      <td className="px-3 py-2 text-right">{formatScoringCell(row.major)}</td>
                      <td className="px-3 py-2 text-right text-amber-100">{formatScoringCell(row.signature)}</td>
                      <td className="px-3 py-2 text-right">{formatScoringCell(row.standard)}</td>
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
