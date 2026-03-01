#!/usr/bin/env python3
"""
Update league weekly scores + standings from Firestore.

Flow:
1) Read final lineup scores from Firestore collections:
   - test_lineups/{contestId}/entries
   - test_scores/{contestId}/golfers
2) Write weekly-scores/{contestId}.json
3) Recompute standings from all weekly-scores/*.json and write standings-template.json

Net dollars:
- Every entered week charges -10
- First week of each quarter charges -60 (quarter + week buy-in)
"""

from __future__ import annotations

import argparse
import json
import os
import re
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple


CHAMPIONSHIP_POINTS_TOP_10 = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]
MAJOR_MULTIPLIER = 2

WEEKLY_FEE = 10
FIRST_WEEK_OF_QUARTER_FEE = 60

# Standard: 85% of pot to top 4.
WEEKLY_STANDARD_TOP4_SPLIT = [0.50, 0.25, 0.15, 0.10]
# Signature/Major: 100% of pot to top 5.
WEEKLY_SIG_MAJOR_TOP5_SPLIT = [0.40, 0.25, 0.15, 0.12, 0.08]
# Quarter finale payout.
QUARTERLY_TOP5_SPLIT = [0.50, 0.25, 0.125, 0.075, 0.05]


@dataclass
class ScheduleEvent:
    id: int
    name: str
    tier: str
    quarter: int
    is_quarter_finale: bool


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        if key and key not in os.environ:
            os.environ[key] = value


def resolve_league_dir() -> Path:
    cwd = Path.cwd()
    candidate = cwd / "league-scoring"
    if candidate.exists():
        return candidate
    if cwd.name == "league-scoring":
        return cwd
    candidate_parent = cwd.parent / "league-scoring"
    if candidate_parent.exists():
        return candidate_parent
    raise RuntimeError("Could not find league-scoring directory from current working directory.")


def infer_event_id(contest_id: str) -> int:
    m = re.match(r"^week-(\d+)-", contest_id)
    if not m:
        raise RuntimeError(
            f'Unable to infer event id from contest id "{contest_id}". '
            "Use format like week-1-cognizant or pass --event-id explicitly."
        )
    return int(m.group(1))


def init_firestore_client():
    try:
        from google.cloud.firestore import Client
        from google.oauth2 import service_account
    except Exception as exc:
        raise RuntimeError(
            "Missing Python Firestore dependencies. Install with:\n"
            "  python3 -m pip install google-cloud-firestore google-auth"
        ) from exc

    raw_json = (os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON") or "").strip()
    project = (os.environ.get("GOOGLE_CLOUD_PROJECT") or "").strip() or None
    if raw_json:
        info = json.loads(raw_json)
        credentials = service_account.Credentials.from_service_account_info(info)
        return Client(project=project or info.get("project_id"), credentials=credentials)

    # Uses GOOGLE_APPLICATION_CREDENTIALS if set.
    return Client(project=project)


def fetch_weekly_entries(contest_id: str) -> List[Dict]:
    db = init_firestore_client()

    entries_snap = db.collection("test_lineups").document(contest_id).collection("entries").stream()
    golfers_snap = db.collection("test_scores").document(contest_id).collection("golfers").stream()

    golfer_points: Dict[str, float] = {}
    for doc in golfers_snap:
        data = doc.to_dict() or {}
        fp = data.get("fantasyPoints")
        golfer_points[doc.id] = float(fp) if isinstance(fp, (int, float)) else 0.0

    weekly_entries: List[Dict] = []
    for doc in entries_snap:
        data = doc.to_dict() or {}
        entry_id = str(data.get("userSlug") or doc.id)
        entry_name = str(data.get("userDisplayName") or entry_id)
        lineup_ids = data.get("lineupGolferIds") or []
        total = 0.0
        for gid in lineup_ids:
            total += golfer_points.get(str(gid), 0.0)
        weekly_entries.append(
            {
                "entryId": entry_id,
                "entryName": entry_name,
                "weeklyFantasyPoints": round(total, 1),
            }
        )
    return weekly_entries


def rank_entries(entries: List[Dict]) -> List[Dict]:
    sorted_rows = sorted(entries, key=lambda r: r["weeklyFantasyPoints"], reverse=True)
    ranked = []
    rank = 1
    last = None
    for idx, row in enumerate(sorted_rows):
        score = float(row["weeklyFantasyPoints"])
        if idx > 0 and score < (last if last is not None else score):
            rank = idx + 1
        last = score
        ranked.append(
            {
                "entryId": row["entryId"],
                "entryName": row["entryName"],
                "weeklyFantasyPoints": score,
                "rank": rank,
            }
        )
    return ranked


def load_schedule(league_dir: Path) -> List[ScheduleEvent]:
    data = json.loads((league_dir / "schedule.json").read_text(encoding="utf-8"))
    return [
        ScheduleEvent(
            id=int(r["id"]),
            name=str(r["name"]),
            tier=str(r["tier"]),
            quarter=int(r["quarter"]),
            is_quarter_finale=bool(r["isQuarterFinale"]),
        )
        for r in data
    ]


def load_weekly_files(league_dir: Path) -> List[Tuple[int, Dict]]:
    weekly_dir = league_dir / "weekly-scores"
    weekly_dir.mkdir(parents=True, exist_ok=True)
    rows: List[Tuple[int, Dict]] = []
    for fp in sorted(weekly_dir.glob("*.json")):
        obj = json.loads(fp.read_text(encoding="utf-8"))
        rows.append((int(obj["eventId"]), obj))
    rows.sort(key=lambda r: r[0])
    return rows


def compute_standings(schedule: List[ScheduleEvent], weekly_data: List[Tuple[int, Dict]]) -> List[Dict]:
    event_by_id = {e.id: e for e in schedule}

    first_week_ids = set()
    current_q = None
    for e in schedule:
        if e.quarter != current_q:
            first_week_ids.add(e.id)
            current_q = e.quarter

    by_entry = defaultdict(
        lambda: {
            "entryId": "",
            "entryName": "",
            "championshipPoints": 0.0,
            "weeklyPayouts": 0.0,
            "fees": 0.0,
            "weeklyFantasyPointsTotal": 0.0,
            "weeklyWins": 0,
            "weeksEntered": 0,
        }
    )

    present_event_ids = {event_id for event_id, _ in weekly_data}

    # Weekly points + weekly payout + fees
    for event_id, weekly in weekly_data:
        event = event_by_id.get(event_id)
        tier = event.tier if event else "Standard"
        multiplier = MAJOR_MULTIPLIER if tier == "Major" else 1
        entries = weekly.get("entries", [])
        ranked = rank_entries(entries)

        n = len(entries)
        weekly_pot = n * WEEKLY_FEE
        fee_per_user = FIRST_WEEK_OF_QUARTER_FEE if event_id in first_week_ids else WEEKLY_FEE
        distributable = weekly_pot * 0.85 if tier == "Standard" else weekly_pot
        split = WEEKLY_STANDARD_TOP4_SPLIT if tier == "Standard" else WEEKLY_SIG_MAJOR_TOP5_SPLIT
        payout_places = 4 if tier == "Standard" else 5

        for i, row in enumerate(ranked):
            entry_id = row["entryId"]
            rec = by_entry[entry_id]
            rec["entryId"] = entry_id
            rec["entryName"] = row["entryName"]
            rec["weeksEntered"] += 1
            rec["weeklyFantasyPointsTotal"] += row["weeklyFantasyPoints"]
            rec["fees"] += fee_per_user

            rnk = row["rank"]
            base = CHAMPIONSHIP_POINTS_TOP_10[rnk - 1] if 1 <= rnk <= len(CHAMPIONSHIP_POINTS_TOP_10) else 0
            rec["championshipPoints"] += base * multiplier
            if rnk == 1:
                rec["weeklyWins"] += 1
            if i < payout_places:
                rec["weeklyPayouts"] += distributable * split[i]

    # Quarterly payouts only once quarter finale week exists in weekly files.
    events_by_quarter: Dict[int, List[int]] = defaultdict(list)
    quarter_finale_by_q: Dict[int, int] = {}
    for e in schedule:
        events_by_quarter[e.quarter].append(e.id)
        if e.is_quarter_finale:
            quarter_finale_by_q[e.quarter] = e.id

    for quarter, event_ids in events_by_quarter.items():
        finale_id = quarter_finale_by_q.get(quarter)
        if not finale_id or finale_id not in present_event_ids:
            continue

        quarter_events = [(eid, w) for eid, w in weekly_data if eid in event_ids]
        if not quarter_events:
            continue

        quarter_points: Dict[str, float] = defaultdict(float)
        active_players = 0
        for eid, weekly in quarter_events:
            event = event_by_id.get(eid)
            tier = event.tier if event else "Standard"
            multiplier = MAJOR_MULTIPLIER if tier == "Major" else 1
            ranked = rank_entries(weekly.get("entries", []))
            active_players = max(active_players, len(weekly.get("entries", [])))
            for row in ranked:
                rnk = row["rank"]
                base = CHAMPIONSHIP_POINTS_TOP_10[rnk - 1] if 1 <= rnk <= len(CHAMPIONSHIP_POINTS_TOP_10) else 0
                quarter_points[row["entryId"]] += base * multiplier

        quarter_sorted = sorted(quarter_points.items(), key=lambda it: it[1], reverse=True)
        quarterly_pot = active_players * 50
        for idx, (entry_id, _pts) in enumerate(quarter_sorted[:5]):
            by_entry[entry_id]["weeklyPayouts"] += quarterly_pot * QUARTERLY_TOP5_SPLIT[idx]

    # Previous-week finishing position:
    # If we have 2+ weeks, use the second-latest event as "previous week".
    previous_week_finish_by_entry: Dict[str, int] = {}
    if len(weekly_data) >= 2:
        _prev_event_id, prev_week_obj = weekly_data[-2]
        prev_ranked = rank_entries(prev_week_obj.get("entries", []))
        for row in prev_ranked:
            previous_week_finish_by_entry[row["entryId"]] = int(row["rank"])

    # Final standings sort and rank
    rows = []
    for rec in by_entry.values():
        rows.append(
            {
                "rank": 0,
                "entryId": rec["entryId"],
                "entryName": rec["entryName"],
                "championshipPoints": int(rec["championshipPoints"]),
                "netDollars": round(rec["weeklyPayouts"] - rec["fees"], 2),
                "weeklyFantasyPointsTotal": round(rec["weeklyFantasyPointsTotal"], 1),
                "totalPointsScored": round(rec["weeklyFantasyPointsTotal"], 1),
                "weeklyWins": int(rec["weeklyWins"]),
                "previousWeekFinish": previous_week_finish_by_entry.get(rec["entryId"]),
                "weeksEntered": int(rec["weeksEntered"]),
            }
        )

    rows.sort(key=lambda r: (-r["championshipPoints"], -r["weeklyFantasyPointsTotal"], r["entryName"]))
    rank = 1
    last_pts = None
    last_fp = None
    for idx, row in enumerate(rows):
        if idx > 0 and (
            row["championshipPoints"] < (last_pts if last_pts is not None else row["championshipPoints"])
            or row["weeklyFantasyPointsTotal"] < (last_fp if last_fp is not None else row["weeklyFantasyPointsTotal"])
        ):
            rank = idx + 1
        row["rank"] = rank
        last_pts = row["championshipPoints"]
        last_fp = row["weeklyFantasyPointsTotal"]
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description="Update weekly scores + standings from Firestore.")
    parser.add_argument("--contest-id", default="week-1-cognizant", help="Firestore contest id")
    parser.add_argument("--event-id", type=int, default=None, help="Override schedule event id")
    args = parser.parse_args()

    league_dir = resolve_league_dir()

    # load env vars from app root if available
    cwd = Path.cwd()
    load_env_file(cwd / ".env.local")
    load_env_file(cwd / ".env")
    load_env_file(cwd.parent / ".env.local")
    load_env_file(cwd.parent / ".env")

    schedule = load_schedule(league_dir)
    event_id = args.event_id if args.event_id is not None else infer_event_id(args.contest_id)
    event = next((e for e in schedule if e.id == event_id), None)
    if event is None:
        raise RuntimeError(f"event id {event_id} not found in schedule.json")

    entries = fetch_weekly_entries(args.contest_id)
    if not entries:
        raise RuntimeError("No entries returned from Firestore for contest; check contest id and credentials.")

    weekly_dir = league_dir / "weekly-scores"
    weekly_dir.mkdir(parents=True, exist_ok=True)
    weekly_path = weekly_dir / f"{args.contest_id}.json"
    weekly_obj = {"eventId": event.id, "eventName": event.name, "entries": entries}
    weekly_path.write_text(json.dumps(weekly_obj, indent=2), encoding="utf-8")
    print(f"Wrote {weekly_path}")

    weekly_data = load_weekly_files(league_dir)
    standings = compute_standings(schedule, weekly_data)
    standings_path = league_dir / "standings-template.json"
    standings_path.write_text(json.dumps(standings, indent=2), encoding="utf-8")
    print(f"Wrote {standings_path}")


if __name__ == "__main__":
    main()

