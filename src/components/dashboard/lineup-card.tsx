"use client";

import { User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { LeaderboardPlayer } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';
import { Logo } from '@/components/logo';

interface LineupCardProps {
  player: LeaderboardPlayer;
}

export default function LineupCard({ player }: LineupCardProps) {
  return (
    <Card className="sticky top-20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-headline">
          <User className="h-6 w-6 text-primary" />
          {player.name}'s Lineup
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {player.lineup.map((golfer) => (
            <li key={golfer.id}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Logo className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">{golfer.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge 
                    variant={
                      golfer.thru === "CUT" ? "destructive" : 
                      golfer.thru === "F" ? "secondary" : "outline"
                    }
                  >
                    {golfer.thru}
                  </Badge>
                  <span className={cn(
                    "w-12 text-right font-mono font-semibold",
                    golfer.total < 0 && "text-destructive",
                    golfer.total > 0 && "text-blue-600",
                  )}>
                    {golfer.total > 0 ? `+${golfer.total}` : golfer.total === 0 ? 'E' : golfer.total}
                  </span>
                </div>
              </div>
              <Separator className="mt-4" />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
