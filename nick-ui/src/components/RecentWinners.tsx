import type { RecentWinner } from '../types'

interface Props {
  winners: RecentWinner[]
}

export default function RecentWinners({ winners }: Props) {
  const display = winners.slice(-5).reverse()

  return (
    <div className="card">
      <div className="card-header">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--gold)' }}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
        <h2>Recent Winners</h2>
      </div>
      <div>
        {display.length === 0 ? (
          <div style={{ padding: '1rem', color: 'var(--text-dim)', textAlign: 'center', fontSize: '0.85rem' }}>
            No results yet
          </div>
        ) : (
          display.map((w) => (
            <div className="winner-row" key={w.week}>
              <span className="winner-week">Wk {w.week}</span>
              <span className="winner-event">{w.eventName}</span>
              <span className="winner-name">{w.winnerName}</span>
              <span className="winner-score">{w.winnerScore} pts</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
