"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getContestData } from '@/lib/dfs-api';
import { initialContestData } from '@/lib/mock-data';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Logo } from '@/components/logo';
import { Users } from 'lucide-react';
import type { Player } from '@/lib/types';

export default function LoginPage() {
  const router = useRouter();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>(initialContestData.players);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const loginImage = PlaceHolderImages.find(img => img.id === 'golf-course');

  useEffect(() => {
    let mounted = true;
    const loadPlayers = async () => {
      setLoadingPlayers(true);
      setLoadingError(null);
      try {
        const data = await getContestData();
        if (mounted && data.players.length) {
          setPlayers(data.players);
        }
      } catch (error) {
        if (mounted) {
          setLoadingError(error instanceof Error ? error.message : 'Could not load contest players');
        }
      } finally {
        if (mounted) {
          setLoadingPlayers(false);
        }
      }
    };

    void loadPlayers();
    return () => {
      mounted = false;
    };
  }, []);

  const handleLogin = () => {
    if (selectedUserId) {
      router.push(`/dashboard?userId=${selectedUserId}`);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center p-4">
      {loginImage && (
        <Image
          src={loginImage.imageUrl}
          alt={loginImage.description}
          fill
          className="object-cover -z-10 brightness-[0.4]"
          priority
          data-ai-hint={loginImage.imageHint}
        />
      )}
      <Card className="w-full max-w-md bg-background/80 backdrop-blur-sm">
        <CardHeader className="items-center text-center">
          <Logo className="h-16 w-16 text-primary" />
          <CardTitle className="text-3xl font-headline">5x5 Global</CardTitle>
          <CardDescription>Select your name to view the live leaderboard.</CardDescription>
          {loadingError && <p className="text-xs text-destructive">{loadingError}</p>}
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col space-y-1.5">
              <Select onValueChange={setSelectedUserId}>
                <SelectTrigger id="user-select" className="w-full">
                  <SelectValue placeholder={loadingPlayers ? 'Loading users...' : 'Select a user...'} />
                </SelectTrigger>
                <SelectContent position="popper">
                  {players.map((player) => (
                    <SelectItem key={player.id} value={String(player.id)}>
                      {player.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleLogin} disabled={!selectedUserId || loadingPlayers} className="w-full">
            <Users className="mr-2 h-4 w-4" /> View Leaderboard
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
