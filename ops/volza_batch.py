"""Paid batch 1: export search for the 43 non-EPB suppliers the free company list found (report §10).

Approved by the founder on 11 Oct 2026 for at most $6. Spends real credit with the production key,
so it runs only with --apply (the founder runs it). Reuses the live sample's spend control
(ops/volza_live_sample.py: cap checked before every call, Volza's credit header watched, errors
counted as the worst case). One export search per supplier, one shipment record, no retries:
the name searched is the one that found the supplier on the free list, so it contains-matches
Volza's spelling. Progress is saved per supplier; a rerun resumes and earlier spend counts.

  python ops/volza_batch.py              # what it would do; no key read, no calls
  python ops/volza_batch.py --apply      # run it (cap $6)
  python ops/volza_batch.py --refetch    # the 47 exact matches again, whole preview kept
                                         # (founder, 11 Oct 2026: up to $7.05); add --apply to run
Then store the results: python ops/volza_load_sample.py --file etl/raw/volza/batch_1.jsonl [--apply]
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

from volza_company_list import SCAN, load  # noqa: E402
from volza_export_dryrun import RAW, classify, pick, shipments, summary_suppliers  # noqa: E402
from volza_live_sample import OUT as LIVE  # noqa: E402
from volza_live_sample import WORST_CALL, Live, Stop, account_used  # noqa: E402

OUT = RAW / "batch_1.jsonl"
CAP_LIMIT = 6.0  # the founder's approved ceiling for this batch
# The first fetches kept only the card's fields; the 47 exact matches buyers see are fetched again
# with the same name, so their stored rows gain the whole summary and biggest shipment.
REFETCH_OUT = RAW / "refetch_1.jsonl"
REFETCH_CAP = 7.05
# Hand check (§10): narrow the names that share a word with other firms; Volza spells Zehad with "And".
NAMES = {
    "90250068": "Badhan Corporation",
    "7f0af70a": "Trutex Apparel Ltd",
    "9aeea779": "Zehad Corporation And Packaging",
}


def batch() -> list[dict[str, Any]]:
    return [{"id": r["id"], "slug": r["slug"], "name": r["name"],
             "search": NAMES.get(r["id"][:8], r["found_by"].split(":", 1)[1])}
            for r in load(SCAN) if r["class"] in ("exact", "close", "several")][:43]


def refetch() -> list[dict[str, Any]]:
    return [{"id": r["id"], "slug": r["slug"], "name": r["name"], "search": r["matched_variant"]}
            for f in (LIVE, OUT) for r in load(f) if r["class"] == "exact"]


def run(rows: list[dict[str, Any]], path: Path, cap: float) -> None:
    done = load(path)
    seen = {r["id"] for r in done}
    todo = [r for r in rows if r["id"] not in seen]
    v = Live(cap, sum(r["cost"] for r in done), start_used=account_used())
    print(f"{len(done)} done, {len(todo)} to go, ${v.spent:.2f} already spent, cap ${cap:.2f}")
    try:
        with path.open("a", encoding="utf-8") as out:
            for r in todo:
                st, data, cost = v.exports(r["search"])
                n, sup = shipments(data), summary_suppliers(data)
                top = (data.get("api_records") or [{}])[0] if n else {}
                s = data.get("api_summary") or {}
                rec = {"id": r["id"], "slug": r["slug"], "name": r["name"], "tried": [[r["search"], st, n, sup]],
                       "shipments": n, "suppliers": sup, "cost": round(cost, 3),
                       "matched_variant": r["search"] if n else None, "volza_supplier": pick(top, "supplier_name"),
                       "fob_usd": s.get("sum_of_trade_value_usd") if n else None,
                       "buyers": s.get("count_of_buyers") if n else None,
                       # the whole summary and record, kept raw: batch 1 dropped the port, weight, city and
                       # count fields, and getting them back means paying for the search again
                       "summary": s if n else None, "top": top if n else None,
                       "fetched_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat()}
                rec["class"] = classify(r["name"], rec["volza_supplier"], n, sup)
                out.write(json.dumps(rec, ensure_ascii=False) + "\n")
                out.flush()
    except Stop as e:
        print(f"STOPPED: {e}")
    recs = load(path)
    by: dict[str, int] = {}
    for r in recs:
        by[r["class"]] = by.get(r["class"], 0) + 1
    print(f"calls={v.calls}; spent: our tally ${v.tally:.2f}, by Volza's header ${v.header_spent:.2f}")
    print(f"checked {len(recs)}, with shipments {sum(1 for r in recs if r['shipments'])}, classes {by}")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--apply", action="store_true", help="spend real credit (production key)")
    p.add_argument("--refetch", action="store_true", help="the 47 exact matches again (cap $7.05)")
    a = p.parse_args()
    logging.getLogger("httpx").setLevel(logging.WARNING)
    rows, path, cap = (refetch(), REFETCH_OUT, REFETCH_CAP) if a.refetch else (batch(), OUT, CAP_LIMIT)
    if not a.apply:
        for r in rows:
            print(f"  {r['search']!r:45} {r['name']}")
        print(f"would search {len(rows)} suppliers, one call each, worst case ${len(rows) * WORST_CALL:.2f}, "
              f"hard cap ${cap:.2f}. Pass --apply to run.")
        return
    run(rows, path, cap)


if __name__ == "__main__":
    main()
