import { useEffect, useState } from 'react'
import type { StandingsEntry, ScheduleEvent, RecentWinner } from './types'
import StandingsTable from './components/StandingsTable'
import RecentWinners from './components/RecentWinners'
import UpcomingSchedule from './components/UpcomingSchedule'

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '')

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`)
  return res.json()
}

export default function App() {
  const [standings, setStandings] = useState<StandingsEntry[] | null>(null)
  const [schedule, setSchedule] = useState<ScheduleEvent[] | null>(null)
  const [winners, setWinners] = useState<RecentWinner[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetchJson<StandingsEntry[]>('/data/standings-template.json'),
      fetchJson<ScheduleEvent[]>('/data/schedule.json'),
      fetchJson<RecentWinner[]>('/data/recent-winners.json'),
    ])
      .then(([s, sch, w]) => {
        setStandings(s)
        setSchedule(sch)
        setWinners(w)
      })
      .catch((err) => setError(err.message))
  }, [])

  if (error) {
    return (
      <div className="error-state">
        <p>Failed to load data</p>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginTop: '0.5rem' }}>{error}</p>
      </div>
    )
  }

  if (!standings || !schedule || !winners) {
    return (
      <div className="loading-state">
        <span>Loading standings&hellip;</span>
      </div>
    )
  }

  const lastPlayedEventId = winners.length > 0
    ? Math.max(...winners.map((w) => w.week))
    : 0

  return (
    <>
      <header className="page-header">
        <h1>League Standings</h1>
        <p>Fantasy PGA &middot; 2025-26 Season</p>
      </header>

      <main className="dashboard">
        <div className="main-table-wrapper">
          <StandingsTable data={standings} />
        </div>

        <div className="side-panels">
          <RecentWinners winners={winners} />
          <UpcomingSchedule schedule={schedule} lastPlayedEventId={lastPlayedEventId} />
        </div>
      </main>
    </>
  )
}
