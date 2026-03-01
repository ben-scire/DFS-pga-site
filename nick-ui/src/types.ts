export interface StandingsEntry {
  rank: number | null
  entryId: string
  entryName: string
  championshipPoints: number | null
  netDollars: number | null
  weeklyFantasyPointsTotal: number | null
  weeklyWins: number | null
  previousWeekFinish: number | null
  weeksEntered: number | null
}

export interface ScheduleEvent {
  id: number
  name: string
  tier: 'Standard' | 'Signature' | 'Major'
  quarter: number
  isQuarterFinale: boolean
}

export interface WeeklyScoreEntry {
  entryId: string
  entryName: string
  weeklyFantasyPoints: number
}

export interface WeeklyScoreFile {
  eventId: number
  eventName: string
  entries: WeeklyScoreEntry[]
}

export interface RecentWinner {
  week: number
  eventName: string
  winnerName: string
  winnerScore: number
}

export type SortKey = keyof StandingsEntry
export type SortDir = 'asc' | 'desc'
