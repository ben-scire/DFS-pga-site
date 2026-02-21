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

## Important Notes

- Since this is static hosting, any secret in `NEXT_PUBLIC_*` is exposed to browsers.
- If your DFS provider requires private credentials, put a secure backend/proxy in front of it and point `NEXT_PUBLIC_DFS_API_BASE_URL` to that proxy.
- Current Next config keeps `typescript.ignoreBuildErrors` and `eslint.ignoreDuringBuilds` enabled; tighten these for stricter CI as needed.
