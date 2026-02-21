"use client";

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { initialContestData, refreshContestData } from '@/lib/mock-data';
import type { ContestData, LeaderboardPlayer, Player } from '@/lib/types';
import Leaderboard from '@/components/dashboard/leaderboard';
import LineupCard from '@/components/dashboard/lineup-card';
import DashboardHeader from '@/components/dashboard/header';

function calculateUserScore(player: Player): number {
  return player.lineup.reduce((total, golfer) => total + golfer.total, 0);
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const [contestData, setContestData] = useState<ContestData>(initialContestData);
  const [selectedPlayer, setSelectedPlayer] = useState<LeaderboardPlayer | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const currentUserId = searchParams.get('userId');
  
  const leaderboardData = useMemo(() => {
    const playersWithScores = contestData.players.map(player => ({
      ...player,
      totalPoints: calculateUserScore(player),
    }));

    playersWithScores.sort((a, b) => a.totalPoints - b.totalPoints);

    let rank = 1;
    return playersWithScores.map((player, index, allPlayers) => {
      if (index > 0 && player.totalPoints > allPlayers[index - 1].totalPoints) {
        rank = index + 1;
      }
      return { ...player, rank };
    });
  }, [contestData]);

  const currentUser = useMemo(() => 
    leaderboardData.find(p => p.id.toString() === currentUserId),
    [leaderboardData, currentUserId]
  );

  useEffect(() => {
    if (currentUser && !selectedPlayer) {
      setSelectedPlayer(currentUser);
    }
  }, [currentUser, selectedPlayer]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setContestData(prevData => refreshContestData(prevData));
      setIsRefreshing(false);
    }, 500); // Simulate network latency
  };

  return (
    <>
      <DashboardHeader 
        currentUser={currentUser} 
        onRefresh={handleRefresh} 
        isRefreshing={isRefreshing} 
      />
      <main className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Leaderboard 
              players={leaderboardData} 
              onSelectPlayer={setSelectedPlayer}
              selectedPlayerId={selectedPlayer?.id}
              currentUserId={currentUser?.id}
            />
          </div>
          <div className="lg:col-span-1">
            {selectedPlayer && <LineupCard player={selectedPlayer} />}
          </div>
        </div>
      </main>
    </>
  );
}


export default function DashboardPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
