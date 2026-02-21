"use client";

import { Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { LeaderboardPlayer } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

interface LeaderboardProps {
  players: LeaderboardPlayer[];
  onSelectPlayer: (player: LeaderboardPlayer) => void;
  selectedPlayerId?: number;
  currentUserId?: number;
}

export default function Leaderboard({ players, onSelectPlayer, selectedPlayerId, currentUserId }: LeaderboardProps) {
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('');
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-headline">
          <Trophy className="h-6 w-6 text-accent" />
          Live Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-16 text-center">Rank</TableHead>
                <TableHead>Player</TableHead>
                <TableHead className="w-24 text-right">Total Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.map((player) => (
                <TableRow
                  key={player.id}
                  onClick={() => onSelectPlayer(player)}
                  className={cn(
                    "cursor-pointer",
                    player.id === selectedPlayerId && "bg-primary/10",
                    player.id === currentUserId && "border-l-4 border-l-accent"
                  )}
                >
                  <TableCell className="text-center font-bold">{player.rank}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={`https://i.pravatar.cc/150?u=${player.id}`} alt={player.name} />
                        <AvatarFallback>{getInitials(player.name)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{player.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {player.totalPoints > 0 ? `+${player.totalPoints}` : player.totalPoints}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
