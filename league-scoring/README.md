Add dynamic player pool and payout calculation logic to the fantasy golf app. The league allows players to opt out between quarters, meaning the total headcount (and total prize pool) can change at the start of Q2, Q3, or Q4.

Implement the following business logic:

1. DYNAMIC STATE TRACKING
- Track an `activePlayers` integer that updates at the start of each Quarter.
- For Q1, `activePlayers = 20`.

2. QUARTERLY POT CALCULATION
- The Quarterly Buy-in is $50 per active player.
- Calculate `quarterlyPot = activePlayers * 50`.
- Calculate payouts using strict percentages so the math auto-adjusts if headcount drops:
   - 1st Place: 50% of `quarterlyPot`
   - 2nd Place: 25% of `quarterlyPot`
   - 3rd Place: 12.5% of `quarterlyPot`
   - 4th Place: 7.5% of `quarterlyPot`
   - 5th Place: 5% of `quarterlyPot`

3. WEEKLY POT CALCULATION
- The Weekly Buy-in is $10 per active player.
- Calculate `weeklyPot = activePlayers * 10`.
- To fund the Season-Long Overall prize, exact fixed amounts must be skimmed from the weekly pots. 
- Ensure your weekly payout logic handles dynamic scaling if `activePlayers` drops below 20. Set a rule: 
   - Standard Weeks skim 15% of the `weeklyPot` to route to the `seasonLongPot`. The remaining 85% is distributed to the Top 4 finishers.
   - Signature and Major Weeks pay out 100% of the `weeklyPot` to the Top 5 finishers (no skimming).

4. OPT-OUT CONSEQUENCE
- If a user opts out, their status becomes `inactive`. 
- Inactive users are permanently removed from the Season-Long points leaderboard and forfeit any claim to the Season-Long prize. Their points in the active Quarter are wiped.

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
4. **Championship points** — Rank by `weeklyFantasyPoints` each week; award top 10 (25, 18, 15, 12, 10, 8, 6, 4, 2, 1); apply major multiplier for majors. Sum for season.

## Data files

| File | Purpose |
|------|---------|
| `standings-template.json` | Mock standings (output shape). Use as template for the full table. All `netDollars` are -60 (everyone has paid $50 quarter + $10 week; no winnings yet). |
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
  This (1) reads Firestore `test_lineups` + `test_scores` for that contest, (2) writes `weekly-scores/{contestId}.json` (e.g. `week-1-cognizant.json`), then (3) recomputes standings from all weekly-scores (championship points, net $, weekly wins, previous week finish) and overwrites `standings-template.json`. Net $ uses $10/week and $60 the first week of each quarter (quarterly buy-in). Requires Firebase credentials (`FIREBASE_SERVICE_ACCOUNT_JSON` or `GOOGLE_APPLICATION_CREDENTIALS`) and Python packages `google-cloud-firestore` + `google-auth`.
- **Manual** — Export or paste the final standings (entryId, entryName, weeklyFantasyPoints) into a new JSON file in `weekly-scores/` for that event; then run the script without changing contest (or a separate script) to recompute standings only.

Once a week's file exists in `weekly-scores/`, standings can be computed from all such files plus the schedule and payout rules. A future **Live Standings** UI could show real-time movement by combining: (a) completed weeks from `weekly-scores/` and (b) the current week's live totals from Firestore.

## Out of scope (for now)

- **Live Standings** — A UI that shows points and money as if the current week ended right now (real-time fluctuation) is a future feature. This folder defines the data shape and templates only.