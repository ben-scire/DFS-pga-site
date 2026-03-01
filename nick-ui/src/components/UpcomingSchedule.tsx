import type { ScheduleEvent } from '../types'

interface Props {
  schedule: ScheduleEvent[]
  lastPlayedEventId: number
}

export default function UpcomingSchedule({ schedule, lastPlayedEventId }: Props) {
  const lastPlayed = schedule.find((e) => e.id === lastPlayedEventId)
  const currentQuarter = lastPlayed?.quarter ?? 1

  const upcoming = schedule.filter(
    (e) => e.quarter === currentQuarter && e.id > lastPlayedEventId,
  )

  return (
    <div className="card">
      <div className="card-header">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-blue, #3b82f6)' }}>
          <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
          <line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" />
          <line x1="3" x2="21" y1="10" y2="10" />
        </svg>
        <h2>Upcoming &middot; Q{currentQuarter}</h2>
      </div>
      <div>
        {upcoming.length === 0 ? (
          <div style={{ padding: '1rem', color: 'var(--text-dim)', textAlign: 'center', fontSize: '0.85rem' }}>
            No upcoming events this quarter
          </div>
        ) : (
          upcoming.map((ev) => (
            <div className="schedule-row" key={ev.id}>
              <span className="schedule-event">
                {ev.name}
                {ev.isQuarterFinale && <span className="schedule-finale">Finale</span>}
              </span>
              <span className={`tier-badge tier-${ev.tier.toLowerCase()}`}>
                {ev.tier}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
