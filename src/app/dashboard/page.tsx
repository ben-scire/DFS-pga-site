"use client";

import React, { useState, useEffect, useMemo, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { initialContestData } from '@/lib/mock-data';
import {
  getContestData,
  getContestStreamUrl,
  getDfsApiConfig,
  normalizeContestPayload,
} from '@/lib/dfs-api';
import type { ContestData, LeaderboardPlayer } from '@/lib/types';
import Leaderboard from '@/components/dashboard/leaderboard';
import DashboardHeader from '@/components/dashboard/header';
import ContestHeader from '@/components/dashboard/contest-header';
import LineupCard from '@/components/dashboard/lineup-card';

function DashboardContent() {
  const searchParams = useSearchParams();
  const [contestData, setContestData] = useState<ContestData>(initialContestData);
  const [selectedPlayer, setSelectedPlayer] = useState<LeaderboardPlayer | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isStreamConnected, setIsStreamConnected] = useState(false);
  const [streamAttempt, setStreamAttempt] = useState(0);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const refreshIntervalMs = getDfsApiConfig().refreshIntervalMs;

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

  useEffect(() => {
    if (!selectedPlayer) return;
    const updatedSelected = leaderboardData.find((player) => player.id === selectedPlayer.id);
    if (updatedSelected) {
      setSelectedPlayer(updatedSelected);
    }
  }, [leaderboardData, selectedPlayer]);

  const syncContestData = useCallback(async () => {
    setIsRefreshing(true);
    setRefreshError(null);
    try {
      const data = await getContestData();
      setContestData(data);
      setLastUpdatedAt(new Date());
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : 'Refresh failed');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void syncContestData();
  }, [syncContestData]);

  useEffect(() => {
    if (isStreamConnected) return;
    const timerId = window.setInterval(() => {
      void syncContestData();
    }, refreshIntervalMs);

    return () => window.clearInterval(timerId);
  }, [isStreamConnected, refreshIntervalMs, syncContestData]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('EventSource' in window)) return;
    const streamUrl = getContestStreamUrl();
    if (!streamUrl) return;

    const stream = new EventSource(streamUrl);
    let retryTimerId: number | undefined;

    stream.onopen = () => {
      setIsStreamConnected(true);
      setRefreshError(null);
    };

    stream.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as unknown;
        const wrappedPayload =
          payload && typeof payload === 'object' && !Array.isArray(payload)
            ? (payload as Record<string, unknown>)
            : null;
        const normalized = normalizeContestPayload(wrappedPayload?.contestData ?? payload);
        setContestData(normalized);
        setLastUpdatedAt(new Date());
      } catch (error) {
        setRefreshError(error instanceof Error ? error.message : 'Invalid stream payload');
      }
    };

    stream.onerror = () => {
      setIsStreamConnected(false);
      stream.close();
      retryTimerId = window.setTimeout(() => {
        setStreamAttempt((current) => current + 1);
      }, 5_000);
    };

    return () => {
      setIsStreamConnected(false);
      stream.close();
      if (retryTimerId) {
        window.clearTimeout(retryTimerId);
      }
    };
  }, [streamAttempt]);

  const handleRefresh = () => {
    void syncContestData();
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
        lastUpdatedAt={lastUpdatedAt}
        refreshError={refreshError}
        isStreamConnected={isStreamConnected}
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
         <div className="lg:col-span-1">
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
