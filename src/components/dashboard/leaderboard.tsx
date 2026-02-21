"use client";

import { Card } from '@/components/ui/card';
import type { LeaderboardPlayer } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
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
    <div className="space-y-3 bg-[#e9e9e9] p-3 md:p-4">
      {players.map((player) => (
        <Card
          key={player.id}
          onClick={() => onSelectPlayer(player)}
          className={cn(
            "cursor-pointer overflow-hidden rounded-xl border border-zinc-300 bg-[#f8f8f8] shadow-none transition-colors hover:bg-white",
            player.id === selectedPlayerId && "border-[#f97316] bg-[#fff5ed] ring-1 ring-[#f97316]"
          )}
        >
          <div className="flex items-center gap-3 px-3 py-3 md:px-4">
            <div className="w-7 text-center text-2xl font-bold leading-none text-zinc-800">{player.rank}</div>
            <div className="flex flex-1 items-center gap-3">
              <Avatar className="h-11 w-11 border border-zinc-300">
                <AvatarImage src={`https://i.pravatar.cc/150?u=${player.id}`} alt={player.name} />
                <AvatarFallback>{getInitials(player.name)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-lg font-semibold leading-tight text-zinc-900">{player.name}</p>
                <p className="text-base font-semibold text-zinc-500">${player.prize.toFixed(2)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-4xl font-bold leading-none tracking-tight text-zinc-900">{player.totalPoints.toFixed(2)}</p>
              <div className="mt-1 flex items-center justify-end gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">PHR</span>
                <PhrIndicator className="h-3.5 w-3.5" />
                <span className="text-base font-semibold text-zinc-600">{player.phr}</span>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
