"""Tradeline: the Volza customs-exports fetcher for EPB suppliers, in four commands.

  python ops/tradeline.py status                       # what is fetched, shown, waiting, spent; no calls
  python ops/tradeline.py review                       # the yes/no page at http://127.0.0.1:8770
  python ops/tradeline.py fetch 200 --cap 130          # the plan and its expected cost; no calls
  python ops/tradeline.py fetch 200 --cap 130 --apply  # the founder runs it: spends at most $130
  python ops/tradeline.py load                         # dry run of today's results into production
  python ops/tradeline.py load --apply                 # the founder runs it

fetch: the founder's yeses first, then unchecked EPB suppliers in a fixed order; a supplier is never
paid for twice. It keeps to 40 requests a minute (Volza allows 50 for the whole key) and waits out a
429 for up to 15 minutes before stopping. Stopped or not, running the same command again resumes:
N and the cap count this day's results file (etl/raw/volza/launch_<date>.jsonl).
Unsure matches wait for the founder in `review`; a yes is fetched in the next `fetch`.
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from collections import Counter
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from volza_company_list import load  # noqa: E402
from volza_export_dryrun import RAW  # noqa: E402
from volza_launch import plan, run_batch, started  # noqa: E402
from volza_load_sample import shown_class  # noqa: E402
from volza_review import decisions, newest, queue, serve  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
# ponytail: .env sits in the main checkout; a worktree without one reads it from there
ENV_DIR = ROOT if (ROOT / ".env").exists() else Path(r"E:\SourceBD")


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
    a = p.parse_args()
    logging.getLogger("httpx").setLevel(logging.WARNING)
    if a.cmd == "status":
        status()
    elif a.cmd == "review":
        serve(a.port)
    elif a.cmd == "fetch":
        path = today_file()
        prior = sum(r["cost"] for r in load(path))
        run_batch(path, started(path) + a.companies, prior + a.cap, a.apply)
    else:
        path = a.file or max(RAW.glob("launch_*.jsonl"), key=lambda x: x.stat().st_mtime)
        os.chdir(ENV_DIR)  # the loader reads .env from the current folder
        sys.argv = ["volza_load_sample.py", "--file", str(path.resolve())] + (["--apply"] if a.apply else [])
        from volza_load_sample import main as load_main

        load_main()


if __name__ == "__main__":
    main()
