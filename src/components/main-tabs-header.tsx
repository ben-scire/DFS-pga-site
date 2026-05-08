"use client";

import Link from 'next/link';
import type { AuthSession } from '@/lib/firebase-auth';
import { getDefaultContestId } from '@/lib/weekly-lineup-seed';
import { cn } from '@/lib/utils';

type MainTabKey = 'home' | 'lineup' | 'week-standings' | 'season' | 'scoring-rules' | 'admin';

interface MainTabsHeaderProps {
  session?: AuthSession | null;
  activeTab: MainTabKey;
  contestId?: string;
  className?: string;
}

function tabHref(tab: MainTabKey, contestId: string): string {
  if (tab === 'week-standings') return `/week-standings?contestId=${encodeURIComponent(contestId)}`;
  if (tab === 'season') return '/season';
  if (tab === 'home') return `/contests?contestId=${encodeURIComponent(contestId)}`;
  if (tab === 'lineup') return `/live-lineup?contestId=${encodeURIComponent(contestId)}`;
  if (tab === 'admin') return '/admin';
  return '/scoring-rules';
}

export default function MainTabsHeader({ session, activeTab, contestId = getDefaultContestId(), className }: MainTabsHeaderProps) {
  const tabs: Array<{ key: Extract<MainTabKey, 'week-standings' | 'season' | 'scoring-rules'>; label: string }> = [
    { key: 'week-standings', label: 'Week Standings' },
    { key: 'season', label: 'Season Standings' },
    { key: 'scoring-rules', label: 'Scoring Rules' },
  ];

  return (
    <header className={cn('rounded-2xl border border-white/10 bg-[#111827]/90 p-2.5 sm:p-3', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="overflow-x-auto">
          <div className="flex min-w-max items-center gap-2 pr-1">
            {tabs
              .map((tab) => {
                const active = tab.key === activeTab;
                return (
                  <Link
                    key={tab.key}
                    href={tabHref(tab.key, contestId)}
                    className={cn(
                      'rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm',
                      active
                        ? 'bg-blue-500/25 text-blue-200'
                        : 'bg-white/[0.03] text-zinc-300 hover:bg-white/[0.08]'
                    )}
                  >
                    {tab.label}
                  </Link>
                );
              })}
          </div>
        </div>

        <p className="rounded-lg border border-cyan-200/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-medium text-cyan-100">
          Public View
        </p>
      </div>
    </header>
  );
}
