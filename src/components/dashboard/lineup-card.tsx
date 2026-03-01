"use client";

import { ChevronDown } from "lucide-react";
import Image from "next/image";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { LeaderboardPlayer } from "@/lib/types";
import PhrIndicator from "./phr-indicator";

interface LineupCardProps {
  player: LeaderboardPlayer;
}

function abbreviateName(name: string): string {
  const parts = name.split(" ");
  if (parts.length > 1) {
    const lastName = parts.pop();
    const firstNameInitial = parts[0][0];
    return `${firstNameInitial}. ${lastName}`;
  }
  return name;
}

function formatToPar(score: number): string {
  if (score > 0) return `+${score}`;
  if (score === 0) return "E";
  return String(score);
}

function formatOrdinal(rank: number): string {
  const mod10 = rank % 10;
  const mod100 = rank % 100;
  if (mod10 === 1 && mod100 !== 11) return `${rank}st`;
  if (mod10 === 2 && mod100 !== 12) return `${rank}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${rank}rd`;
  return `${rank}th`;
}

function isGolferLive(thru: string): boolean {
  return thru !== "F" && thru !== "CUT" && !thru.includes(":");
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("");
}

export default function LineupCard({ player }: LineupCardProps) {
  if (!player) {
    return (
      <Card className="sticky top-20 rounded-xl border border-zinc-300 bg-[#f2f2f2] shadow-none">
        <CardHeader className="px-4 py-4 text-base font-semibold text-zinc-700">
          Select a player to see their lineup
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="sticky top-20 overflow-hidden rounded-xl border border-zinc-300 bg-[#efefef] shadow-none">
      <CardHeader className="border-b border-zinc-300 bg-[#f8f8f8] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="h-12 w-12 border border-zinc-300">
              <AvatarFallback>{getInitials(player.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-3xl font-extrabold leading-none text-zinc-900">
                {formatOrdinal(player.rank)}{" "}
                <span className="text-2xl font-semibold text-zinc-500">${player.prize.toFixed(0)}</span>
              </p>
              <p className="truncate text-2xl font-semibold leading-tight text-zinc-800">
                {player.name}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-4xl font-extrabold leading-none tracking-tight text-zinc-900">
              {player.totalPoints.toFixed(2)}
            </p>
            <div className="mt-1 flex items-center justify-end gap-1.5">
              <span className="text-sm font-semibold uppercase tracking-wide text-zinc-500">PHR</span>
              <PhrIndicator className="h-4 w-4" />
              <span className="text-2xl font-semibold text-zinc-600">{player.phr}</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-zinc-300">
          {player.lineup.map((golfer) => (
            <li key={golfer.id} className="bg-[#f8f8f8] px-3 py-3">
              <div className="flex items-stretch gap-3">
                <div className="pt-1 text-lg font-semibold text-zinc-700">G</div>
                <div className="flex-shrink-0">
                  <Image
                    src={golfer.imageUrl}
                    alt={golfer.name}
                    width={56}
                    height={56}
                    className="rounded-md border border-zinc-200 bg-white"
                  />
                </div>
                <div className="min-w-0 flex-1 pr-1">
                  <div>
                    <p className="truncate text-[1.35rem] font-semibold leading-tight text-zinc-800">
                      {abbreviateName(golfer.name)}{" "}
                      <span className="text-lg font-normal text-zinc-500">
                        | {golfer.ownership.toFixed(2)}%
                      </span>
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xl font-semibold leading-tight text-zinc-700">
                      <span
                        className={`h-3.5 w-3.5 rounded-full border-2 border-green-700 ${
                          isGolferLive(golfer.thru) ? "animate-pulse bg-green-500" : "bg-transparent"
                        }`}
                      />
                      POS: {golfer.position} ({formatToPar(golfer.total)})
                    </p>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-zinc-500 sm:text-sm">
                    <div>
                      <p className="font-semibold uppercase tracking-wide text-zinc-600">R1</p>
                      <p className="font-medium">{golfer.r1}</p>
                    </div>
                    <div>
                      <p className="font-semibold uppercase tracking-wide text-zinc-600">R2</p>
                      <p className="font-medium">{golfer.r2}</p>
                    </div>
                    <div>
                      <p className="font-semibold uppercase tracking-wide text-zinc-600">R3</p>
                      <p className="font-medium">{golfer.r3}</p>
                    </div>
                  </div>
                </div>
                <div className="ml-1 flex min-w-[96px] flex-col items-end justify-center border-l border-dashed border-zinc-300 pl-3">
                  <p className="text-4xl font-extrabold leading-none tracking-tight text-zinc-900">
                    {golfer.fantasyPoints.toFixed(2)}
                  </p>
                  <ChevronDown className="mt-1 h-5 w-5 text-zinc-400" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
