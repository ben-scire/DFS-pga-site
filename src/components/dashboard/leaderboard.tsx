"use client";

import { Card } from '@/components/ui/card';
import type { LeaderboardPlayer } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '../ui/avatar';
import PhrIndicator from './phr-indicator';

interface LeaderboardProps {
  players: LeaderboardPlayer[];
  onSelectPlayer: (player: LeaderboardPlayer) => void;
  selectedPlayerId?: number;
  currentUserId?: number;
}

export default function Leaderboard({ players, onSelectPlayer, selectedPlayerId }: LeaderboardProps) {
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('');
  }
  
  return (
    <div className="space-y-3 bg-[#ececec] p-3 md:p-4">
      {players.map((player) => (
        <Card
          key={player.id}
          onClick={() => onSelectPlayer(player)}
          className={cn(
            "cursor-pointer overflow-hidden rounded-2xl border border-[#d9d9d9] bg-[#f7f7f7] shadow-none transition-colors hover:bg-white",
            player.id === selectedPlayerId && "border-[#f97316] bg-[#fef1e8] ring-1 ring-[#f97316]"
          )}
        >
          <div className="flex items-center gap-3 px-3 py-3 md:px-4">
            <div className={cn(
              "h-14 w-1.5 rounded-full bg-[#d8d8d8]",
              player.id === selectedPlayerId && "bg-[#f97316]"
            )} />
            <div className="w-7 text-center text-3xl font-extrabold leading-none text-zinc-800">{player.rank}</div>
            <div className="flex flex-1 items-center gap-3">
              <Avatar className="h-12 w-12 border border-zinc-300">
                <AvatarFallback>{getInitials(player.name)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-lg font-semibold leading-tight text-zinc-900 md:text-xl">{player.name}</p>
                <p className="mt-0.5 text-lg font-semibold leading-tight text-zinc-500 md:text-xl">${player.prize.toFixed(2)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold leading-none tracking-tight text-zinc-900 md:text-4xl">{player.totalPoints.toFixed(2)}</p>
              <div className="mt-1 flex items-center justify-end gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 md:text-sm">PHR</span>
                <PhrIndicator className="h-4 w-4" />
                <span className="text-base font-semibold text-zinc-600 md:text-lg">{player.phr}</span>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
