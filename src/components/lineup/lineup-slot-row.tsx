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
        className="flex w-full items-center gap-3 border-b border-zinc-300 bg-[#f2f2f2] px-4 py-6 text-left disabled:opacity-60"
      >
        <div className="w-8 text-center text-2xl font-bold text-zinc-900">G</div>
        <div className="flex-1 text-center text-2xl font-medium tracking-wide text-zinc-500">
          SELECT GOLFER
        </div>
        <ChevronRight className="h-8 w-8 text-zinc-300" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 border-b border-zinc-300 bg-[#f2f2f2] px-3 py-3 text-zinc-900">
      <div className="w-6 text-center text-xl font-bold">G</div>
      <div className="h-16 w-16 overflow-hidden rounded bg-zinc-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={golfer.headshotUrl} alt={golfer.name} className="h-full w-full object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xl font-semibold">{golfer.name}</p>
        <p className="text-xs text-zinc-600">
          T10s: {golfer.top10s ?? '-'} | CUTS: {golfer.cutsMade ?? '-'}/{golfer.cutsAttempts ?? '-'}
        </p>
        <p className="text-sm text-zinc-700">{golfer.teeTimeDisplay ?? 'TBD'}</p>
      </div>
      <div className="min-w-[116px] border-l border-dashed border-zinc-300 pl-3 text-right">
        <p className="text-2xl font-bold">${golfer.salary.toLocaleString()}</p>
        <p className="text-sm text-zinc-700">
          FPPG <span className="font-semibold">{golfer.fppg?.toFixed(1) ?? '-'}</span>
        </p>
        <p className="text-sm text-zinc-700">
          AVG <span className="font-semibold">{golfer.avgScore?.toFixed(1) ?? '-'}</span>
        </p>
      </div>
      <Button
        type="button"
        size="icon"
        onClick={onRemove}
        disabled={disabled}
        className="h-11 w-11 rounded-full bg-zinc-300 text-zinc-700 hover:bg-zinc-400"
        aria-label={`Remove golfer from slot ${slotIndex + 1}`}
      >
        <Minus />
      </Button>
    </div>
  );
}
