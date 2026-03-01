"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { PlayerPoolGolfer } from '@/lib/lineup-builder-types';
import DraftGolferPanel from './draft-golfer-panel';

interface DraftGolferSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerPool: PlayerPoolGolfer[];
  selectedGolferIds: string[];
  salaryRemaining: number;
  averageRemainingPerPlayer: number;
  positionsFilled: number;
  rosterSize: number;
  isUnderSalaryCap: boolean;
  onSelectGolfer: (golferId: string) => void;
  onClearLineup: () => void;
  onSubmitLineup: () => void;
  canSubmit: boolean;
  isLocked: boolean;
}

export default function DraftGolferSheet({
  open,
  onOpenChange,
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
  isLocked,
}: DraftGolferSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="h-[100dvh] w-full max-w-none border-zinc-700 bg-[#101116] p-0 text-zinc-100 sm:max-w-none"
      >
        <div className="flex h-full flex-col lg:hidden">
          <SheetHeader className="border-b border-zinc-800 px-4 py-4 text-left">
            <SheetTitle className="text-center text-2xl font-semibold text-zinc-100">
              Draft Golfer
            </SheetTitle>
          </SheetHeader>
          <DraftGolferPanel
            playerPool={playerPool}
            selectedGolferIds={selectedGolferIds}
            salaryRemaining={salaryRemaining}
            averageRemainingPerPlayer={averageRemainingPerPlayer}
            positionsFilled={positionsFilled}
            rosterSize={rosterSize}
            isUnderSalaryCap={isUnderSalaryCap}
            onSelectGolfer={onSelectGolfer}
            onClearLineup={onClearLineup}
            onSubmitLineup={onSubmitLineup}
            canSubmit={canSubmit}
            isLocked={isLocked}
            compactHeader
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
