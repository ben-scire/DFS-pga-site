"use client";

import Link from 'next/link';
import { LogOut, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/logo';
import { LeaderboardPlayer } from '@/lib/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';


interface DashboardHeaderProps {
  currentUser?: LeaderboardPlayer;
  onRefresh: () => void;
  isRefreshing: boolean;
  lastUpdatedAt?: Date | null;
  refreshError?: string | null;
  isStreamConnected?: boolean;
}

export default function DashboardHeader({
  currentUser,
  onRefresh,
  isRefreshing,
  lastUpdatedAt,
  refreshError,
  isStreamConnected,
}: DashboardHeaderProps) {
  const getInitials = (name: string = '') => {
    return name.split(' ').map(n => n[0]).join('');
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
      <Link href="/dashboard" className="flex items-center gap-2">
        <Logo className="h-7 w-7 text-primary" />
        <span className="hidden text-xl font-semibold tracking-tight font-headline sm:inline-block">
          PGA Contest Tracker
        </span>
      </Link>
      <div className="flex items-center gap-4">
        <div className="hidden md:block text-right text-xs text-muted-foreground">
          {refreshError ? (
            <p className="text-destructive">{refreshError}</p>
          ) : isStreamConnected ? (
            <p className="text-green-600">Live stream connected</p>
          ) : (
            <p>
              {lastUpdatedAt
                ? `Updated ${lastUpdatedAt.toLocaleTimeString()}`
                : 'Waiting for first data sync'}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCcw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="h-9 w-9">
                <AvatarImage src={`https://i.pravatar.cc/150?u=${currentUser?.id}`} alt={currentUser?.name} />
                <AvatarFallback>{getInitials(currentUser?.name)}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{currentUser?.name}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  Rank: {currentUser?.rank} | Points: {currentUser?.totalPoints}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <Link href="/">
              <DropdownMenuItem>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </Link>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
