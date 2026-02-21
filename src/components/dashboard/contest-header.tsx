"use client";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export default function ContestHeader() {
  return (
    <div className="bg-card px-4 py-3 border-b">
      <div className="flex justify-between items-center mb-2">
        <p className="text-sm font-semibold">
          GENESIS $30 <span className="text-muted-foreground">@DylanGoodnough by dylangoody</span>
        </p>
        <Badge variant="destructive">LIVE</Badge>
      </div>
      <Progress value={50} className="h-1" />
    </div>
  );
}
