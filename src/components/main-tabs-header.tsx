"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { signOutAuthSession, type AuthSession } from '@/lib/firebase-auth';
import { getWeeklyContestById } from '@/lib/weekly-lineup-seed';
import { cn } from '@/lib/utils';

type MainTabKey = 'home' | 'lineup' | 'week-standings' | 'season' | 'admin';

interface MainTabsHeaderProps {
  session: AuthSession;
  activeTab: MainTabKey;
  contestId?: string;
  className?: string;
}

function tabHref(tab: MainTabKey, contestId: string): string {
  const contest = getWeeklyContestById(contestId);
  const contestLiveByStatus = contest?.status === 'live' || contest?.status === 'final';
  const contestLiveByLock = contest ? Date.now() >= new Date(contest.lockAtIso).getTime() : false;
  const useLiveLineup = contestLiveByStatus || contestLiveByLock;

  if (tab === 'home') return `/contests?contestId=${encodeURIComponent(contestId)}`;
  if (tab === 'lineup') {
    return useLiveLineup
      ? `/live-lineup?contestId=${encodeURIComponent(contestId)}`
      : `/lineup?contestId=${encodeURIComponent(contestId)}`;
  }
  if (tab === 'week-standings') return `/week-standings?contestId=${encodeURIComponent(contestId)}`;
  if (tab === 'season') return '/season';
  return '/admin';
}

export default function MainTabsHeader({ session, activeTab, contestId = 'week-2-arnold-palmer', className }: MainTabsHeaderProps) {
  const router = useRouter();

  const tabs: Array<{ key: MainTabKey; label: string; hidden?: boolean }> = [
    { key: 'home', label: 'Home' },
    { key: 'lineup', label: 'My Lineup' },
    { key: 'week-standings', label: 'Week Standings' },
    { key: 'season', label: 'Season Standings' },
    { key: 'admin', label: 'Admin', hidden: !session.isAdmin },
  ];

  return (
    <header className={cn('rounded-2xl border border-white/10 bg-[#111827]/90 p-3', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="overflow-x-auto">
          <div className="flex min-w-max items-center gap-2 pr-1">
          {tabs
            .filter((tab) => !tab.hidden)
            .map((tab) => {
              const active = tab.key === activeTab;
              return (
                <Link
                  key={tab.key}
                  href={tabHref(tab.key, contestId)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
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

        <div className="flex items-center gap-2">
          <p className="hidden text-xs text-zinc-400 sm:block">{session.userDisplayName}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-white/15 bg-white/5 text-zinc-100 hover:bg-white/10"
            onClick={() => {
              void signOutAuthSession().then(() => router.replace('/'));
            }}
          >
            Sign Out
          </Button>
        </div>
      </div>
    </header>
  );
}
