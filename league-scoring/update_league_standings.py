#!/usr/bin/env python3
"""
Update league standings from weekly-scores JSON files.

Modes
-----
Default (no flags):
    Recompute standings from weekly-scores/*.json and write both
    standings-template.json and season-standings.json.

--contest-id <id>:
    Pull lineups and scores from Firestore for the given contest, write
    weekly-scores/{contestId}.json, then recompute standings outputs.

--ben --contest-id <id>:
    Fetch scores from the DFS API for a contest, write to
    ben-weekly-scores/{contestId}.json, then compute ben-standings.json.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import urllib.request
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


CHAMPIONSHIP_POINTS_BY_TIER = {
    "Standard": [30, 24, 20, 17, 14, 12, 10, 8, 7, 6, 5, 4, 3, 2, 2, 1, 1, 1, 1, 1, 1, 1],
    "Signature": [40, 32, 26, 22, 18, 15, 13, 11, 9, 8, 6, 5, 4, 3, 2, 2, 1, 1, 1, 1, 1, 1],
    "Major": [50, 40, 33, 27, 22, 18, 15, 13, 11, 10, 8, 7, 6, 5, 4, 3, 2, 2, 1, 1, 1, 1],
}

WEEKLY_FEE = 10
FIRST_WEEK_OF_QUARTER_FEE = 60
BASE_POOL_SIZE = 22

WEEKLY_PAYOUTS = {
    "Standard": [75, 50, 40, 25],
    "Signature": [105, 50, 35, 20, 10],
    "Major": [115, 55, 25, 15, 10],
}

QUARTERLY_PAYOUTS = [550, 275, 135, 85, 55]


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
    match = re.match(r"^week-(\d+)-", contest_id)
    if not match:
        raise RuntimeError(
            f'Unable to infer event id from contest id "{contest_id}". '
            "Use format like week-1-cognizant or pass --event-id explicitly."
        )
    return int(match.group(1))


def _load_env_cascade() -> None:
    cwd = Path.cwd()
    for base in (cwd, cwd.parent):
        load_env_file(base / ".env.local")
        load_env_file(base / ".env")


def _read_str(obj: Dict[str, Any], *keys: str) -> Optional[str]:
    for key in keys:
        value = obj.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _read_num(obj: Dict[str, Any], *keys: str) -> Optional[float]:
    for key in keys:
        value = obj.get(key)
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            try:
                return float(value)
            except ValueError:
                pass
    return None


def _read_num_list(obj: Dict[str, Any], *keys: str) -> List[int]:
    for key in keys:
        value = obj.get(key)
        if isinstance(value, list):
            result: List[int] = []
            for item in value:
                if isinstance(item, (int, float)):
                    result.append(int(item))
                elif isinstance(item, str):
                    try:
                        result.append(int(float(item)))
                    except ValueError:
                        pass
                elif isinstance(item, dict):
                    golfer_id = _read_num(item, "id", "playerId")
                    if golfer_id is not None:
                        result.append(int(golfer_id))
            return result
    return []


def _load_entry_user_map(league_dir: Path) -> Dict[str, Dict[str, str]]:
    path = league_dir / "entry-users.json"
    if not path.exists():
        return {}
    users = json.loads(path.read_text(encoding="utf-8"))
    result: Dict[str, Dict[str, str]] = {}
    for user in users:
        preferred = user.get("preferredName", "")
        entry_name = user.get("entryName", "")
        if preferred and entry_name:
            slug = entry_name.lower().replace(" ", "-")
            result[preferred] = {"entryId": slug, "entryName": entry_name}
            result[entry_name] = {"entryId": slug, "entryName": entry_name}
    return result


def _load_all_entries(league_dir: Path) -> List[Dict[str, str]]:
    path = league_dir / "entry-users.json"
    if not path.exists():
        return []
    users = json.loads(path.read_text(encoding="utf-8"))
    all_entries: List[Dict[str, str]] = []
    for user in users:
        entry_name = str(user.get("entryName") or "").strip()
        if not entry_name:
            continue
        all_entries.append(
            {
                "entryId": entry_name.lower().replace(" ", "-"),
                "entryName": entry_name,
            }
        )
    return all_entries


def fetch_weekly_entries_from_api(contest_id: str) -> List[Dict]:
    base_url = (os.environ.get("NEXT_PUBLIC_DFS_API_BASE_URL") or "").strip().rstrip("/")
    api_path_tpl = (os.environ.get("NEXT_PUBLIC_DFS_API_PATH") or "/contests/{contestId}/live").strip()
    api_contest_id = (os.environ.get("NEXT_PUBLIC_DFS_CONTEST_ID") or contest_id).strip()
    api_key = (os.environ.get("NEXT_PUBLIC_DFS_API_KEY") or "").strip() or None
    api_key_header = (os.environ.get("NEXT_PUBLIC_DFS_API_KEY_HEADER") or "x-api-key").strip()

    if not base_url:
        raise RuntimeError(
            "NEXT_PUBLIC_DFS_API_BASE_URL is not set. Create a .env.local with the DFS API credentials."
        )

    path = api_path_tpl.replace("{contestId}", api_contest_id)
    if not path.startswith("/"):
        path = "/" + path
    url = f"{base_url}{path}"

    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    if api_key:
        req.add_header(api_key_header, api_key)

    print(f"Fetching from DFS API: {url}")
    with urllib.request.urlopen(req, timeout=15) as resp:
        payload = json.loads(resp.read().decode("utf-8"))

    if not isinstance(payload, dict):
        raise RuntimeError("DFS API returned non-object payload.")

    golfers_raw: List[Dict] = payload.get("golfers") or payload.get("playersPool") or payload.get("athletes") or []
    players_raw: List[Dict] = payload.get("players") or payload.get("entries") or payload.get("leaderboard") or []

    golfer_pts: Dict[int, float] = {}
    for golfer in golfers_raw:
        golfer_id = _read_num(golfer, "id", "playerId")
        fantasy_points = _read_num(golfer, "fantasyPoints", "points", "dkPoints")
        if golfer_id is not None:
            golfer_pts[int(golfer_id)] = fantasy_points if fantasy_points is not None else 0.0

    league_dir = resolve_league_dir()
    name_map = _load_entry_user_map(league_dir)

    entries: List[Dict] = []
    for player in players_raw:
        name = _read_str(player, "name", "entryName") or "unknown"
        lineup_ids = _read_num_list(player, "lineupGolferIds", "lineup")
        total = sum(golfer_pts.get(golfer_id, 0.0) for golfer_id in lineup_ids)

        entry_id = name_map.get(name, {}).get("entryId", name)
        entry_name = name_map.get(name, {}).get("entryName", name)

        entries.append(
            {
                "entryId": entry_id,
                "entryName": entry_name,
                "weeklyFantasyPoints": round(total, 1),
            }
        )

    return entries


def _resolve_credentials_path() -> Optional[str]:
    cred = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
    if cred:
        path = Path(cred)
        if not path.is_absolute():
            for base in (Path.cwd(), Path.cwd().parent):
                candidate = base / cred
                if candidate.exists():
                    return str(candidate.resolve())
        return cred
    return None


def _init_firestore_client():
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
    cred_path = _resolve_credentials_path()
    if cred_path:
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = cred_path

    if raw_json:
        info = json.loads(raw_json)
        credentials = service_account.Credentials.from_service_account_info(info)
        return Client(project=project or info.get("project_id"), credentials=credentials)

    if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        return Client(project=project)

    raise RuntimeError(
        "No Firebase credentials found.\n"
        "Set GOOGLE_APPLICATION_CREDENTIALS=./your-service-account.json in .env,\n"
        "or provide FIREBASE_SERVICE_ACCOUNT_JSON."
    )


def fetch_weekly_entries_from_firestore(contest_id: str) -> List[Dict]:
    db = _init_firestore_client()

    print(f"Reading Firestore: test_scores/{contest_id}/golfers ...")
    golfers_ref = db.collection("test_scores").document(contest_id).collection("golfers")
    golfer_points: Dict[str, float] = {}
    for doc in golfers_ref.stream():
        data = doc.to_dict() or {}
        fantasy_points = data.get("fantasyPoints")
        golfer_points[doc.id] = float(fantasy_points) if isinstance(fantasy_points, (int, float)) else 0.0

    if not golfer_points:
        raise RuntimeError(
            f"No golfer scores found in test_scores/{contest_id}/golfers.\n"
            "Has the tournament data been synced to Firestore?"
        )
    print(f"  Found {len(golfer_points)} golfer scores")

    print(f"Reading Firestore: test_lineups/{contest_id}/entries ...")
    entries_ref = db.collection("test_lineups").document(contest_id).collection("entries")
    results: List[Dict] = []
    for doc in entries_ref.stream():
        data = doc.to_dict() or {}
        entry_id = str(data.get("userSlug") or doc.id)
        entry_name = str(data.get("userDisplayName") or data.get("entryName") or entry_id)
        official_points = data.get("officialWeeklyFantasyPoints")
        if isinstance(official_points, (int, float)):
            total = float(official_points)
        else:
            lineup_ids = data.get("lineupGolferIds") or []
            total = sum(golfer_points.get(str(golfer_id), 0.0) for golfer_id in lineup_ids)
        results.append(
            {
                "entryId": entry_id,
                "entryName": entry_name,
                "weeklyFantasyPoints": round(total, 1),
            }
        )

    if not results:
        raise RuntimeError(
            f"No lineup entries found in test_lineups/{contest_id}/entries.\n"
            "Has this contest been set up in Firestore?"
        )

    results.sort(key=lambda row: row["weeklyFantasyPoints"], reverse=True)
    print(f"  Found {len(results)} entries")
    return results


def rank_entries(entries: List[Dict]) -> List[Dict]:
    eligible_rows = [row for row in entries if not bool(row.get("noRank"))]
    sorted_rows = sorted(eligible_rows, key=lambda row: row["weeklyFantasyPoints"], reverse=True)
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
            id=int(row["id"]),
            name=str(row["name"]),
            tier=str(row["tier"]),
            quarter=int(row["quarter"]),
            is_quarter_finale=bool(row["isQuarterFinale"]),
        )
        for row in data
    ]


def load_weekly_files(weekly_dir: Path) -> List[Tuple[int, Dict]]:
    weekly_dir.mkdir(parents=True, exist_ok=True)
    rows: List[Tuple[int, Dict]] = []
    for path in sorted(weekly_dir.glob("*.json")):
        obj = json.loads(path.read_text(encoding="utf-8"))
        rows.append((int(obj["eventId"]), obj))
    rows.sort(key=lambda row: row[0])
    return rows


def compute_standings(
    schedule: List[ScheduleEvent],
    weekly_data: List[Tuple[int, Dict]],
    all_entries: Optional[List[Dict[str, str]]] = None,
) -> List[Dict]:
    event_by_id = {event.id: event for event in schedule}

    first_week_ids = set()
    current_quarter = None
    for event in schedule:
        if event.quarter != current_quarter:
            first_week_ids.add(event.id)
            current_quarter = event.quarter

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

    for seed in all_entries or []:
        record = by_entry[seed["entryId"]]
        record["entryId"] = seed["entryId"]
        record["entryName"] = seed["entryName"]

    present_event_ids = {event_id for event_id, _weekly in weekly_data}

    for event_id, weekly in weekly_data:
        event = event_by_id.get(event_id)
        tier = event.tier if event else "Standard"
        ranked = rank_entries(weekly.get("entries", []))

        num_entries = len(ranked)
        if num_entries == 0:
            continue

        fee_per_user = FIRST_WEEK_OF_QUARTER_FEE if event_id in first_week_ids else WEEKLY_FEE
        scale = num_entries / BASE_POOL_SIZE
        payouts = [int(payout * scale) for payout in WEEKLY_PAYOUTS.get(tier, WEEKLY_PAYOUTS["Standard"])]

        tie_groups: Dict[int, List[int]] = defaultdict(list)
        for idx, row in enumerate(ranked):
            tie_groups[row["rank"]].append(idx)

        for row in ranked:
            entry_id = row["entryId"]
            record = by_entry[entry_id]
            record["entryId"] = entry_id
            record["entryName"] = row["entryName"]
            record["weeksEntered"] += 1
            record["weeklyFantasyPointsTotal"] += row["weeklyFantasyPoints"]
            record["fees"] += fee_per_user

            rank = row["rank"]
            group_indices = tie_groups[rank]
            group_size = len(group_indices)
            points_table = CHAMPIONSHIP_POINTS_BY_TIER.get(tier, CHAMPIONSHIP_POINTS_BY_TIER["Standard"])
            points_sum = sum(points_table[idx] if idx < len(points_table) else 0 for idx in group_indices)
            payout_sum = sum(payouts[idx] if idx < len(payouts) else 0 for idx in group_indices)

            record["championshipPoints"] += points_sum / group_size
            record["weeklyPayouts"] += payout_sum / group_size

            if rank == 1:
                record["weeklyWins"] += 1

    events_by_quarter: Dict[int, List[int]] = defaultdict(list)
    quarter_finale_by_quarter: Dict[int, int] = {}
    for event in schedule:
        events_by_quarter[event.quarter].append(event.id)
        if event.is_quarter_finale:
            quarter_finale_by_quarter[event.quarter] = event.id

    for quarter, event_ids in events_by_quarter.items():
        finale_id = quarter_finale_by_quarter.get(quarter)
        if not finale_id or finale_id not in present_event_ids:
            continue

        quarter_events = [(event_id, weekly) for event_id, weekly in weekly_data if event_id in event_ids]
        if not quarter_events:
            continue

        quarter_points: Dict[str, float] = defaultdict(float)
        active_players = 0
        for event_id, weekly in quarter_events:
            event = event_by_id.get(event_id)
            tier = event.tier if event else "Standard"
            ranked = rank_entries(weekly.get("entries", []))
            active_players = max(active_players, len(ranked))
            tie_groups: Dict[int, List[int]] = defaultdict(list)
            for idx, row in enumerate(ranked):
                tie_groups[row["rank"]].append(idx)
            for row in ranked:
                rank = row["rank"]
                group_indices = tie_groups[rank]
                group_size = len(group_indices)
                points_table = CHAMPIONSHIP_POINTS_BY_TIER.get(tier, CHAMPIONSHIP_POINTS_BY_TIER["Standard"])
                points_sum = sum(points_table[idx] if idx < len(points_table) else 0 for idx in group_indices)
                quarter_points[row["entryId"]] += points_sum / group_size

        quarter_sorted = sorted(quarter_points.items(), key=lambda item: item[1], reverse=True)
        scale = active_players / BASE_POOL_SIZE
        payouts = [int(payout * scale) for payout in QUARTERLY_PAYOUTS]
        for idx, (entry_id, _points) in enumerate(quarter_sorted[:5]):
            by_entry[entry_id]["weeklyPayouts"] += payouts[idx]

    previous_week_finish_by_entry: Dict[str, int] = {}
    if len(weekly_data) >= 2:
        _previous_event_id, previous_week = weekly_data[-2]
        for row in rank_entries(previous_week.get("entries", [])):
            previous_week_finish_by_entry[row["entryId"]] = int(row["rank"])

    rows = []
    for record in by_entry.values():
        points = record["championshipPoints"]
        rows.append(
            {
                "rank": 0,
                "entryId": record["entryId"],
                "entryName": record["entryName"],
                "championshipPoints": points if points % 1 else int(points),
                "netDollars": round(record["weeklyPayouts"] - record["fees"], 2),
                "weeklyFantasyPointsTotal": round(record["weeklyFantasyPointsTotal"], 1),
                "totalPointsScored": round(record["weeklyFantasyPointsTotal"], 1),
                "weeklyWins": int(record["weeklyWins"]),
                "previousWeekFinish": previous_week_finish_by_entry.get(record["entryId"]),
                "weeksEntered": int(record["weeksEntered"]),
            }
        )

    rows.sort(key=lambda row: (-row["championshipPoints"], -row["weeklyFantasyPointsTotal"], row["entryName"]))
    rank = 1
    last_points = None
    last_fantasy_points = None
    for idx, row in enumerate(rows):
        if idx > 0 and (
            row["championshipPoints"] < (last_points if last_points is not None else row["championshipPoints"])
            or row["weeklyFantasyPointsTotal"] < (last_fantasy_points if last_fantasy_points is not None else row["weeklyFantasyPointsTotal"])
        ):
            rank = idx + 1
        row["rank"] = rank
        last_points = row["championshipPoints"]
        last_fantasy_points = row["weeklyFantasyPointsTotal"]
    return rows


def _write_standings_outputs(league_dir: Path, standings: List[Dict]) -> None:
    payload = json.dumps(standings, indent=2)
    template_path = league_dir / "standings-template.json"
    season_path = league_dir / "season-standings.json"
    template_path.write_text(payload, encoding="utf-8")
    season_path.write_text(payload, encoding="utf-8")
    print(f"Wrote {template_path}  ({len(standings)} entries)")
    print(f"Wrote {season_path}  ({len(standings)} entries)")


def _run_official_mode(league_dir: Path, schedule: List[ScheduleEvent]) -> None:
    weekly_dir = league_dir / "weekly-scores"
    weekly_data = load_weekly_files(weekly_dir)
    if not weekly_data:
        print("No weekly-scores/*.json files found. Nothing to do.")
        return

    standings = compute_standings(schedule, weekly_data, all_entries=_load_all_entries(league_dir))
    _write_standings_outputs(league_dir, standings)


def _run_firestore_mode(
    args: argparse.Namespace,
    league_dir: Path,
    schedule: List[ScheduleEvent],
) -> None:
    contest_id = args.contest_id
    event_id = args.event_id if args.event_id is not None else infer_event_id(contest_id)
    event = next((row for row in schedule if row.id == event_id), None)
    if event is None:
        raise RuntimeError(f"event id {event_id} not found in schedule.json")

    entries = fetch_weekly_entries_from_firestore(contest_id)
    all_known = _load_all_entries(league_dir)
    known_ids = {entry["entryId"] for entry in all_known}
    found_ids = {entry["entryId"] for entry in entries}
    missing = known_ids - found_ids
    if missing:
        print(f"\n  WARNING: {len(missing)} known entry(s) NOT in Firestore for this contest:")
        for entry_id in sorted(missing):
            print(f"    - {entry_id}")
        print("  If they played, add them manually to the weekly JSON before committing.\n")

    weekly_dir = league_dir / "weekly-scores"
    weekly_dir.mkdir(parents=True, exist_ok=True)
    weekly_path = weekly_dir / f"{contest_id}.json"
    weekly_obj = {"eventId": event.id, "eventName": event.name, "entries": entries}
    weekly_path.write_text(json.dumps(weekly_obj, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {weekly_path}  ({len(entries)} entries)")

    standings = compute_standings(schedule, load_weekly_files(weekly_dir), all_entries=all_known)
    _write_standings_outputs(league_dir, standings)


def _run_ben_mode(
    args: argparse.Namespace,
    league_dir: Path,
    schedule: List[ScheduleEvent],
) -> None:
    event_id = args.event_id if args.event_id is not None else infer_event_id(args.contest_id)
    event = next((row for row in schedule if row.id == event_id), None)
    if event is None:
        raise RuntimeError(f"event id {event_id} not found in schedule.json")

    entries = fetch_weekly_entries_from_api(args.contest_id)
    if not entries:
        raise RuntimeError("No entries returned from DFS API; check config and credentials.")

    ben_dir = league_dir / "ben-weekly-scores"
    ben_dir.mkdir(parents=True, exist_ok=True)
    weekly_path = ben_dir / f"{args.contest_id}.json"
    weekly_obj = {"eventId": event.id, "eventName": event.name, "entries": entries}
    weekly_path.write_text(json.dumps(weekly_obj, indent=2), encoding="utf-8")
    print(f"Wrote {weekly_path}  ({len(entries)} entries)")

    standings = compute_standings(schedule, load_weekly_files(ben_dir), all_entries=_load_all_entries(league_dir))
    standings_path = league_dir / "ben-standings.json"
    standings_path.write_text(json.dumps(standings, indent=2), encoding="utf-8")
    print(f"Wrote {standings_path}  ({len(standings)} entries)")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Recompute league standings. Use --contest-id to pull from Firestore first."
    )
    parser.add_argument(
        "--contest-id",
        default=None,
        help="Contest id (e.g. week-3-players). Pulls scores from Firestore, writes weekly JSON, recomputes standings.",
    )
    parser.add_argument(
        "--ben",
        action="store_true",
        help="Fetch from DFS API instead of Firestore (writes to ben-weekly-scores/ + ben-standings.json)",
    )
    parser.add_argument("--event-id", type=int, default=None, help="Override schedule event id")
    args = parser.parse_args()

    league_dir = resolve_league_dir()
    _load_env_cascade()
    schedule = load_schedule(league_dir)

    if args.ben:
        if not args.contest_id:
            parser.error("--ben requires --contest-id")
        _run_ben_mode(args, league_dir, schedule)
    elif args.contest_id:
        _run_firestore_mode(args, league_dir, schedule)
    else:
        _run_official_mode(league_dir, schedule)


if __name__ == "__main__":
    main()
