# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

PGA DFS Contest Tracker — a Next.js 15 (App Router, static export) web app for tracking a private PGA golf fantasy contest. Uses Firebase Firestore as its real-time backend. See `README.md` for full details.

### Running the dev server

```bash
npm run dev
```

Starts Next.js with Turbopack on **port 9002**. The app works with mock data by default (`NEXT_PUBLIC_USE_MOCK_FALLBACK=true`) — no Firebase credentials or external APIs are needed for local development and UI work.

### Key commands

| Task | Command |
|---|---|
| Dev server | `npm run dev` |
| Type check | `npm run typecheck` |
| Production build | `npm run build` |
| Lint | `npm run lint` (not configured — ESLint is not installed; `next.config.ts` has `eslint.ignoreDuringBuilds: true`) |

### Gotchas

- **ESLint is not configured.** The project has a `lint` script (`next lint`) but ESLint is not in `devDependencies` and no config file exists. The build ignores lint errors via `eslint.ignoreDuringBuilds: true`. Do not attempt interactive `next lint` setup.
- **Static export mode.** `next.config.ts` sets `output: 'export'`, so Server Components, API routes, and other server-only Next.js features are unavailable. All data fetching happens client-side.
- **TypeScript errors are ignored during build** (`typescript.ignoreBuildErrors: true`), but `npm run typecheck` runs strict checking separately.
- **No `.env` file ships with the repo.** The app falls back to mock data automatically when env vars are missing.
- **The `league-scoring/` subdirectory** is a semi-independent Python script for computing league standings. It shares Firestore with the main app but has no `requirements.txt`; install `google-cloud-firestore` and `google-auth` manually if needed.
