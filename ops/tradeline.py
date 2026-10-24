"""Tradeline: the Volza customs-exports fetcher for EPB suppliers, in four commands.

  python ops/tradeline.py status                       # what is fetched, shown, waiting, spent; no calls
  python ops/tradeline.py review                       # the yes/no page at http://127.0.0.1:8770
  python ops/tradeline.py fetch 200 --cap 130          # the plan and its expected cost; no calls
  python ops/tradeline.py fetch 200 --cap 130 --apply  # the founder runs it: spends at most $130
  python ops/tradeline.py load                         # dry run of today's results into production
  python ops/tradeline.py load --apply                 # the founder runs it
  python ops/tradeline.py recheck --cap 50             # not-found suppliers under spellings not yet tried; no calls
  python ops/tradeline.py recheck --cap 50 --apply     # the founder runs it
  python ops/tradeline.py save                         # copy every results file to the server (0156)
  python ops/tradeline.py restore                      # write lost results files back from the server

Every paid result is also kept in production (volza_raw_results, 0156) for its year: fetch and review
save there on their own, and the server refuses to delete a row before its year is up.

fetch: the founder's yeses first, then unchecked EPB suppliers in a fixed order; a supplier is never
paid for twice. It keeps to 40 requests a minute (Volza allows 50 for the whole key) and waits out a
429 for up to 15 minutes before stopping. Stopped or not, running the same command again resumes:
N and the cap count this day's results file (etl/raw/volza/launch_<date>.jsonl).
Unsure matches wait for the founder in `review`; a yes is fetched in the next `fetch`.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from collections import Counter
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

from volza_company_list import load  # noqa: E402
from volza_export_dryrun import RAW, _rest_all  # noqa: E402
from volza_launch import plan, recheck_plan, rest, run_batch, started  # noqa: E402
from volza_load_sample import one_year_on, shown_class  # noqa: E402
from volza_review import REVIEW, decisions, newest, queue, serve  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
# ponytail: .env sits in the main checkout; a worktree without one reads it from there
ENV_DIR = ROOT if (ROOT / ".env").exists() else Path(r"E:\SourceBD")


def kept_rows(path: Path) -> list[dict[str, Any]]:
    """One row per complete supplier in a results file (the last line wins), for volza_raw_results (0156)."""
    mtime = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
    if path.name == REVIEW.name:  # the founder's answers, kept beside the results they were about
        name, recs = "review.jsonl", [{"id": k, **d} for k, d in decisions().items()]
    else:
        name, recs = path.name, [r for r in {r["id"]: r for r in load(path)}.values() if not r.get("partial")]
    out = []
    for r in recs:
        at = datetime.fromisoformat(r["fetched_at"]) if r.get("fetched_at") else mtime
        if one_year_on(at) > datetime.now(timezone.utc):  # past its year the licence says it goes
            out.append({"results_file": name, "supplier_id": r["id"], "fetched_at": at.isoformat(),
                        "expires_at": one_year_on(at).isoformat(), "record": r})
    return out


def save(paths: list[Path]) -> None:
    """Copy results to production, where 0156 keeps them for their year; rows already there stay as they are."""
    http = rest()
    if http.get("/volza_raw_results", params={"select": "supplier_id", "limit": 0}).status_code == 404:
        print("not saved to the server: 0156 is not applied yet; the files stay on this computer")
        return
    # the licence's year: only expired rows go, and 0156 refuses any other delete
    http.delete("/volza_raw_results", params={"expires_at": f"lte.{datetime.now(timezone.utc).isoformat()}"},
                headers={"Prefer": "return=minimal"}).raise_for_status()
    for path in paths:
        rows = kept_rows(path)
        for i in range(0, len(rows), 200):
            http.post("/volza_raw_results", params={"on_conflict": "results_file,supplier_id"}, json=rows[i:i + 200],
                      headers={"Prefer": "resolution=ignore-duplicates,return=minimal"}).raise_for_status()
        print(f"saved {path.name}: {len(rows)} suppliers on the server")


def restore() -> None:
    """Write back any result the server holds and this folder lacks; never overwrites a line."""
    by_file: dict[str, list[dict[str, Any]]] = {}
    for r in _rest_all(rest(), "/volza_raw_results?select=results_file,record&order=results_file,supplier_id"):
        by_file.setdefault(r["results_file"], []).append(r["record"])
    RAW.mkdir(parents=True, exist_ok=True)
    for name, recs in by_file.items():
        if name == "review.jsonl":
            have = decisions()
            missing = {r["id"]: {k: v for k, v in r.items() if k != "id"} for r in recs if r["id"] not in have}
            if missing:
                REVIEW.write_text(json.dumps({**missing, **have}, indent=1, ensure_ascii=False), encoding="utf-8")
        else:
            path = RAW / name
            have = {r["id"] for r in load(path)} if path.exists() else set()
            missing = [r for r in recs if r["id"] not in have]
            with path.open("a", encoding="utf-8") as f:
                f.writelines(json.dumps(r, ensure_ascii=False) + "\n" for r in missing)
        print(f"{name}: {len(recs)} on the server, {len(missing)} written back")


def today_file() -> Path:
    return RAW / f"launch_{date.today().isoformat()}.jsonl"


def status() -> None:
    rows = newest().values()
    c = Counter("none" if not r["shipments"] else shown_class(r) for r in rows)
    todo = sum(1 for r in plan() if "variants" in r)
    said = Counter(d["decision"] for d in decisions().values())
    print(f"checked {len(rows)} suppliers: {c['exact']} shown, {c['none']} not on Volza, "
          f"{c['ambiguous'] + c['likely']} unsure")
    print(f"waiting for your answer: {len(queue()) - sum(1 for r in queue() if r['id'] in decisions())}; "
          f"answered yes {said['all'] + said['exact']}, no {said['no']}")
    print(f"unchecked EPB suppliers left: {todo} (spend: see Volza's dashboard, the only full count)")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("status")
    sub.add_parser("review").add_argument("--port", type=int, default=8770)
    f = sub.add_parser("fetch")
    f.add_argument("companies", type=int, help="new EPB suppliers this run (0: only the yeses)")
    f.add_argument("--cap", type=float, required=True, help="dollars this run may spend")
    f.add_argument("--apply", action="store_true")
    ld = sub.add_parser("load")
    ld.add_argument("--file", type=Path, help="a results file (default: the newest)")
    ld.add_argument("--apply", action="store_true")
    rc = sub.add_parser("recheck", help="search the not-found suppliers again under spellings not yet tried")
    rc.add_argument("--cap", type=float, required=True, help="dollars this run may spend")
    rc.add_argument("--apply", action="store_true")
    sub.add_parser("save").add_argument("files", type=Path, nargs="*", help="results files (default: all of them)")
    sub.add_parser("restore")
    a = p.parse_args()
    logging.getLogger("httpx").setLevel(logging.WARNING)
    if a.cmd == "status":
        status()
    elif a.cmd == "review":
        serve(a.port)
        if REVIEW.exists():
            save([REVIEW])
    elif a.cmd == "fetch":
        path = today_file()
        prior = sum(r["cost"] for r in load(path))
        try:
            run_batch(path, started(path) + a.companies, prior + a.cap, a.apply)
        finally:  # stopped or not, what was paid for goes to the server
            if a.apply and path.exists():
                save([path])
    elif a.cmd == "recheck":
        # a "launch_" file, so the review page and the plan read its results like any fetch's
        path = RAW / f"launch_recheck_{date.today().isoformat()}.jsonl"
        prior = sum(r["cost"] for r in load(path))
        try:
            run_batch(path, None, prior + a.cap, a.apply, rows=recheck_plan())
        finally:
            if a.apply and path.exists():
                save([path])
    elif a.cmd == "save":
        save(a.files or sorted(RAW.glob("*.jsonl")) + ([REVIEW] if REVIEW.exists() else []))
    elif a.cmd == "restore":
        restore()
    else:
        path = a.file or max(RAW.glob("launch_*.jsonl"), key=lambda x: x.stat().st_mtime)
        os.chdir(ENV_DIR)  # the loader reads .env from the current folder
        sys.argv = ["volza_load_sample.py", "--file", str(path.resolve())] + (["--apply"] if a.apply else [])
        from volza_load_sample import main as load_main

        load_main()


if __name__ == "__main__":
    main()
