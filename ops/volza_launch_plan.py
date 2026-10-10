"""Price the launch fetch (report section 11). No Volza calls, no key; reads the saved results only.

Prices are Volza's published ones (docs.volza.com, read 11 Oct 2026): an export search is $0.10, charged
even when empty, plus $0.05 per shipment record returned (Bangladesh Export T3). Rates come from what
we already paid for: the 200-supplier sample (live_sample.jsonl), batch 1 (batch_1.jsonl) and the 47
exact rows fetched again with the whole preview (refetch_1.jsonl).

  python ops/volza_launch_plan.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from volza_export_dryrun import CANDIDATES, RAW  # noqa: E402

SEARCH, RECORD = 0.10, 0.05
MARKETS = 4  # United Kingdom, United States, the 27 EU countries in one call, Canada


def load(name: str) -> list[dict]:
    return [json.loads(line) for line in (RAW / name).read_text(encoding="utf-8").splitlines() if line.strip()]


def main() -> None:
    cands = {c["id"]: c for c in json.loads(CANDIDATES.read_text(encoding="utf-8"))}
    sample, batch, refetch = load("live_sample.jsonl"), load("batch_1.jsonl"), load("refetch_1.jsonl")
    done = {r["id"] for r in sample + batch}
    epb = [r for r in sample if cands[r["id"]]["epb_6162"]]
    hit = sum(1 for r in epb if r["shipments"]) / len(epb)
    amb = sum(1 for r in sample + batch if r["class"] == "ambiguous") / sum(1 for r in sample + batch if r["shipments"])
    one_country = sum(1 for r in refetch if r["summary"]["count_of_unique_destination_countries"] == 1) / len(refetch)
    todo_epb = sum(1 for c in cands.values() if c["epb_6162"] and c["id"] not in done)
    print(f"EPB suppliers not yet checked: {todo_epb}; EPB hit rate {hit:.0%}; names sweeping in other "
          f"exporters {amb:.0%} of hits; exact rows shipping to one country only {one_country:.0%}")

    def per_supplier(records: int, markets: bool, market_hit: float) -> float:
        preview = (1 - hit) * SEARCH + hit * (SEARCH + RECORD * records)
        narrow = hit * amb * (SEARCH + RECORD * records)  # one exact-name search per name that swept in others
        mk = hit * (1 - one_country) * MARKETS * (SEARCH + RECORD * market_hit) if markets else 0.0
        return preview + narrow + mk

    print("\nper EPB supplier, then all of them (market calls: every one empty .. every one a hit):")
    for label, records, markets in (("A  preview only (1 record)", 1, False),
                                    ("B  preview + 4 market calls", 1, True),
                                    ("C  10 largest shipments + 4 market calls", 10, True)):
        lo, hi = per_supplier(records, markets, 0.0), per_supplier(records, markets, 1.0)
        print(f"  {label:42} ${lo:.2f}-{hi:.2f}   x{todo_epb} = ${lo * todo_epb:,.0f}-{hi * todo_epb:,.0f}")
    shown = [r for r in sample + batch if r["class"] == "exact"]
    print(f"\nmarket calls for the {len(shown)} exact rows already held: up to "
          f"${len(shown) * (1 - one_country) * MARKETS * (SEARCH + RECORD):.2f}")
    print(f"Volza's company summary instead (top 10 buyers, countries, HS codes): $5 a supplier with "
          f"shipments, ${hit * todo_epb * 5:,.0f} for the EPB group alone")


if __name__ == "__main__":
    main()
