export interface Golfer {
  id: number;
  name: string;
  total: number; // Total score to par for the tournament
  thru: string; // e.g., "14", "F" (Finished), "CUT"
  position: string;
  fantasyPoints: number;
  ownership: number;
  imageUrl: string;
  r1: string;
  r2: string;
  r3: string;
}

export interface Player {
  id: number;
  name: string;
  lineup: Golfer[];
}

export interface ContestData {
  players: Player[];
  golfers: Golfer[];
}

export interface LeaderboardPlayer extends Player {
  totalPoints: number;
  rank: number;
}
