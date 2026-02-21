"use client";

import { cn } from "@/lib/utils";

interface PhrIndicatorProps {
  className?: string;
}

export default function PhrIndicator({ className }: PhrIndicatorProps) {
  return (
    <span
      aria-hidden
      className={cn("inline-block rounded-full border border-zinc-400", className)}
      style={{
        background:
          "conic-gradient(from 90deg, rgb(250 204 21) 0deg 180deg, rgb(255 255 255) 180deg 360deg)",
      }}
    />
  );
}
