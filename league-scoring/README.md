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

1. **Weekly results** — One file per event in `weekly-scores/` (quarter subfolders are fine, for example `weekly-scores/Q1/`): `eventId`, `eventName`, and `entries[]` with `entryId`, `entryName`, `weeklyFantasyPoints`.
2. **Schedule** — `schedule.json` maps event id → tier (Standard/Signature/Major) and quarter for payout rules and major multiplier.
3. **Payout rules** — Above (weekly pot, skim, top 4/5; quarterly pot, top 5). Net $ = winnings minus $10 per week and $50 per quarter paid in.
4. **Championship points** — Rank by `weeklyFantasyPoints` each week and apply the league finish-points matrix:
   - Major (2.5x): `50,40,33,27,22,18,15,13,11,10,8,7,6,5,4,3,2,2,1,1`
   - Signature (2x): `40,32,26,22,18,15,13,11,9,8,6,5,4,3,2,2,1,1,1,1`
   - Standard (1.5x): `30,24,20,17,14,12,10,8,7,6,5,4,3,2,2,1,1,1,1,1`

## Data files

| File | Purpose |
|------|---------|
| `season-standings.json` | Current computed season-long standings output (rank, points, net dollars, and weekly aggregates). |
| `q1-standings.json`, `q2-standings.json`, etc. | Current quarter-only standings snapshots/outputs using the same schema. |
| `weekly-scores/**/*.json` | One JSON file per event (input). Quarter subfolders are supported. Each file has `eventId`, `eventName`, and `entries[]` with `entryId`, `entryName`, `weeklyFantasyPoints`. |

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
  python3 update_league_standings.py --contest-id week-2-arnold-palmer
  ```
  This (1) reads Firestore `test_lineups` + `test_scores` for that contest, (2) writes `weekly-scores/Q{quarter}/{contestId}.json` (for example `weekly-scores/Q1/week-2-arnold-palmer.json`), then (3) recomputes standings from all weekly-scores and overwrites `season-standings.json` plus the current quarter file (for example `q2-standings.json`). Net $ uses $10/week and $60 the first week of each quarter (quarterly buy-in). If lineup docs contain `officialWeeklyFantasyPoints` (from DK standings import), those values are used as source-of-truth instead of summed golfer live scores. Requires Firebase credentials (`FIREBASE_SERVICE_ACCOUNT_JSON` or `GOOGLE_APPLICATION_CREDENTIALS`) and Python packages `google-cloud-firestore` + `google-auth`.
- **Manual** — Export or paste the final standings (entryId, entryName, weeklyFantasyPoints) into a new JSON file in `weekly-scores/` for that event; then run the script without changing contest (or a separate script) to recompute standings only.

### Quarter-active, no weekly entry

If someone stays in the quarter pool but does **not** enter a specific weekly event, keep them in the week's JSON with this pattern:

```json
{
  "entryId": "capc",
  "entryName": "capc",
  "weeklyFantasyPoints": 0,
  "noRank": true,
  "feeOverride": 50
}
```

Use this when all of the following are true:

- they are still active for the quarter pot
- they should **not** count as a weekly entrant for weekly payouts
- they should **not** receive weekly points or a weekly finish
- they still owe the quarter buy-in for that week if it is the first event of the quarter

What the fields mean:

- `noRank: true` removes them from weekly ranking, weekly payouts, and weekly championship points
- `feeOverride` lets you charge the exact amount needed without counting them as a weekly entrant
- keep `activePlayers` on the weekly file set to the full quarter pool size when the quarter payout pool should still include them

For non-first weeks of a quarter, use `feeOverride: 0` unless that player still owes some custom amount for that specific event.

### Week 9 Zurich staging

For Week 9 (`Zurich Classic`), wait until the tournament is final before pulling DataGolf scores. The lineup sheet can be prepared now.

Export the Google Sheet as CSV to:

```bash
league-scoring/week9-lineups.csv
```

The CSV should use either of these formats:

- DraftKings-style columns: `EntryId`, `EntryName`, `Lineup` where the `Lineup` value has DraftKings `G` separators
- Google Sheet columns: `EntryName`, `Player1`, `Player2`, `Player3`, `Player4`, `Player5`, `Player6`
- Simple Google Sheet columns: `EntryName`, `Lineup` where `Lineup` is one cell containing all 6 player names

For one-cell lineups like `Matt Fitzpatrick Karl Vilips Alex Smalley ...`, the scorer attempts to split the cell automatically by matching against the DataGolf field list. If a player is misspelled or the current DataGolf feed is not the correct tournament, the scorer will stop on the first row it cannot split. In that case, either fix that spelling or split only that row into `Player1` through `Player6`.

When Zurich is final, confirm `.env` points `DATAGOLF_LIVE_URL` at the final Zurich DataGolf feed, then run:

```bash
npx tsx scripts/score-weekly-lineups-from-datagolf.ts \
  --input-csv league-scoring/week9-lineups.csv \
  --output-json league-scoring/weekly-scores/Q2/week-9-zurich.json \
  --event-id 9 \
  --event-name "Zurich Classic" \
  --active-players 17
```

Use `--active-players 16` instead if Tibaudo does not end up joining Q2. The generated JSON should be reviewed before recomputing `q2-standings.json`.

Once a week's file exists in `weekly-scores/`, standings can be computed from all such files plus the schedule and payout rules. A future **Live Standings** UI could show real-time movement by combining: (a) completed weeks from `weekly-scores/` and (b) the current week's live totals from Firestore.

## Out of scope (for now)

- **Live Standings** — A UI that shows points and money as if the current week ended right now (real-time fluctuation) is a future feature. This folder defines the data shape and templates only.

## Locked payout tracking

### Q1 finalized payouts

Quarter 1 final payouts:

- 1st: `jpetruney` - `$550`
- 2nd: `finsmaniac` - `$275`
- 3rd: `johncastronovo` - `$135`
- 4th: `sam.scire` - `$85`
- 5th: `amac` - `$55`

### Q2 payout schedule

Quarter 2 uses a `16`-player quarter pool.

Normal weekly payouts when all `16` players enter:

- Standard: `$54`, `$36`, `$29`, `$18`
- Signature: `$76`, `$36`, `$25`, `$14`, `$7`
- Major: `$83`, `$40`, `$18`, `$10`, `$7`

Week 8 (`RBC Heritage`) special case:

- `16` players are still in the Q2 quarter pool.
- `capc` did not enter week 8, so the weekly event paid out as a `15`-entry Signature event.
- Week 8 final signature payouts: `$71`, `$34`, `$23`, `$13`, `$6`
- Week 8 winners:
  - `sam.scire` - `$71`
  - `rohansharma99` - `$34`
  - `samthemaam5` - `$23`
  - `yimmerdoe` - `$13`
  - `eions` - `$6`

Q2 final quarter payouts for `16` active players:

- 1st: `$400`
- 2nd: `$200`
- 3rd: `$98`
- 4th: `$61`
- 5th: `$40`
