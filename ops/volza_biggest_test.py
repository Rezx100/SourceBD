"""Biggest-orders test: would the reveal read better as a supplier's 25 biggest recent shipments?

The reveal buys the 25 latest shipments. For a large exporter those are one day's consignments of a
few orders (Ananta, 12 Oct 2026: 25 records, all 31 Aug, 4 buyers). Volza has no "one per order"
option and its records carry no order number (spec read 12 Oct 2026), so this asks for the 25 biggest
shipments of the last six months instead and merges the consignments of one order into one line:
same day, same buyer, same destination, same product.

One search per supplier, the same one that defines it (its exact-name search if it had one), 25
records, duplicates removed. At most $1.35 each; Volza does not charge again for a record already
bought. Spends real credit with the production key, so it runs only with --apply (the founder runs
it). A supplier already in the results file is not fetched again.

  python ops/volza_biggest_test.py ananta-garments moon-readywears            # the plan, no calls
  python ops/volza_biggest_test.py ananta-garments moon-readywears --apply    # run it (cap $3)
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

from volza_company_list import load  # noqa: E402
from volza_export_dryrun import RAW  # noqa: E402
from volza_launch import LATEST  # noqa: E402
from volza_live_sample import WINDOW, Live, Stop, account_used  # noqa: E402
from volza_review import newest  # noqa: E402

OUT = RAW / "biggest_test.jsonl"
CAP = 3.0
RECORDS = 25  # the reveal's 25
SINCE = "2026-03-01"  # six months to the end of the live window
BIGGEST = {"sort_by": "trade_value_usd", "sort_order": "DESC"}


def order_key(rec: dict[str, Any]) -> tuple[str, str, str, str]:
    """Consignments of one order share the day, the buyer, the destination and the product.

    The product is compared without its quantity note ("BOYS WOVEN TROUSER= 124 PACK").
    """
    product = re.sub(r"\s+", " ", (rec.get("product_description") or "").split("=")[0]).strip().upper()
    buyer = re.sub(r"\s+", " ", rec.get("buyer_name") or "").strip().upper()
    return ((rec.get("shipment_date") or "")[:10], buyer, (rec.get("destination_country") or "").upper(), product)


def merge(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """One line per order, biggest first: the first record's text, the summed value and weight."""
    lines: dict[tuple[str, str, str, str], dict[str, Any]] = {}
    for rec in records:
        line = lines.setdefault(order_key(rec), {**rec, "consignments": 0, "trade_value_usd": 0.0, "gross_weight_kg": 0.0})
        line["consignments"] += 1
        line["trade_value_usd"] += rec.get("trade_value_usd") or 0.0
        line["gross_weight_kg"] += rec.get("gross_weight_kg") or 0.0
    return sorted(lines.values(), key=lambda x: -x["trade_value_usd"])


def filters(r: dict[str, Any]) -> dict[str, Any]:
    """The search that defines the supplier, as ops/volza_launch.py's latest refetch builds it."""
    ex = next((c for c in r["calls"] if c["kind"] == "exact"), None)
    main = {k: x for k, x in ex["filters"].items() if k not in LATEST} if ex else {"supplier_name": [r["matched_variant"]]}
    return {**main, **BIGGEST, "start_date": SINCE, "end_date": WINDOW[1], "remove_duplicate_shipments": True}


def show(name: str, records: list[dict[str, Any]]) -> None:
    lines = merge(records)
    days = {(x.get("shipment_date") or "")[:10] for x in records}
    print(f"\n{name}: {len(records)} records -> {len(lines)} orders, {len(days)} days "
          f"({min(days, default='')} to {max(days, default='')}), {len({k[1] for k in map(order_key, records)})} buyers")
    for x in lines:
        print(f"  {(x.get('shipment_date') or '')[:10]}  ${x['trade_value_usd']:>10,.0f}  x{x['consignments']:<2} "
              f"{(x.get('buyer_name') or '')[:32]:32}  {(x.get('destination_country') or '')[:14]:14}  "
              f"{(x.get('product_description') or '')[:40]}")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("slugs", nargs="+", help="suppliers shown today, by slug")
    p.add_argument("--apply", action="store_true", help="spend real credit (production key)")
    a = p.parse_args()
    logging.getLogger("httpx").setLevel(logging.WARNING)
    by_slug = {r["slug"]: r for r in newest().values() if r["shipments"]}
    missing = [s for s in a.slugs if s not in by_slug]
    if missing:
        p.error(f"not fetched, or nothing found: {missing}")
    done = {r["slug"]: r for r in load(OUT)} if OUT.exists() else {}
    todo = [s for s in a.slugs if s not in done]
    if not a.apply:
        print(f"the {RECORDS} biggest shipments since {SINCE} for {len(todo)} suppliers ({len(a.slugs) - len(todo)} done), "
              f"one search each, worst case ${len(todo) * (0.10 + 0.05 * RECORDS):.2f}, cap ${CAP:.2f}. Pass --apply to run.")
        for s in todo:
            print(f"  {by_slug[s]['name']}: {json.dumps(filters(by_slug[s]))}")
    else:
        prior = sum(r["cost"] for r in done.values())
        v = Live(CAP, prior, start_used=account_used(), records=RECORDS)
        with OUT.open("a", encoding="utf-8") as out:
            for s in todo:
                r = by_slug[s]
                try:
                    st, data, cost = v.search(filters(r))
                except Stop as e:
                    print(f"STOPPED at {r['name']!r}: {e}")
                    break
                if st != 200:
                    print(f"  skipped {r['name']!r}: {st} {str(data)[:200]}")
                    continue
                done[s] = {"id": r["id"], "slug": s, "name": r["name"], "filters": filters(r), "cost": round(cost, 3),
                           "response": data}
                out.write(json.dumps(done[s], ensure_ascii=False) + "\n")
                out.flush()
        print(f"calls={v.calls}; spent: our tally ${v.tally - prior:.2f}, by Volza's header ${v.header_spent - prior:.2f} "
              f"-> {OUT.name}")
    for s in a.slugs:
        if s in done:
            show(done[s]["name"], done[s]["response"].get("api_records") or [])


if __name__ == "__main__":
    main()
