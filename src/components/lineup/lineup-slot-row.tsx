"use client";

import { ChevronRight, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PlayerPoolGolfer } from '@/lib/lineup-builder-types';

interface LineupSlotRowProps {
  slotIndex: number;
  golfer?: PlayerPoolGolfer;
  onOpenDraft: () => void;
  onRemove?: () => void;
  disabled?: boolean;
}

export default function LineupSlotRow({
  slotIndex,
  golfer,
  onOpenDraft,
  onRemove,
  disabled,
}: LineupSlotRowProps) {
  if (!golfer) {
    return (
      <button
        type="button"
        onClick={onOpenDraft}
        disabled={disabled}
        className="flex w-full items-center gap-2 border-b border-zinc-300 bg-[#f2f2f2] px-3 py-4 text-left disabled:opacity-60 sm:gap-3 sm:px-4 sm:py-6"
      >
        <div className="w-7 text-center text-xl font-bold text-zinc-900 sm:w-8 sm:text-2xl">G</div>
        <div className="flex-1 text-center text-lg font-medium tracking-wide text-zinc-500 sm:text-2xl">
          SELECT GOLFER
        </div>
        <ChevronRight className="h-7 w-7 text-zinc-300 sm:h-8 sm:w-8" />
      </button>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2 border-b border-zinc-300 bg-[#f2f2f2] px-2 py-3 text-zinc-900 sm:gap-3 sm:px-3">
      <div className="w-5 shrink-0 text-center text-lg font-bold sm:w-6 sm:text-xl">G</div>
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-zinc-200 sm:h-16 sm:w-16">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={golfer.headshotUrl} alt={golfer.name} className="h-full w-full object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold sm:text-xl">{golfer.name}</p>
        <p className="hidden text-xs text-zinc-600 sm:block">
          T10s: {golfer.top10s ?? '-'} | CUTS: {golfer.cutsMade ?? '-'}/{golfer.cutsAttempts ?? '-'}
        </p>
        <p className="text-xs text-zinc-700 sm:text-sm">{golfer.teeTimeDisplay ?? 'TBD'}</p>
      </div>
      <div className="w-[88px] shrink-0 border-l border-dashed border-zinc-300 pl-2 text-right sm:w-[116px] sm:pl-3">
        <p className="text-lg font-bold sm:text-2xl">${golfer.salary.toLocaleString()}</p>
        <p className="text-xs text-zinc-700 sm:text-sm">
          FPPG <span className="font-semibold">{golfer.fppg?.toFixed(1) ?? '-'}</span>
        </p>
        <p className="hidden text-xs text-zinc-700 sm:block sm:text-sm">
          AVG <span className="font-semibold">{golfer.avgScore?.toFixed(1) ?? '-'}</span>
        </p>
      </div>
      <Button
        type="button"
        size="icon"
        onClick={onRemove}
        disabled={disabled}
        className="h-9 w-9 shrink-0 rounded-full bg-zinc-300 text-zinc-700 hover:bg-zinc-400 sm:h-11 sm:w-11"
        aria-label={`Remove golfer from slot ${slotIndex + 1}`}
      >
        <Minus />
      </Button>
    </div>
  );
}
