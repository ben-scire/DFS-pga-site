"use client";

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { initialContestData, refreshContestData } from '@/lib/mock-data';
import type { ContestData, LeaderboardPlayer, Player } from '@/lib/types';
import Leaderboard from '@/components/dashboard/leaderboard';
import DashboardHeader from '@/components/dashboard/header';
import ContestHeader from '@/components/dashboard/contest-header';
import LineupCard from '@/components/dashboard/lineup-card';

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
      totalPoints: player.lineup.reduce((acc, g) => acc + g.fantasyPoints, 0),
    }));

    playersWithScores.sort((a, b) => b.totalPoints - a.totalPoints);

    let rank = 1;
    let lastScore = playersWithScores[0]?.totalPoints;
    return playersWithScores.map((player, index) => {
      if (index > 0 && player.totalPoints < lastScore) {
        rank = index + 1;
      }
      lastScore = player.totalPoints;
      return { ...player, rank };
    });
  }, [contestData]);

  const currentUser = useMemo(() => 
    leaderboardData.find(p => p.id.toString() === currentUserId),
    [leaderboardData, currentUserId]
  );

  useEffect(() => {
    if (leaderboardData.length > 0 && !selectedPlayer) {
      const userToSelect = currentUser || leaderboardData[0];
      setSelectedPlayer(userToSelect);
    }
  }, [leaderboardData, currentUser, selectedPlayer]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setContestData(prevData => refreshContestData(prevData));
      setIsRefreshing(false);
    }, 500); // Simulate network latency
  };

  const handleSelectPlayer = (player: LeaderboardPlayer) => {
    setSelectedPlayer(player);
  }

  return (
    <>
      <DashboardHeader 
        currentUser={currentUser} 
        onRefresh={handleRefresh} 
        isRefreshing={isRefreshing} 
      />
      <ContestHeader />
      <main className="flex-1 lg:grid lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Leaderboard 
            players={leaderboardData} 
            onSelectPlayer={handleSelectPlayer}
            selectedPlayerId={selectedPlayer?.id}
            currentUserId={currentUser?.id}
          />
        </div>
         <div className="hidden lg:block lg:col-span-1">
          {selectedPlayer && <LineupCard player={selectedPlayer} />}
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
