"use client";

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LineupRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const contestId = searchParams.get('contestId') ?? 'week-1-cognizant';
  const lineupUserId = searchParams.get('userId') ?? 'guest';
  const viewerUserId = searchParams.get('viewerId')?.trim() || lineupUserId;

  useEffect(() => {
    const params = new URLSearchParams({
      contestId,
      userId: lineupUserId,
      viewerId: viewerUserId,
    });
    router.replace(`/live-lineup?${params.toString()}`);
  }, [contestId, lineupUserId, router, viewerUserId]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#080c13] px-6 text-zinc-100">
      <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-zinc-300">
        Lineups are locked. Redirecting to live lineup view...
      </div>
    </div>
  );
}

export default function LineupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#080c13]" />}>
      <LineupRedirectContent />
    </Suspense>
  );
}
