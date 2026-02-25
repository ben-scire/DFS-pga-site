"use client";

import { Minus, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { sortPlayerPool } from '@/lib/lineup-builder';
import type { PlayerPoolGolfer } from '@/lib/lineup-builder-types';

interface DraftGolferPanelProps {
  playerPool: PlayerPoolGolfer[];
  selectedGolferIds: string[];
  salaryRemaining: number;
  averageRemainingPerPlayer: number;
  positionsFilled: number;
  rosterSize: number;
  isUnderSalaryCap: boolean;
  onSelectGolfer: (golferId: string) => void;
  onClearLineup?: () => void;
  onSubmitLineup?: () => void;
  canSubmit?: boolean;
  isLocked?: boolean;
  className?: string;
  compactHeader?: boolean;
}

type SortKey = 'salary_desc' | 'salary_asc' | 'name_asc' | 'fppg_desc';

export default function DraftGolferPanel({
  playerPool,
  selectedGolferIds,
  salaryRemaining,
  averageRemainingPerPlayer,
  positionsFilled,
  rosterSize,
  isUnderSalaryCap,
  onSelectGolfer,
  onClearLineup,
  onSubmitLineup,
  canSubmit,
  isLocked = false,
  className,
  compactHeader = false,
}: DraftGolferPanelProps) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('salary_desc');

  const filteredGolfers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? playerPool.filter((golfer) => {
          return golfer.name.toLowerCase().includes(q) || golfer.statusTag?.toLowerCase().includes(q);
        })
      : playerPool;
    return sortPlayerPool(filtered, sortKey);
  }, [playerPool, search, sortKey]);

  return (
    <div className={`flex h-full flex-col bg-[#101116] text-zinc-100 ${className ?? ''}`}>
      <div className={`border-b border-zinc-800 ${compactHeader ? 'px-4 py-3' : 'px-4 py-4'}`}>
        {!compactHeader && <h2 className="text-center text-2xl font-semibold text-zinc-100">Draft Golfer</h2>}
        <div className={`relative ${compactHeader ? '' : 'mt-3'}`}>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search all players"
            autoFocus={false}
            className="h-12 rounded-xl border-zinc-700 bg-zinc-800/80 pl-10 text-base text-zinc-100 placeholder:text-zinc-500"
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={sortKey === 'salary_desc' ? 'default' : 'outline'}
            className={
              sortKey === 'salary_desc'
                ? 'bg-zinc-200 text-zinc-900 hover:bg-zinc-100'
                : 'border-zinc-700 bg-transparent text-zinc-200 hover:bg-zinc-800'
            }
            onClick={() => setSortKey('salary_desc')}
          >
            Salary High-Low
          </Button>
          <Button
            type="button"
            variant={sortKey === 'fppg_desc' ? 'default' : 'outline'}
            className={
              sortKey === 'fppg_desc'
                ? 'bg-zinc-200 text-zinc-900 hover:bg-zinc-100'
                : 'border-zinc-700 bg-transparent text-zinc-200 hover:bg-zinc-800'
            }
            onClick={() => setSortKey('fppg_desc')}
          >
            FPPG High-Low
          </Button>
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto bg-[#16171d] ${onSubmitLineup ? 'pb-44' : 'pb-28'}`}>
        {filteredGolfers.map((golfer) => {
          const isSelected = selectedGolferIds.includes(golfer.golferId);
          const salaryBlocked = !isSelected && golfer.salary > salaryRemaining;
          return (
            <div
              key={golfer.golferId}
              className={`flex items-center gap-3 border-b border-zinc-800 px-3 py-3 text-zinc-900 ${
                salaryBlocked ? 'bg-[#ececec] opacity-70' : 'bg-[#f0f0f0]'
              }`}
            >
              <div className="w-6 text-center text-lg font-bold">G</div>
              <div className="h-16 w-16 overflow-hidden rounded bg-zinc-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={golfer.headshotUrl} alt={golfer.name} className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xl font-semibold leading-tight">{golfer.name}</p>
                <p className="text-xs text-zinc-600">
                  T10s: {golfer.top10s ?? '-'} | CUTS: {golfer.cutsMade ?? '-'}/{golfer.cutsAttempts ?? '-'}
                </p>
                <p className="text-sm text-zinc-700">{golfer.teeTimeDisplay ?? 'TBD'}</p>
                {golfer.statusTag && <Badge className="mt-1 rounded bg-red-700 text-white">{golfer.statusTag}</Badge>}
              </div>
              <div className="min-w-[104px] border-l border-dashed border-zinc-300 pl-3 text-right">
                <p className="text-2xl font-bold">${golfer.salary.toLocaleString()}</p>
                <p className="text-sm text-zinc-700">
                  FPPG <span className="font-semibold">{golfer.fppg?.toFixed(1) ?? '-'}</span>
                </p>
                <p className="text-sm text-zinc-700">
                  AVG <span className="font-semibold">{golfer.avgScore?.toFixed(1) ?? '-'}</span>
                </p>
              </div>
              <div>
                <Button
                  type="button"
                  size="icon"
                  onClick={() => onSelectGolfer(golfer.golferId)}
                  disabled={salaryBlocked}
                  className={
                    isSelected
                      ? 'h-12 w-12 rounded-full bg-zinc-400 text-white hover:bg-zinc-500'
                      : 'h-12 w-12 rounded-full bg-zinc-900 text-white hover:bg-zinc-800'
                  }
                >
                  {isSelected ? <Minus /> : <Plus />}
                </Button>
                {salaryBlocked && <p className="mt-1 w-16 text-center text-[10px] font-semibold text-red-600">OVER CAP</p>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-0 z-20 border-t border-zinc-800 bg-[#1a1a1d] px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-zinc-300">
              Positions Filled:{' '}
              <span className="font-semibold text-emerald-400">
                {positionsFilled}/{rosterSize}
              </span>
            </p>
            <p className="text-zinc-300">
              Under Salary Cap{' '}
              <span className={isUnderSalaryCap ? 'text-emerald-400' : 'text-red-400'}>
                {isUnderSalaryCap ? '✓' : '✕'}
              </span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-zinc-300">
              Rem Salary:{' '}
              <span className={salaryRemaining >= 0 ? 'font-semibold text-emerald-400' : 'font-semibold text-red-400'}>
                ${salaryRemaining.toLocaleString()}
              </span>
            </p>
            <p className="text-zinc-300">
              Avg Rem/Player:{' '}
              <span className="font-semibold text-emerald-400">${averageRemainingPerPlayer.toLocaleString()}</span>
            </p>
          </div>
        </div>
        {onSubmitLineup && onClearLineup && (
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-zinc-700 pt-3">
            <Button
              type="button"
              variant="ghost"
              onClick={onClearLineup}
              disabled={isLocked}
              className="h-11 rounded-xl border border-zinc-700 bg-zinc-900/50 text-zinc-100 hover:bg-zinc-800"
            >
              Clear
            </Button>
            <Button
              type="button"
              onClick={onSubmitLineup}
              disabled={!canSubmit}
              className="h-11 rounded-xl bg-blue-500 text-white hover:bg-blue-400 disabled:bg-zinc-700 disabled:text-zinc-400"
            >
              Submit Lineup
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
