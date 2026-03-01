/**
 * Reads all weekly-scores JSON files from league-scoring/weekly-scores/
 * and produces data/recent-winners.json plus copies standings + schedule
 * into the data/ output folder so the built site can fetch them.
 *
 * Usage:  node build-data.js [--out-dir <path>]
 * Defaults to ./public/data  (Vite serves public/ during dev)
 */

import { readdirSync, readFileSync, mkdirSync, writeFileSync, copyFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const args = process.argv.slice(2)
const outIdx = args.indexOf('--out-dir')
const outDir = outIdx !== -1 ? resolve(args[outIdx + 1]) : resolve('public', 'data')

const leagueDir = resolve('..', 'league-scoring')
const weeklyDir = join(leagueDir, 'weekly-scores')

mkdirSync(outDir, { recursive: true })

// Copy standings + schedule
copyFileSync(join(leagueDir, 'standings-template.json'), join(outDir, 'standings-template.json'))
copyFileSync(join(leagueDir, 'schedule.json'), join(outDir, 'schedule.json'))

// Aggregate weekly winners
const weekFiles = readdirSync(weeklyDir).filter((f) => f.endsWith('.json')).sort()
const winners = []

for (const file of weekFiles) {
  const raw = readFileSync(join(weeklyDir, file), 'utf-8')
  const data = JSON.parse(raw)
  if (data.entries && data.entries.length > 0) {
    const top = data.entries[0]
    winners.push({
      week: data.eventId,
      eventName: data.eventName,
      winnerName: top.entryName,
      winnerScore: top.weeklyFantasyPoints,
    })
  }
}

winners.sort((a, b) => a.week - b.week)
writeFileSync(join(outDir, 'recent-winners.json'), JSON.stringify(winners, null, 2))

console.log(`[build-data] Wrote ${winners.length} winner(s) to ${join(outDir, 'recent-winners.json')}`)
console.log(`[build-data] Copied standings + schedule to ${outDir}`)
