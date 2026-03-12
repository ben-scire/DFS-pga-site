#!/usr/bin/env python3
"""
Update league standings from weekly-scores JSON files.

Modes
-----
Default (no flags):
    Recompute standings from weekly-scores/*.json and write season-standings.json.
    No network access required.

--contest-id <id>:
    Pull lineups and scores from Firestore for the given contest, write
    weekly-scores/{contestId}.json, then recompute season-standings.json.
    Requires GOOGLE_APPLICATION_CREDENTIALS pointing to a Firebase
    service account JSON key (set in .env or as an env var).

--ben --contest-id <id>:
    Fetch scores from the DFS API for a contest, write to
    ben-weekly-scores/{contestId}.json, then compute standings from all
    ben-weekly-scores/*.json and write ben-standings.json.

Net dollars:
- Every entered week charges -10
- First week of each quarter charges -60 (quarter + week buy-in)
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

# Fixed-dollar payouts for a 22-player pool.
# If active player count changes, payouts scale proportionally.
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


# ---------------------------------------------------------------------------
# Env / path helpers
# ---------------------------------------------------------------------------

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


def _load_env_cascade() -> None:
    """Load .env.local / .env from project root (best-effort)."""
    cwd = Path.cwd()
    for base in (cwd, cwd.parent):
        load_env_file(base / ".env.local")
        load_env_file(base / ".env")


# ---------------------------------------------------------------------------
# DFS API fetching  (replaces old Firestore path)
# ---------------------------------------------------------------------------

def _read_str(obj: Dict[str, Any], *keys: str) -> Optional[str]:
    for k in keys:
        v = obj.get(k)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return None


def _read_num(obj: Dict[str, Any], *keys: str) -> Optional[float]:
    for k in keys:
        v = obj.get(k)
        if isinstance(v, (int, float)):
            return float(v)
        if isinstance(v, str):
            try:
                return float(v)
            except ValueError:
                pass
    return None


def _read_num_list(obj: Dict[str, Any], *keys: str) -> List[int]:
    for k in keys:
        v = obj.get(k)
        if isinstance(v, list):
            out: List[int] = []
            for item in v:
                if isinstance(item, (int, float)):
                    out.append(int(item))
                elif isinstance(item, str):
                    try:
                        out.append(int(float(item)))
                    except ValueError:
                        pass
                elif isinstance(item, dict):
                    gid = _read_num(item, "id", "playerId")
                    if gid is not None:
                        out.append(int(gid))
            return out
    return []


def fetch_weekly_entries_from_api(contest_id: str) -> List[Dict]:
    """Fetch contest data from Ben's DFS API and compute fantasy point totals."""
    base_url = (os.environ.get("NEXT_PUBLIC_DFS_API_BASE_URL") or "").strip().rstrip("/")
    api_path_tpl = (
        os.environ.get("NEXT_PUBLIC_DFS_API_PATH") or "/contests/{contestId}/live"
    ).strip()
    api_contest_id = (os.environ.get("NEXT_PUBLIC_DFS_CONTEST_ID") or contest_id).strip()
    api_key = (os.environ.get("NEXT_PUBLIC_DFS_API_KEY") or "").strip() or None
    api_key_header = (os.environ.get("NEXT_PUBLIC_DFS_API_KEY_HEADER") or "x-api-key").strip()

    if not base_url:
        raise RuntimeError(
            "NEXT_PUBLIC_DFS_API_BASE_URL is not set. "
            "Create a .env.local with the DFS API credentials."
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

    golfers_raw: List[Dict] = (
        payload.get("golfers")
        or payload.get("playersPool")
        or payload.get("athletes")
        or []
    )
    players_raw: List[Dict] = (
        payload.get("players")
        or payload.get("entries")
        or payload.get("leaderboard")
        or []
    )

    golfer_pts: Dict[int, float] = {}
    for g in golfers_raw:
        gid = _read_num(g, "id", "playerId")
        fp = _read_num(g, "fantasyPoints", "points", "dkPoints")
        if gid is not None:
            golfer_pts[int(gid)] = fp if fp is not None else 0.0

    league_dir = resolve_league_dir()
    name_map = _load_entry_user_map(league_dir)

    entries: List[Dict] = []
    for p in players_raw:
        name = _read_str(p, "name", "entryName") or "unknown"
        lineup_ids = _read_num_list(p, "lineupGolferIds", "lineup")
        total = sum(golfer_pts.get(gid, 0.0) for gid in lineup_ids)

        entry_id = name_map.get(name, {}).get("entryId", name)
        entry_name = name_map.get(name, {}).get("entryName", name)

        entries.append({
            "entryId": entry_id,
            "entryName": entry_name,
            "weeklyFantasyPoints": round(total, 1),
        })

    return entries


def _load_entry_user_map(league_dir: Path) -> Dict[str, Dict[str, str]]:
    """Build a lookup from preferredName -> {entryId, entryName} using entry-users.json."""
    path = league_dir / "entry-users.json"
    if not path.exists():
        return {}
    users = json.loads(path.read_text(encoding="utf-8"))
    result: Dict[str, Dict[str, str]] = {}
    for u in users:
        preferred = u.get("preferredName", "")
        entry_name = u.get("entryName", "")
        if preferred and entry_name:
            slug = entry_name.lower().replace(" ", "-")
            result[preferred] = {"entryId": slug, "entryName": entry_name}
            result[entry_name] = {"entryId": slug, "entryName": entry_name}
    return result


# ---------------------------------------------------------------------------
# Firestore fetching
# ---------------------------------------------------------------------------

def _resolve_credentials_path() -> Optional[str]:
    """Return the service account JSON path, or None if not configured."""
    cred = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
    if cred:
        p = Path(cred)
        if not p.is_absolute():
            for base in (Path.cwd(), Path.cwd().parent):
                candidate = base / cred
                if candidate.exists():
                    return str(candidate.resolve())
        return cred
    sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
    if sa_json:
        return None  # inline JSON, handled by caller
    return None


def fetch_weekly_entries_from_firestore(contest_id: str) -> List[Dict]:
    """Pull lineups + golfer scores from Firestore and compute fantasy totals."""
    try:
        from google.cloud import firestore as gc_firestore
    except ImportError:
        raise RuntimeError(
            "google-cloud-firestore is not installed.\n"
            "Run: pip install google-cloud-firestore google-auth"
        )

    cred_path = _resolve_credentials_path()
    if cred_path:
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = cred_path

    if not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS") and not os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON"):
        raise RuntimeError(
            "No Firebase credentials found.\n"
            "Set GOOGLE_APPLICATION_CREDENTIALS=./your-service-account.json in .env"
        )

    import warnings
    with warnings.catch_warnings():
        warnings.filterwarnings("ignore")
        db = gc_firestore.Client()

    print(f"Reading Firestore: test_scores/{contest_id}/golfers ...")
    scores_ref = db.collection("test_scores").document(contest_id).collection("golfers")
    golfer_pts: Dict[str, float] = {}
    for snap in scores_ref.stream():
        data = snap.to_dict()
        fp = data.get("fantasyPoints", 0)
        golfer_pts[snap.id] = float(fp) if fp is not None else 0.0

    if not golfer_pts:
        raise RuntimeError(
            f"No golfer scores found in test_scores/{contest_id}/golfers.\n"
            "Has the tournament data been synced to Firestore?"
        )
    print(f"  Found {len(golfer_pts)} golfer scores")

    print(f"Reading Firestore: test_lineups/{contest_id}/entries ...")
    entries_ref = db.collection("test_lineups").document(contest_id).collection("entries")
    results: List[Dict] = []
    for snap in entries_ref.stream():
        data = snap.to_dict()
        entry_id = snap.id
        entry_name = data.get("entryName") or entry_id
        lineup_ids = data.get("lineupGolferIds", [])
        total = sum(golfer_pts.get(gid, 0.0) for gid in lineup_ids)
        results.append({
            "entryId": entry_id,
            "entryName": entry_name if entry_name else entry_id,
            "weeklyFantasyPoints": round(total, 1),
        })

    if not results:
        raise RuntimeError(
            f"No lineup entries found in test_lineups/{contest_id}/entries.\n"
            "Has this contest been set up in Firestore?"
        )

    results.sort(key=lambda r: r["weeklyFantasyPoints"], reverse=True)
    print(f"  Found {len(results)} entries")
    return results


def _load_all_entries(league_dir: Path) -> List[Dict[str, str]]:
    """Load all configured entries so late joiners can appear with zero totals."""
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


# ---------------------------------------------------------------------------
# Ranking / standings computation  (unchanged logic)
# ---------------------------------------------------------------------------

def rank_entries(entries: List[Dict]) -> List[Dict]:
    eligible_rows = [r for r in entries if not bool(r.get("noRank"))]
    sorted_rows = sorted(eligible_rows, key=lambda r: r["weeklyFantasyPoints"], reverse=True)
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


def load_weekly_files(weekly_dir: Path) -> List[Tuple[int, Dict]]:
    weekly_dir.mkdir(parents=True, exist_ok=True)
    rows: List[Tuple[int, Dict]] = []
    for fp in sorted(weekly_dir.glob("*.json")):
        obj = json.loads(fp.read_text(encoding="utf-8"))
        rows.append((int(obj["eventId"]), obj))
    rows.sort(key=lambda r: r[0])
    return rows


def compute_standings(
    schedule: List[ScheduleEvent],
    weekly_data: List[Tuple[int, Dict]],
    all_entries: Optional[List[Dict[str, str]]] = None,
) -> List[Dict]:
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

    for seed in all_entries or []:
        rec = by_entry[seed["entryId"]]
        rec["entryId"] = seed["entryId"]
        rec["entryName"] = seed["entryName"]

    present_event_ids = {event_id for event_id, _ in weekly_data}

    for event_id, weekly in weekly_data:
        event = event_by_id.get(event_id)
        tier = event.tier if event else "Standard"
        entries = weekly.get("entries", [])
        ranked = rank_entries(entries)

        n = len(ranked)
        if n == 0:
            continue
        fee_per_user = FIRST_WEEK_OF_QUARTER_FEE if event_id in first_week_ids else WEEKLY_FEE
        scale = n / BASE_POOL_SIZE
        base_payouts = WEEKLY_PAYOUTS.get(tier, WEEKLY_PAYOUTS["Standard"])
        payouts = [int(p * scale) for p in base_payouts]

        tie_groups: Dict[int, List[int]] = defaultdict(list)
        for i, row in enumerate(ranked):
            tie_groups[row["rank"]].append(i)

        for i, row in enumerate(ranked):
            entry_id = row["entryId"]
            rec = by_entry[entry_id]
            rec["entryId"] = entry_id
            rec["entryName"] = row["entryName"]
            rec["weeksEntered"] += 1
            rec["weeklyFantasyPointsTotal"] += row["weeklyFantasyPoints"]
            rec["fees"] += fee_per_user

            rnk = row["rank"]
            group_indices = tie_groups[rnk]
            group_size = len(group_indices)

            points_table = CHAMPIONSHIP_POINTS_BY_TIER.get(tier, CHAMPIONSHIP_POINTS_BY_TIER["Standard"])
            pts_sum = sum(
                points_table[idx] if idx < len(points_table) else 0
                for idx in group_indices
            )
            rec["championshipPoints"] += pts_sum / group_size

            pay_sum = sum(
                payouts[idx] if idx < len(payouts) else 0
                for idx in group_indices
            )
            rec["weeklyPayouts"] += pay_sum / group_size

            if rnk == 1:
                rec["weeklyWins"] += 1

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
            ranked = rank_entries(weekly.get("entries", []))
            active_players = max(active_players, len(ranked))
            q_tie_groups: Dict[int, List[int]] = defaultdict(list)
            for idx, row in enumerate(ranked):
                q_tie_groups[row["rank"]].append(idx)
            for row in ranked:
                rnk = row["rank"]
                group_indices = q_tie_groups[rnk]
                group_size = len(group_indices)
                points_table = CHAMPIONSHIP_POINTS_BY_TIER.get(tier, CHAMPIONSHIP_POINTS_BY_TIER["Standard"])
                pts_sum = sum(
                    points_table[idx] if idx < len(points_table) else 0
                    for idx in group_indices
                )
                quarter_points[row["entryId"]] += pts_sum / group_size

        quarter_sorted = sorted(quarter_points.items(), key=lambda it: it[1], reverse=True)
        q_scale = active_players / BASE_POOL_SIZE
        q_payouts = [int(p * q_scale) for p in QUARTERLY_PAYOUTS]
        for idx, (entry_id, _pts) in enumerate(quarter_sorted[:5]):
            by_entry[entry_id]["weeklyPayouts"] += q_payouts[idx]

    previous_week_finish_by_entry: Dict[str, int] = {}
    if len(weekly_data) >= 2:
        _prev_event_id, prev_week_obj = weekly_data[-2]
        prev_ranked = rank_entries(prev_week_obj.get("entries", []))
        for row in prev_ranked:
            previous_week_finish_by_entry[row["entryId"]] = int(row["rank"])

    rows = []
    for rec in by_entry.values():
        rows.append(
            {
                "rank": 0,
                "entryId": rec["entryId"],
                "entryName": rec["entryName"],
                "championshipPoints": rec["championshipPoints"] if rec["championshipPoints"] % 1 else int(rec["championshipPoints"]),
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


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Recompute league standings. Use --contest-id to pull from Firestore first."
    )
    parser.add_argument(
        "--contest-id", default=None,
        help="Contest id (e.g. week-3-players). Pulls scores from Firestore, writes weekly JSON, recomputes standings.",
    )
    parser.add_argument(
        "--ben", action="store_true",
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


def _run_official_mode(league_dir: Path, schedule: List[ScheduleEvent]) -> None:
    """Recompute standings from weekly-scores/ (no network required)."""
    weekly_dir = league_dir / "weekly-scores"
    weekly_data = load_weekly_files(weekly_dir)
    if not weekly_data:
        print("No weekly-scores/*.json files found. Nothing to do.")
        return

    all_entries = _load_all_entries(league_dir)
    standings = compute_standings(schedule, weekly_data, all_entries=all_entries)
    standings_path = league_dir / "season-standings.json"
    standings_path.write_text(json.dumps(standings, indent=2), encoding="utf-8")
    print(f"Wrote {standings_path}  ({len(standings)} entries)")


def _run_firestore_mode(
    args: argparse.Namespace,
    league_dir: Path,
    schedule: List[ScheduleEvent],
) -> None:
    """Pull from Firestore, write weekly-scores/{contestId}.json, recompute standings."""
    contest_id = args.contest_id
    event_id = args.event_id if args.event_id is not None else infer_event_id(contest_id)
    event = next((e for e in schedule if e.id == event_id), None)
    if event is None:
        raise RuntimeError(f"event id {event_id} not found in schedule.json")

    entries = fetch_weekly_entries_from_firestore(contest_id)
    if not entries:
        raise RuntimeError("No entries returned from Firestore.")

    all_known = _load_all_entries(league_dir)
    known_ids = {e["entryId"] for e in all_known}
    found_ids = {e["entryId"] for e in entries}
    missing = known_ids - found_ids
    if missing:
        print(f"\n  WARNING: {len(missing)} known entry(s) NOT in Firestore for this contest:")
        for m in sorted(missing):
            print(f"    - {m}")
        print("  If they played, add them manually to the weekly JSON before committing.\n")

    weekly_dir = league_dir / "weekly-scores"
    weekly_dir.mkdir(parents=True, exist_ok=True)
    weekly_path = weekly_dir / f"{contest_id}.json"
    weekly_obj = {"eventId": event.id, "eventName": event.name, "entries": entries}
    weekly_path.write_text(json.dumps(weekly_obj, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {weekly_path}  ({len(entries)} entries)")

    weekly_data = load_weekly_files(weekly_dir)
    all_entries = _load_all_entries(league_dir)
    standings = compute_standings(schedule, weekly_data, all_entries=all_entries)
    standings_path = league_dir / "season-standings.json"
    standings_path.write_text(json.dumps(standings, indent=2), encoding="utf-8")
    print(f"Wrote {standings_path}  ({len(standings)} entries)")


def _run_ben_mode(
    args: argparse.Namespace,
    league_dir: Path,
    schedule: List[ScheduleEvent],
) -> None:
    """Fetch from DFS API, write ben-weekly-scores/, compute ben-standings.json."""
    event_id = args.event_id if args.event_id is not None else infer_event_id(args.contest_id)
    event = next((e for e in schedule if e.id == event_id), None)
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

    weekly_data = load_weekly_files(ben_dir)
    all_entries = _load_all_entries(league_dir)
    standings = compute_standings(schedule, weekly_data, all_entries=all_entries)
    standings_path = league_dir / "ben-standings.json"
    standings_path.write_text(json.dumps(standings, indent=2), encoding="utf-8")
    print(f"Wrote {standings_path}  ({len(standings)} entries)")


if __name__ == "__main__":
    main()
