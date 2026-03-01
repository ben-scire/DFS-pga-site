"use client";

import Link from 'next/link';
import { ArrowLeft, Construction } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SeasonPage() {
  return (
    <div className="min-h-screen bg-[#080c13] px-4 py-6 text-zinc-100">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#171f2d] via-[#111827] to-[#0b1018] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">5x5 Global</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Season Standings</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Season-long championship standings are temporarily hidden while we test this week&apos;s live lineup tracking flow.
          </p>
        </header>

        <Card className="rounded-3xl border border-white/10 bg-[#101722] text-zinc-100">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Construction className="h-5 w-5 text-amber-300" />
              <CardTitle>Coming Back After Test Week</CardTitle>
            </div>
            <CardDescription className="text-zinc-400">
              Mock season filler has been removed. We&apos;ll reconnect this page to real standings once weekly live tracking is stable.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild className="bg-blue-500 text-white hover:bg-blue-400">
              <Link href="/contests">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Contest Hub
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
