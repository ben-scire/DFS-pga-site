import { useState, useMemo } from 'react'
import type { StandingsEntry, SortKey, SortDir } from '../types'

interface Props {
  data: StandingsEntry[]
}

interface ColumnDef {
  key: SortKey
  label: string
  align?: 'left' | 'center' | 'right'
}

const columns: ColumnDef[] = [
  { key: 'rank', label: '#', align: 'center' },
  { key: 'entryName', label: 'Name', align: 'left' },
  { key: 'championshipPoints', label: 'Champ Pts', align: 'right' },
  { key: 'netDollars', label: 'Net $', align: 'right' },
  { key: 'weeklyFantasyPointsTotal', label: 'Fantasy Pts', align: 'right' },
  { key: 'weeklyWins', label: 'Wins', align: 'center' },
  { key: 'previousWeekFinish', label: 'Last Wk', align: 'center' },
  { key: 'weeksEntered', label: 'Wks Played', align: 'center' },
]

function compareValues(a: unknown, b: unknown, dir: SortDir): number {
  const nullA = a === null || a === undefined
  const nullB = b === null || b === undefined
  if (nullA && nullB) return 0
  if (nullA) return 1
  if (nullB) return -1

  if (typeof a === 'string' && typeof b === 'string') {
    const cmp = a.localeCompare(b, undefined, { sensitivity: 'base' })
    return dir === 'asc' ? cmp : -cmp
  }

  const numA = a as number
  const numB = b as number
  return dir === 'asc' ? numA - numB : numB - numA
}

function RankCell({ rank }: { rank: number | null }) {
  if (rank === null) return <span className="rank-other">--</span>
  let cls = 'rank-badge '
  if (rank === 1) cls += 'rank-1'
  else if (rank === 2) cls += 'rank-2'
  else if (rank === 3) cls += 'rank-3'
  else return <span className="rank-other">{rank}</span>
  return <span className={cls}>{rank}</span>
}

function MoneyCell({ value }: { value: number | null }) {
  if (value === null) return <span className="money-zero">--</span>
  if (value > 0) return <span className="money-positive">+${value}</span>
  if (value < 0) return <span className="money-negative">-${Math.abs(value)}</span>
  return <span className="money-zero">$0</span>
}

function PointsCell({ value, max }: { value: number | null; max: number }) {
  if (value === null) return <span style={{ color: 'var(--text-dim)' }}>--</span>
  const ratio = max > 0 ? value / max : 0
  let cls = 'pts-low'
  if (ratio >= 0.8) cls = 'pts-high'
  else if (ratio >= 0.5) cls = 'pts-mid'
  return <span className={cls} style={{ fontWeight: 600 }}>{value}</span>
}

function ChampPtsCell({ value, max }: { value: number | null; max: number }) {
  if (value === null) return <span style={{ color: 'var(--text-dim)' }}>--</span>
  const ratio = max > 0 ? value / max : 0
  const green = Math.round(80 + ratio * 117)
  const color = value === 0 ? 'var(--text-dim)' : `rgb(34, ${green}, 94)`
  return <span style={{ color, fontWeight: 600 }}>{value}</span>
}

function WinsCell({ value }: { value: number | null }) {
  if (value === null) return <span style={{ color: 'var(--text-dim)' }}>--</span>
  if (value >= 1) return <span className="wins-positive">{value}</span>
  return <span style={{ color: 'var(--text-muted)' }}>{value}</span>
}

function LastWeekCell({ finish, rank }: { finish: number | null; rank: number | null }) {
  if (finish === null || rank === null)
    return <span style={{ color: 'var(--text-dim)' }}>--</span>
  const arrow = rank < finish ? '▲' : rank > finish ? '▼' : '–'
  const cls = rank < finish ? 'finish-up' : rank > finish ? 'finish-down' : 'finish-same'
  return (
    <span className={cls} style={{ fontWeight: 600 }}>
      {finish} {arrow}
    </span>
  )
}

function WeeksCell({ value, avg }: { value: number | null; avg: number }) {
  if (value === null) return <span style={{ color: 'var(--text-dim)' }}>--</span>
  const dim = value < avg
  return <span style={{ color: dim ? 'var(--text-dim)' : 'var(--text)', fontWeight: dim ? 400 : 600 }}>{value}</span>
}

export default function StandingsTable({ data }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('rank')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const maxFP = useMemo(
    () => Math.max(...data.map((e) => e.weeklyFantasyPointsTotal ?? 0)),
    [data],
  )
  const maxChamp = useMemo(
    () => Math.max(...data.map((e) => e.championshipPoints ?? 0)),
    [data],
  )
  const avgWeeks = useMemo(() => {
    const active = data.filter((e) => e.weeksEntered !== null)
    if (active.length === 0) return 0
    return active.reduce((s, e) => s + (e.weeksEntered ?? 0), 0) / active.length
  }, [data])

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => compareValues(a[sortKey], b[sortKey], sortDir))
  }, [data, sortKey, sortDir])

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'entryName' ? 'asc' : 'asc')
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--gold)' }}>
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
          <path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
        </svg>
        <h2>League Standings</h2>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`sortable ${sortKey === col.key ? 'sort-active' : ''}`}
                  style={{ textAlign: col.align }}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span className="sort-arrow">{sortDir === 'asc' ? '▲' : '▼'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((entry) => {
              const isInactive = entry.rank === null
              return (
                <tr key={entry.entryId} className={isInactive ? 'entry-inactive' : ''}>
                  <td style={{ textAlign: 'center' }}>
                    <RankCell rank={entry.rank} />
                  </td>
                  <td style={{ fontWeight: 600 }}>{entry.entryName}</td>
                  <td style={{ textAlign: 'right' }}>
                    <ChampPtsCell value={entry.championshipPoints} max={maxChamp} />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <MoneyCell value={entry.netDollars} />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <PointsCell value={entry.weeklyFantasyPointsTotal} max={maxFP} />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <WinsCell value={entry.weeklyWins} />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <LastWeekCell finish={entry.previousWeekFinish} rank={entry.rank} />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <WeeksCell value={entry.weeksEntered} avg={avgWeeks} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
