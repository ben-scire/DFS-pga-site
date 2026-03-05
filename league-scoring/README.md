Fantasy golf league scoring and standings. The league allows players to opt out between quarters, meaning the total headcount (and total prize pool) can change at the start of Q2, Q3, or Q4.

## The Payouts

All dollar amounts below are based on a **22-player pool**. If the active player count changes, all payouts (weekly, quarterly, and season-long) scale proportionally.

### Weekly Pots

| Tier | Pot | 1st | 2nd | 3rd | 4th | 5th |
|------|-----|-----|-----|-----|-----|-----|
| Standard | $190 | $75 | $50 | $40 | $25 | — |
| Signature | $220 | $105 | $50 | $35 | $20 | $10 |
| Major | $220 | $115 | $55 | $25 | $15 | $10 |

- Weekly buy-in: $10/player
- Standard weeks skim $30 from the pot to fund the Season-Long Overall prize. The remaining $190 is distributed to the top 4.
- Signature and Major weeks pay out the full $220 to the top 5 (no skim).

### Quarterly "Chunk" Pots

Paid out 4 times a year (Masters, PGA, Travelers, Tour Championship).

| 1st | 2nd | 3rd | 4th | 5th |
|-----|-----|-----|-----|-----|
| $550 | $275 | $135 | $85 | $55 |

- Quarterly buy-in: $50/player

### Season-Long Overall (Total: $480)

| 1st | 2nd |
|-----|-----|
| $350 | $130 |

### Opt-Out Consequence

If a user opts out, their status becomes `inactive`. Inactive users are permanently removed from the Season-Long points leaderboard and forfeit any claim to the Season-Long prize. Their points in the active Quarter are wiped.

---

## Standings table

One standings table is used for both points and money. You can sort by any column; the default sort is by **championship points** (descending). Column order:

| Column | Description |
|--------|-------------|
| `rank` | Standings rank (recomputed when sorting; default ordering is by points) |
| `entryId` | Stable id (e.g. same as test user id) |
| `entryName` | Display name |
| `championshipPoints` | Season total (from championship-points rules) |
| `netDollars` | **Net $** — total net (winnings minus entry fees: $10/week + $50/quarter) |
| `weeklyFantasyPointsTotal` | Sum of weekly fantasy points (tiebreaker / display) |
| `totalPointsScored` | Sum of all weekly fantasy scores (display-friendly alias) |
| `weeklyWins` | Count of weekly 1st-place finishes |
| `previousWeekFinish` | Finishing rank from the prior event (null when not available) |
| `weeksEntered` | Number of events entered (last column) |

## How standings are derived

The only required input is **weekly scores** (fantasy points per entrant per event). Everything else is computed:

1. **Weekly results** — One file per event in `weekly-scores/`: `eventId`, `eventName`, and `entries[]` with `entryId`, `entryName`, `weeklyFantasyPoints`.
2. **Schedule** — `schedule.json` maps event id → tier (Standard/Signature/Major) and quarter for payout rules and major multiplier.
3. **Payout rules** — Above (weekly pot, skim, top 4/5; quarterly pot, top 5). Net $ = winnings minus $10 per week and $50 per quarter paid in.
4. **Championship points** — Rank by `weeklyFantasyPoints` each week and apply the league finish-points matrix:
   - Major (2.5x): `50,40,33,27,22,18,15,13,11,10,8,7,6,5,4,3,2,2,1,1,1,1`
   - Signature (2x): `40,32,26,22,18,15,13,11,9,8,6,5,4,3,2,2,1,1,1,1,1,1`
   - Standard (1.5x): `30,24,20,17,14,12,10,8,7,6,5,4,3,2,2,1,1,1,1,1,1,1`

## Data files

| File | Purpose |
|------|---------|
| `season-standings.json` | Current computed standings output (rank, points, net dollars, and weekly aggregates). |
| `weekly-scores/*.json` | One JSON file per event (input). Each file has `eventId`, `eventName`, and `entries[]` with `entryId`, `entryName`, `weeklyFantasyPoints`. |

Events and tiers are defined in `schedule.json`.

**Schedule alignment:** Events are listed in order in `schedule.json`. The first event is **id 1 = Cognizant Classic**. So `week-1-cognizant.json` with `eventId: 1` is that event; the second event (id 2) is Arnold Palmer Invitational, and so on.

## Updating weekly-scores (connection to live scoring)

Install once:

```bash
python3 -m pip install google-cloud-firestore google-auth
```

Live scoring in the app comes from **Firestore**: lineups in `test_lineups/{contestId}/entries` and golfer scores in `test_scores/{contestId}/golfers`. The sync script (`../DFS-pga-site/scripts/sync-datagolf-live-scores.ts`) pulls from the Data Golf (or similar) API and writes those Firestore docs. The **live leaderboard** reads from the same place and sums fantasy points per lineup.

The `weekly-scores/` JSON files are the **persisted record** used to compute season standings (points and net $). To update them and refresh standings:

- **Script (recommended):** From the `league-scoring/` directory, run:
  ```bash
  python3 update_league_standings.py --contest-id week-1-cognizant
  ```
  This (1) reads Firestore `test_lineups` + `test_scores` for that contest, (2) writes `weekly-scores/{contestId}.json` (e.g. `week-1-cognizant.json`), then (3) recomputes standings from all weekly-scores (championship points, net $, weekly wins, previous week finish) and overwrites `season-standings.json`. Net $ uses $10/week and $60 the first week of each quarter (quarterly buy-in). Requires Firebase credentials (`FIREBASE_SERVICE_ACCOUNT_JSON` or `GOOGLE_APPLICATION_CREDENTIALS`) and Python packages `google-cloud-firestore` + `google-auth`.
- **Manual** — Export or paste the final standings (entryId, entryName, weeklyFantasyPoints) into a new JSON file in `weekly-scores/` for that event; then run the script without changing contest (or a separate script) to recompute standings only.

Once a week's file exists in `weekly-scores/`, standings can be computed from all such files plus the schedule and payout rules. A future **Live Standings** UI could show real-time movement by combining: (a) completed weeks from `weekly-scores/` and (b) the current week's live totals from Firestore.

## Out of scope (for now)

- **Live Standings** — A UI that shows points and money as if the current week ended right now (real-time fluctuation) is a future feature. This folder defines the data shape and templates only.
