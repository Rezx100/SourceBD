"""Free test: does Volza's company list predict which suppliers have export shipments?

Sandbox key only, no credit. For each of the 200 suppliers in the paid live sample
(etl/raw/volza/live_sample.jsonl), look the name up in Volza's company list
(companies/search, Bangladesh, starts-with), then compare with what the paid export search found
for Sep 2024 - Aug 2026:

  - recall: of the suppliers that had shipments, how many the list finds (must be near all);
  - saving: of the suppliers with no shipments, how many the list does NOT find (skipped free);
  - spelling: suppliers with no shipments whose exact name IS on the list (a retry with Volza's
    spelling might find them);
  - new since 2021: of the suppliers with 2024-26 shipments, which had none in the sandbox's
    Jan-Mar 2021 window (from the saved sandbox run, match.jsonl), and whether the list still finds
    them. The sandbox allows 500 export searches in all; they were spent by 11 Oct 2026.

  python ops/volza_directory_test.py
"""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

from volza_export_dryrun import RAW, Volza  # noqa: E402
from volza_live_sample import OUT as LIVE  # noqa: E402

from etl.core.normalize import normalize_company_name  # noqa: E402

TEST = RAW / "directory_test.jsonl"


def lookup(v: Volza, name: str) -> dict[str, Any]:
    st, r = v.call("GET", "/companies/search", params={"company_name": name, "country": "Bangladesh", "page_size": 50})
    recs = (r.get("records") or []) if isinstance(r, dict) else []
    total = ((r.get("api_summary") or {}).get("total_matches") if isinstance(r, dict) else None) or len(recs)
    return {"status": st, "total": total, "names": sorted({x.get("company_name") or "" for x in recs})}


def main() -> None:
    logging.getLogger("httpx").setLevel(logging.WARNING)
    live = [json.loads(line) for line in LIVE.read_text(encoding="utf-8").splitlines()]
    cands = {c["id"]: c for c in json.loads((RAW / "candidates.json").read_text(encoding="utf-8"))}
    done = {}
    if TEST.exists():
        done = {json.loads(x)["id"]: json.loads(x) for x in TEST.read_text(encoding="utf-8").splitlines()}
    v = Volza()
    with TEST.open("a", encoding="utf-8") as out:
        for r in live:
            if r["id"] in done:
                continue
            ours = normalize_company_name(r["name"])
            looks = [dict(lookup(v, name), name=name) for name in cands[r["id"]]["variants"]]
            names = {n for lk in looks for n in lk["names"]}
            rec = {
                "id": r["id"], "name": r["name"], "live_shipments": r["shipments"], "live_class": r["class"],
                "listed": any(lk["total"] for lk in looks),
                "listed_exact": any(normalize_company_name(n) == ours for n in names),
                "volza_spellings": sorted(n for n in names if normalize_company_name(n) == ours)[:5],
                "lookups": looks,
            }
            out.write(json.dumps(rec, ensure_ascii=False) + "\n")
            out.flush()
            done[r["id"]] = rec
    recs = list(done.values())
    hit = [x for x in recs if x["live_shipments"]]
    miss = [x for x in recs if not x["live_shipments"]]
    # Q1 2021 shipments come from the sandbox run already saved (match.jsonl, the first 455 suppliers
    # by slug): the sandbox allows 500 export searches in all, and they are spent (11 Oct 2026).
    q1 = {json.loads(x)["id"]: json.loads(x)["shipments"] for x in (RAW / "match.jsonl").read_text(encoding="utf-8").splitlines()}
    known = [x for x in hit if x["id"] in q1]
    new = [x for x in known if q1[x["id"]] == 0]
    print(f"2021 known for {len(known)} of {len(hit)} suppliers with 2024-26 shipments")
    pct = lambda a, b: f"{a}/{b} ({a / max(b, 1):.0%})"  # noqa: E731
    print(f"calls {v.calls}, lookup errors {sum(1 for x in recs for lk in x['lookups'] if lk['status'] != 200)}")
    print("RECALL  with shipments, on the list (any):", pct(sum(x["listed"] for x in hit), len(hit)),
          "| exact name:", pct(sum(x["listed_exact"] for x in hit), len(hit)))
    print("SAVING  no shipments, NOT on the list:", pct(sum(not x["listed"] for x in miss), len(miss)),
          "| not exact:", pct(sum(not x["listed_exact"] for x in miss), len(miss)))
    print("SPELLING no shipments but exact name on the list:", sum(x["listed_exact"] for x in miss))
    print("NEW SINCE 2021  shipped 2024-26 but not Q1 2021:", len(new), "| on the list:",
          pct(sum(x["listed"] for x in new), len(new)), "| exact:", pct(sum(x["listed_exact"] for x in new), len(new)))
    for x in hit:
        if not x["listed_exact"]:
            print("  missed by exact list check:", x["name"], "| live class", x["live_class"], "| list has",
                  [n for lk in x["lookups"] for n in lk["names"]][:4])


if __name__ == "__main__":
    main()
