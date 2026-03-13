"use client";

import { Suspense } from 'react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { parsePlayerPoolCsv } from '@/lib/player-pool-import';
import { clearImportedPlayerPool, saveImportedPlayerPool } from '@/lib/weekly-lineup-storage';
import { getDefaultContestId, getWeeklyContestById } from '@/lib/weekly-lineup-seed';
import { toast } from '@/hooks/use-toast';

function AdminPlayerPoolContent() {
  const searchParams = useSearchParams();
  const contestId = searchParams.get('contestId') ?? getDefaultContestId();
  const contest = getWeeklyContestById(contestId);
  const [csvText, setCsvText] = useState('');

  const previewRows = useMemo(() => {
    if (!csvText.trim()) return [];
    return parsePlayerPoolCsv(csvText);
  }, [csvText]);

  const handleImport = () => {
    if (!previewRows.length) {
      toast({
        title: 'No rows parsed',
        description: 'Paste a CSV with at least `name` and `salary` columns.',
        variant: 'destructive',
      });
      return;
    }

    saveImportedPlayerPool(contestId, previewRows);
    toast({
      title: 'Player pool imported',
      description: `${previewRows.length} golfers saved for ${contest?.name ?? contestId}.`,
    });
  };

  const handleReset = () => {
    clearImportedPlayerPool(contestId);
    toast({ title: 'Imported player pool cleared', description: 'Lineup page will fall back to the seeded default pool.' });
  };

  return (
    <div className="min-h-screen bg-[#111318] px-4 py-6 text-zinc-100">
      <div className="mx-auto max-w-5xl space-y-4">
        <Card className="rounded-2xl border-zinc-800 bg-[#191c24] text-zinc-100">
          <CardHeader>
            <CardTitle>Admin: Player Pool Import (CSV)</CardTitle>
            <CardDescription className="text-zinc-400">
              Use this to sync this week&apos;s DK salaries quickly. Required columns: <code>name</code>, <code>salary</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">Contest ID</label>
                <Input value={contestId} readOnly className="border-zinc-700 bg-zinc-900/60 text-zinc-100" />
              </div>
              <div className="flex gap-2">
                <Button asChild variant="outline" className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-zinc-800">
                  <Link href={`/lineup?contestId=${contestId}`}>Open Lineup Builder</Link>
                </Button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-300">Paste CSV</label>
              <Textarea
                value={csvText}
                onChange={(event) => setCsvText(event.target.value)}
                rows={12}
                className="border-zinc-700 bg-zinc-900/70 text-zinc-100 placeholder:text-zinc-500"
                placeholder={'name,salary,fppg,avg,cutsMade,cutsAttempts,top10s,teeTime\nR. Gerard,9700,101.7,67.9,6,6,3,Thu 6:45 AM EST'}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleImport} className="bg-emerald-600 text-white hover:bg-emerald-500">
                Save Imported Player Pool
              </Button>
              <Button onClick={handleReset} variant="outline" className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-zinc-800">
                Clear Imported Pool
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-zinc-800 bg-[#191c24] text-zinc-100">
          <CardHeader>
            <CardTitle>Preview ({previewRows.length})</CardTitle>
            <CardDescription className="text-zinc-400">
              Parsed columns map automatically for common header names (`salary`, `dk_salary`, `fppg`, `avg`, etc.).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[420px] overflow-auto rounded-xl border border-zinc-800">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-zinc-900 text-xs uppercase tracking-wide text-zinc-400">
                  <tr>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Salary</th>
                    <th className="px-3 py-2 text-left">FPPG</th>
                    <th className="px-3 py-2 text-left">Avg</th>
                    <th className="px-3 py-2 text-left">Cuts</th>
                    <th className="px-3 py-2 text-left">Tee Time</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row) => (
                    <tr key={row.golferId} className="border-t border-zinc-800 bg-zinc-950/40">
                      <td className="px-3 py-2">{row.name}</td>
                      <td className="px-3 py-2">${row.salary.toLocaleString()}</td>
                      <td className="px-3 py-2">{row.fppg?.toFixed(1) ?? '-'}</td>
                      <td className="px-3 py-2">{row.avgScore?.toFixed(1) ?? '-'}</td>
                      <td className="px-3 py-2">
                        {row.cutsMade ?? '-'} / {row.cutsAttempts ?? '-'}
                      </td>
                      <td className="px-3 py-2">{row.teeTimeDisplay ?? '-'}</td>
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

export default function AdminPlayerPoolPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#111318]" />}>
      <AdminPlayerPoolContent />
    </Suspense>
  );
}
