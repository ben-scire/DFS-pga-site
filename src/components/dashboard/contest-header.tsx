"use client";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export default function ContestHeader() {
  return (
    <div className="border-b border-zinc-300 bg-[#f3f3f3] px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-bold tracking-tight text-zinc-900">
          GENESIS $30 <span className="font-semibold text-zinc-600">@DylanGoodnough by dylangoody</span>
        </p>
        <Badge variant="destructive" className="rounded-sm bg-red-700 px-1.5 py-0 text-[10px] font-bold tracking-wide">
          LIVE
        </Badge>
      </div>
      <Progress value={50} className="h-2 rounded-full bg-zinc-300" />
    </div>
  );
}
