# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

PGA DFS Contest Tracker ("5x5 Global") — a Next.js 15 static-export web app for tracking a private PGA fantasy golf contest. See `README.md` for full details.

### Services

| Service | Command | Port | Notes |
|---|---|---|---|
| Next.js dev server | `npm run dev` | 9002 | Core app; uses Turbopack |

### Development commands

Standard commands in `package.json`:

- **Dev server**: `npm run dev` (port 9002, Turbopack)
- **Lint**: `npm run lint` (requires ESLint — see caveat below)
- **Typecheck**: `npm run typecheck` (`tsc --noEmit`)
- **Build**: `npm run build` (static export to `out/`)

### Non-obvious caveats

- **ESLint not bundled in repo**: The repo ships without `eslint` or an ESLint config file. `npm run lint` (`next lint`) will fail interactively without them. To make it work, install `eslint@^8` and `eslint-config-next@15.5.9` as dev dependencies and create `.eslintrc.json` with `{"extends":"next/core-web-vitals"}`. The matching eslint-config-next version (15.x) is important — v16 requires ESLint 9 which triggers a circular-reference bug in `next lint` for this Next.js version.
- **Mock data fallback**: When `NEXT_PUBLIC_DFS_API_BASE_URL` is empty and `NEXT_PUBLIC_USE_MOCK_FALLBACK=true` (default in `.env.example`), the app uses `src/lib/mock-data.ts`. No external API or Firebase credentials are needed for local development.
- **`.env.local` required**: Copy `.env.example` to `.env.local` before running the dev server. The defaults enable mock-data mode — no secrets needed.
- **`output: 'export'`**: The Next.js config uses static export. All pages must be statically renderable (no `getServerSideProps`, no dynamic server routes).
- **`/dashboard` route**: The classic dashboard with the mock leaderboard is at `/dashboard`. The newer `/contests` flow requires Firestore to show real lineups.
