"use client";

import { User } from 'lucide-react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { LeaderboardPlayer } from '@/lib/types';

interface LineupCardProps {
  player: LeaderboardPlayer;
}

function abbreviateName(name: string): string {
    const parts = name.split(' ');
    if (parts.length > 1) {
        const lastName = parts.pop();
        const firstNameInitial = parts[0][0];
        return `${firstNameInitial}. ${lastName}`;
    }
    return name;
}

function formatToPar(score: number): string {
    if (score > 0) return `+${score}`;
    if (score === 0) return 'E';
    return String(score);
}

export default function LineupCard({ player }: LineupCardProps) {
  if (!player) {
    return (
      <Card className="sticky top-20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-headline">Select a player to see their lineup</CardTitle>
        </CardHeader>
      </Card>
    )
  }
  return (
    <Card className="sticky top-20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-headline">
          <User className="h-6 w-6 text-primary" />
          {player.name}'s Lineup
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <ul className="space-y-0 divide-y divide-border">
          {player.lineup.map((golfer) => (
            <li key={golfer.id} className="py-4">
              <div className="flex items-start gap-3">
                <div className="w-4 pt-1 text-center text-sm font-bold text-muted-foreground">G</div>
                <div className="flex-shrink-0">
                  <Image
                    src={golfer.imageUrl}
                    alt={golfer.name}
                    width={48}
                    height={48}
                    className="rounded-full bg-muted"
                  />
                </div>
                <div className="flex-grow">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{abbreviateName(golfer.name)} <span className="text-sm text-muted-foreground font-normal">| {golfer.ownership.toFixed(2)}%</span></p>
                      <p className="text-sm text-green-600 flex items-center gap-1.5 mt-1">
                        {golfer.thru !== 'F' && golfer.thru !== 'CUT' && <span className="h-2 w-2 rounded-full bg-green-600 animate-pulse"></span>}
                        POS: {golfer.position} ({formatToPar(golfer.total)})
                      </p>
                    </div>
                    <p className="font-bold text-lg">{golfer.fantasyPoints.toFixed(2)}</p>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground sm:text-sm">
                    <div>
                      <p className="text-gray-400 font-medium">R1</p>
                      <p className="font-mono">{golfer.r1}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 font-medium">R2</p>
                      <p className="font-mono">{golfer.r2}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 font-medium">R3</p>
                      <p className="font-mono">{golfer.r3}</p>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
