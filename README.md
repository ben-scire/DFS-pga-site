# PGA DFS Contest Tracker

Next.js app for tracking a private PGA DFS contest with:
- Player selection login screen
- Live leaderboard with rank/points/prize context
- Lineup detail view per entry
- Manual refresh + automatic polling for live scoring

The project started as a Firebase Studio scaffold and is now configured for static deployment on GitHub Pages.

## Tech Stack

- Next.js 15 (App Router)
- React 19 + TypeScript
- Tailwind CSS
- shadcn/ui
- Lucide icons

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Create local environment file:
```bash
cp .env.example .env.local
```

3. Run development server:
```bash
npm run dev
```

4. Open [http://localhost:9002](http://localhost:9002).

## Environment Variables

All runtime config is client-visible (`NEXT_PUBLIC_*`) because this app is statically deployed.

- `NEXT_PUBLIC_DFS_API_BASE_URL`: DFS API host, e.g. `https://api.example.com`
- `NEXT_PUBLIC_DFS_CONTEST_ID`: Contest identifier used in URL templating
- `NEXT_PUBLIC_DFS_API_PATH`: Path template, default `/contests/{contestId}/live`
- `NEXT_PUBLIC_DFS_STREAM_PATH`: Optional SSE path template, default `/contests/{contestId}/stream`
- `NEXT_PUBLIC_DFS_API_KEY`: Optional API key
- `NEXT_PUBLIC_DFS_API_KEY_HEADER`: Header name for key, default `x-api-key`
- `NEXT_PUBLIC_DFS_REFRESH_MS`: Poll interval in milliseconds, default `60000`
- `NEXT_PUBLIC_USE_MOCK_FALLBACK`: `true/false`; if true, mock data is used when live config/fetch fails

Additional local/admin script env vars:
- `DATAGOLF_LIVE_URL`: Full Data Golf live endpoint URL for polling (supports `{key}` placeholder)
- `DATAGOLF_API_KEY`: Optional API key substituted into `DATAGOLF_LIVE_URL`
- `DATAGOLF_POLL_INTERVAL_MS`: Poll interval for Data Golf sync script (default `3600000`, one hour)
- `DATAGOLF_SCORING_MODE`: `dfs-rules` only (default `dfs-rules`)
- `FIREBASE_SERVICE_ACCOUNT_JSON` or `GOOGLE_APPLICATION_CREDENTIALS`: Required for server-side writes to `test_scores`

## DFS API Response Contract

The app normalizes several common response shapes. Preferred payload:

```json
{
  "golfers": [
    {
      "id": 46046,
      "name": "Scottie Scheffler",
      "total": -8,
      "thru": "16",
      "position": "1",
      "fantasyPoints": 103.5,
      "ownership": 24.1,
      "imageUrl": "https://...",
      "rounds": { "r1": "66(-6)", "r2": "68(-4)", "r3": "E thru 16" }
    }
  ],
  "players": [
    {
      "id": 1,
      "name": "Alice",
      "prize": 125.0,
      "phr": 216,
      "lineupGolferIds": [46046]
    }
  ]
}
```

Also supported:
- `entries` instead of `players`
- `leaderboard` instead of `players`
- `playersPool` or `athletes` instead of `golfers`
- `points` / `dkPoints` for golfer points
- `entryId` / `entryName` for player id/name

If your provider format differs, update the normalizer in:
- `src/lib/dfs-api.ts`

## Live Streaming Mode (SSE)

For true live push updates, expose an SSE endpoint and set `NEXT_PUBLIC_DFS_STREAM_PATH`.

- Endpoint must emit JSON events in `event.data`.
- Payload can be either direct contest JSON or wrapped:
  - Direct: `{ "golfers": [...], "players": [...] }`
  - Wrapped: `{ "contestData": { "golfers": [...], "players": [...] } }`
- When SSE is connected, the dashboard uses stream updates and polling becomes fallback only.
- On disconnect, the app retries SSE every 5 seconds.

## Weekly Contest Ops (CSV + Data Golf)

The public site is a static GitHub Pages build. It updates live because the browser reads Firestore; the score updater must run separately on your Mac mini or in Google Cloud.

### 1. Import DraftKings standings CSV into test users (`test_lineups`)

This populates the approved test-user lineup docs from a DK contest standings export (the CSV with `Rank,EntryId,EntryName,...`).

Dry run:

```bash
npm run import:standings -- --csv /absolute/path/to/contest-standings.csv
```

Write to Firestore:

```bash
npm run import:standings -- --csv /absolute/path/to/contest-standings.csv --write
```

If DK entry names do not match your test-user slugs, add overrides:

```bash
npm run import:standings -- --csv /absolute/path/to/contest-standings.csv --map cm30=coach --map capc=ceec --write
```

Notes:
- This writes `test_lineups/{contestId}/entries/{userSlug}`.
- It uses the seeded contest player pool to convert lineup names into `lineupGolferIds`.
- If the standings CSV includes `Points`/`FPTS`, it also writes `officialWeeklyFantasyPoints`.
- `league-scoring/update_league_standings.py` will prefer that official value over computed live-score sums.
- By default it runs in dry-run mode and prints unresolved entries.

### 2. Poll Data Golf and write live golfer stats (`test_scores`)

The live lineup page already reads Firestore `test_scores`. This script fills those docs by polling a Data Golf endpoint and matching golfers by name.

Dry run (no Firestore writes):

```bash
npm run sync:datagolf:scores -- --once --dry-run --url "https://feeds.datagolf.com/preds/live-hole-scores?tour=pga&file_format=json&key={key}"
```

One sync pass (writes Firestore, requires Admin credentials):

```bash
npm run sync:datagolf:scores:once
```

Continuous hourly polling (writes Firestore, requires Admin credentials):

```bash
npm run sync:datagolf:scores
```

Notes:
- Supports JSON or CSV responses and normalizes common field names (`player_name`, `position`, `thru`, `score_to_par`, etc.).
- For true per-player DFS scoring, use Data Golf `preds/live-hole-scores` (not `preds/live-hole-stats`, which is wave-level aggregate data).
- Computes fantasy points from DFS PGA scoring rules in `dfs-rules` mode:
  - Double Eagle `+13`, Eagle `+8`, Birdie `+3`, Par `+0.5`, Bogey `-0.5`, Double Bogey or Worse `-1`
  - Hole in One `+5`, 3-Birdie Streak `+3`, Bogey-Free Round `+3`, All Rounds Under 70 `+5`
  - Finishing position points: `1st=30`, `2nd=20`, `3rd=18`, `4th=16`, `5th=14`, `6th=12`, `7th=10`, `8th=9`, `9th=8`, `10th=7`, `11-15=6`, `16-20=5`, `21-25=4`, `26-30=3`, `31-40=2`, `41-50=1`
  - Output points are rounded to `.0` / `.5`.
- Writes to `test_scores/{contestId}/golfers/{golferId}` with `updatedAt` server timestamps.
- `fantasyPoints` source is locked to strict `dfs-rules` computation.
- Manual admin override is supported and survives sync when you lock a golfer doc:
  - Set `finalScoreLocked: true`
  - Set `manualFantasyPoints: 75.5` (or your desired value)
  - Keep `updatedBySlug` as an admin slug (for example: `bscire`)
  - When locked, the sync job preserves the locked score and marks `scoringSource` as `manual-lock`.

### 3. Production sync for deployed site (Cloud Run Job + Scheduler)

The deployed static site updates live by listening to Firestore. To keep Firestore fresh, run the sync worker on Google Cloud:

```bash
cd /Users/nick/Cursor-Projects/DFS-pga-site
export DATAGOLF_API_KEY="your-datagolf-key"
export PROJECT_ID="studio-5115982885-551c8"
export REGION="us-central1"
export DATAGOLF_CONTEST_ID="week-11-truist"
./scripts/deploy-datagolf-sync-cloud-run.sh
```

What this sets up:
- Builds `Dockerfile.datagolf-sync` and pushes image to Artifact Registry
- Deploys Cloud Run Job `datagolf-live-sync` (runs one sync pass)
- Stores API key in Secret Manager (`datagolf-api-key`)
- Creates Cloud Scheduler job `datagolf-live-sync-hourly` to trigger one sync pass every hour

You can override defaults with env vars before running the script:
- `TOUR` (default `pga`)
- `SCORING_MODE` (default `dfs-rules`)
- `TIME_ZONE` (default `America/New_York`)
- `DATAGOLF_CONTEST_ID` (default `week-11-truist`; set this each week)
- `DATAGOLF_LIVE_URL` (default uses `preds/live-hole-scores`)

## Live Site Weekly Runbook

### Public links

- `/week-standings`: live weekly leaderboard.
- `/live-lineup?contestId=<contestId>&userId=<entryId>`: golfer-level lineup detail. The standings page links to this automatically.
- `/season`: season and quarter standings.
- `/scoring-rules`: scoring matrix and payout rules.

### One-time setup

1. Enable GitHub Pages with source `GitHub Actions`.
2. Add the `NEXT_PUBLIC_FIREBASE_*` repository secrets used by `.github/workflows/deploy-pages.yml`.
3. Deploy `firestore.test-week.rules` so browsers can read the current contest's `test_lineups` and `test_scores`.
4. Keep server-side credentials local or in Google Cloud only: `GOOGLE_APPLICATION_CREDENTIALS` or `FIREBASE_SERVICE_ACCOUNT_JSON`.
5. Keep `DATAGOLF_API_KEY` out of `NEXT_PUBLIC_*` variables.

### Mac mini learning path

1. Run the site locally:
   ```bash
   npm run dev
   ```
2. Open `http://localhost:9002/week-standings`.
3. Run a dry run:
   ```bash
   npm run sync:datagolf:scores:once -- --dry-run
   ```
4. Run one write pass:
   ```bash
   npm run sync:datagolf:scores:once
   ```
5. Confirm `/week-standings` updates, then click an entry to confirm golfer scores on `/live-lineup`.
6. If you want a Mac mini fallback scheduler, point `launchd` at:
   ```bash
   /usr/bin/env bash -lc 'cd /Users/nick/Cursor-Projects/DFS-pga-site && npm run sync:datagolf:scores:once'
   ```
   Set the interval to `3600` seconds.

### Weekly checklist

Before lock:

1. Set the current contest in `src/lib/weekly-lineup-seed.ts` to `status: 'live'`.
2. Confirm that contest's player pool is available through `getDefaultPlayerPool(contestId)`.
3. Import or verify lineups:
   ```bash
   npm run import:standings -- --csv /absolute/path/to/contest-standings.csv --write
   ```
4. Confirm `firestore.test-week.rules` allows the current `contestId`.
5. Run a Data Golf dry run:
   ```bash
   npm run sync:datagolf:scores:once -- --contest-id <contestId> --dry-run
   ```
6. Push to `main` so GitHub Pages redeploys.

During the event:

1. Let the hourly sync update `test_scores/{contestId}/golfers`.
2. Check `/week-standings` for ranks and updated time.
3. Click entries to verify golfer-level scores.
4. If scores look wrong, check unmatched golfer names in the sync output first.

After the event:

1. Finalize the weekly JSON and standings:
   ```bash
   cd league-scoring
   python3 update_league_standings.py --contest-id <contestId>
   ```
2. Review generated weekly, quarter, and season standings files.
3. Commit and push the standings files.
4. Move the contest out of `live` status and prepare the next week.

## Project Structure

- `src/app/page.tsx`: Login/entry selection
- `src/app/dashboard/page.tsx`: Main live dashboard state + polling
- `src/components/dashboard/`: Header, leaderboard, lineup, contest summary UI
- `src/lib/dfs-api.ts`: API config, fetch, normalization, fallback logic
- `src/lib/mock-data.ts`: Local fallback dataset
- `src/lib/types.ts`: Core app types
- `.github/workflows/deploy-pages.yml`: GitHub Pages CI/CD workflow

## GitHub Pages Deployment

This repo is configured for static export (`output: 'export'`) with automatic base path handling in CI.

### One-time GitHub setup

1. In repository settings, enable **Pages** with source **GitHub Actions**.
2. Add repository secrets if using live API:
   - `NEXT_PUBLIC_DFS_API_BASE_URL`
   - `NEXT_PUBLIC_DFS_CONTEST_ID`
   - `NEXT_PUBLIC_DFS_API_PATH` (optional)
   - `NEXT_PUBLIC_DFS_STREAM_PATH` (optional)
   - `NEXT_PUBLIC_DFS_API_KEY` (optional)
   - `NEXT_PUBLIC_DFS_API_KEY_HEADER` (optional)
   - `NEXT_PUBLIC_DFS_REFRESH_MS` (optional)
   - `NEXT_PUBLIC_USE_MOCK_FALLBACK` (optional)

### Deploy

- Push to `main` to trigger `.github/workflows/deploy-pages.yml`.
- Workflow runs `npm run build:pages` and deploys `out/` to Pages.
- Workflow includes auto-enable for Pages (`enablement: true`) to reduce first-run setup failures.

## Important Notes

- Since this is static hosting, any secret in `NEXT_PUBLIC_*` is exposed to browsers.
- If your DFS provider requires private credentials, put a secure backend/proxy in front of it and point `NEXT_PUBLIC_DFS_API_BASE_URL` to that proxy.
- Current Next config keeps `typescript.ignoreBuildErrors` and `eslint.ignoreDuringBuilds` enabled; tighten these for stricter CI as needed.
