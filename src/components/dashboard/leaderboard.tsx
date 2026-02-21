"use client";

import { Circle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { LeaderboardPlayer } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

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
    <div className="space-y-2 bg-background p-2">
      {players.map((player) => (
        <Card
          key={player.id}
          onClick={() => onSelectPlayer(player)}
          className={cn(
            "cursor-pointer overflow-hidden transition-all",
            player.id === selectedPlayerId && "border-accent ring-1 ring-accent"
          )}
        >
          <div className="flex items-center p-2">
            <div className="w-10 text-center text-lg font-bold text-muted-foreground">{player.rank}</div>
            <div className="flex flex-1 items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={`https://i.pravatar.cc/150?u=${player.id}`} alt={player.name} />
                <AvatarFallback>{getInitials(player.name)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-bold">{player.name}</p>
                <p className="text-sm text-muted-foreground">${player.prize.toFixed(2)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold">{player.totalPoints.toFixed(2)}</p>
              <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
                <span>PHR</span>
                <Circle className="h-3 w-3 fill-chart-4 text-chart-4" />
                <span>{player.phr}</span>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
