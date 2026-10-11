"""Launch fetch, package B (report section 11): preview, exact-name narrowing, four market calls.

Spends real credit with the production key, so it runs only with --apply (the founder runs it), one
numbered batch at a time, each approved separately; the cap is per batch and a rerun resumes it.

Order: (1) the suppliers already held: markets (and the small-orders search) for the exact ones, one exact-name search for the ones
whose name swept in other "exporters" (batch 0: that is usually one company under several Volza IDs);
(2) EPB-registered suppliers not yet checked, in a fixed shuffled order, until the cap.

Per supplier: starts-with search on each of our names until one finds shipments; if it swept in
more than one exporter, one exact search on our legal name in its suffix forms (only that counts
from then on); if exact and shipping to 2+ countries, four searches filtered to the UK, the US, the
27 EU countries and Canada; if every shipment is counted in pieces, one more search for those under
1,000 pieces (a small-orders signal). One record per call, biggest shipment first, duplicates removed. Volza
does not charge again for a record already bought, so repeat calls cost $0.10.

Everything Volza sends is kept: each call's whole response and credit headers go into the row.
A row is written per supplier, also when the cap stops it halfway (then marked "partial" and
fetched again on resume).

  python ops/volza_launch.py --batch 1            # the plan, no key read, no calls
  python ops/volza_launch.py --batch 1 --apply    # run it (cap $50)
Then store: python ops/volza_load_sample.py --file etl/raw/volza/launch_1.jsonl [--apply] (markets stay
in the raw file until a column holds them).
"""

from __future__ import annotations

import argparse
import json
import logging
import random
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

from volza_company_list import load  # noqa: E402
from volza_export_dryrun import CANDIDATES, RAW, classify, normalize_company_name, shipments, summary_suppliers  # noqa: E402
from volza_filter_test import EU  # noqa: E402
from volza_live_sample import Live, Stop, account_used  # noqa: E402

CAP_LIMIT = 50.0  # each batch is approved at up to $50
SEED = 20261011
MARKETS = [("United Kingdom", ["United Kingdom"]), ("United States", ["United States"]), ("EU", EU),
           ("Canada", ["Canada"])]
SMALL_PCS = 1000  # "N% of its shipments were under 1,000 pieces" (founder, 11 Oct 2026)
SUFFIXES = ("", " Ltd", " Ltd.", " Limited", " (Pvt) Ltd", " (Pvt.) Ltd.", " Pvt Ltd", " Pvt. Ltd.",
            " Private Limited")


def out_path(batch: int) -> Path:
    return RAW / f"launch_{batch}.jsonl"


def legal_forms(base: str, seen: str | None) -> list[str]:
    """Our name with each legal suffix, plus Volza's own spelling when it is the same name."""
    forms = [base + s for s in SUFFIXES]
    if seen and normalize_company_name(seen) == normalize_company_name(base) and seen not in forms:
        forms.append(seen)
    return forms


def plan() -> list[dict[str, Any]]:
    """Held suppliers first (markets, narrowing), then unchecked EPB suppliers in a fixed order."""
    held = {r["id"]: r for f in ("live_sample.jsonl", "batch_1.jsonl", "refetch_1.jsonl") for r in load(RAW / f)}
    done = {r["id"] for f in sorted(RAW.glob("launch_*.jsonl")) for r in load(f) if not r.get("partial")}
    rows = [{"id": r["id"], "slug": r["slug"], "name": r["name"], "held": r} for r in held.values()
            if r["class"] in ("exact", "ambiguous") and r["id"] not in done]
    cands = [c for c in json.loads(CANDIDATES.read_text(encoding="utf-8")) if c["epb_6162"] and c["variants"]]
    cands.sort(key=lambda c: c["id"])
    random.Random(SEED).shuffle(cands)
    rows += [{"id": c["id"], "slug": c["slug"], "name": c["company_name"], "variants": c["variants"]}
             for c in cands if c["id"] not in held and c["id"] not in done]
    return rows


class Rejected(Exception):
    """Volza refused this supplier's search (400): skip the supplier, keep the batch going."""


def new_rec(row: dict[str, Any]) -> dict[str, Any]:
    return {"id": row["id"], "slug": row["slug"], "name": row["name"], "tried": [], "calls": [], "shipments": 0,
            "suppliers": 0, "cost": 0.0, "matched_variant": None, "volza_supplier": None, "class": "none",
            "partial": True, "fetched_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat()}


def fetch(v: Live, row: dict[str, Any], rec: dict[str, Any]) -> None:
    """Fills rec in place, so the caller writes whatever was paid for, whatever stops it."""

    def call(kind: str, filters: dict[str, Any]) -> dict[str, Any]:
        v.last_response = None
        try:
            st, data, _ = v.search({**filters, "remove_duplicate_shipments": True})
        finally:  # kept, and counted, even when the guard stops right after Volza billed it
            r = v.last_response
            if r is not None:
                body = _json(r)
                rec["calls"].append({"kind": kind, "filters": filters, "status": r.status_code,
                                     "credit": {k: x for k, x in r.headers.items() if k.lower().startswith("x-credit")},
                                     "response": body})
                if r.status_code == 200:
                    recs = (body.get("api_records") or []) if isinstance(body, dict) else []
                    rec["cost"] = round(rec["cost"] + 0.10 + 0.05 * len(recs), 3)
        if st != 200:  # never recorded as "nothing found"; the row stays partial and is asked again
            raise Rejected(f"{st} for {row['name']!r} ({kind})")
        return data

    def take(data: dict[str, Any], name: str, label: str) -> None:
        top = (data.get("api_records") or [{}])[0]
        s = data.get("api_summary") or {}
        rec["tried"].append([label, 200, shipments(data), summary_suppliers(data)])
        rec.update(shipments=shipments(data), suppliers=summary_suppliers(data), matched_variant=name,
                   volza_supplier=top.get("supplier_name"), fob_usd=s.get("sum_of_trade_value_usd"),
                   buyers=s.get("count_of_buyers"), summary=s, top=top)

    held = row.get("held")
    main: dict[str, Any] | None = None
    if held and held["class"] == "exact":  # preview held; only the markets are missing
        rec.update({k: held.get(k) for k in ("tried", "shipments", "suppliers", "matched_variant", "volza_supplier",
                                             "fob_usd", "buyers", "summary", "top", "fetched_at", "class")})
        rec["fetched_at"] = held.get("fetched_at") or rec["fetched_at"]
        main = {"supplier_name": [held["matched_variant"]]}
    else:
        names = [held["matched_variant"]] if held else row["variants"]
        for name in names:
            if held:  # its starts-with result is held; go straight to the exact search
                # the sample kept no summary: rebuild the two counts the flow reads from what it kept
                data = {"api_summary": held.get("summary") or {"count_of_shipments": held["shipments"],
                                                               "count_of_suppliers": held["suppliers"],
                                                               "sum_of_trade_value_usd": held.get("fob_usd"),
                                                               "count_of_buyers": held.get("buyers")},
                        "api_records": [held.get("top") or {"supplier_name": held["volza_supplier"]}]}
                take(data, name, name)
            else:
                main = {"supplier_name": [name]}
                data = call("preview", main)
                take(data, name, name)
            if rec["shipments"]:
                break
        if rec["shipments"] and rec["suppliers"] > 1:
            main = {"supplier_name": legal_forms(rec["matched_variant"], rec["volza_supplier"]),
                    "supplier_name_search_type": "exact"}
            data = call("exact", main)
            if shipments(data):
                take(data, rec["matched_variant"], "exact:" + rec["matched_variant"])
                rec["suppliers"] = 1  # every shipment in it carries our legal name
            rec["exact_check"] = {"shipments": shipments(data), "exporter_ids": summary_suppliers(data)}
        rec["class"] = classify(row["name"], rec["volza_supplier"], rec["shipments"], rec["suppliers"])
        if rec["class"] == "ambiguous":  # the exact search found none of it under our name
            main = None
    countries = (rec.get("summary") or {}).get("count_of_unique_destination_countries") or 0
    if rec["class"] == "exact" and main and countries > 1:
        rec["markets"] = {}
        for label, names in MARKETS:
            data = call("market:" + label, {**main, "destination_country_name": names})
            s, top = data.get("api_summary") or {}, (data.get("api_records") or [None])[0]
            rec["markets"][label] = {"shipments": s.get("count_of_shipments"), "fob_usd": s.get("sum_of_trade_value_usd"),
                                     "buyers": s.get("count_of_buyers"), "top": top}
    # Small-orders signal (batch 0: the quantity filter works). Only when every shipment is counted in
    # pieces: a line declared in kilos (720 KGS = 4,292 pieces on Aboni's) would count as "small".
    summary = rec.get("summary") or {}
    if rec["class"] == "exact" and main and summary.get("count_of_units") == 1 and (rec.get("top") or {}).get("unit") == "PCS":
        data = call("small:under 1000 pcs", {**main, "quantity": {"operator": "lt", "value": SMALL_PCS}})
        rec["small_orders"] = {"under_pcs": SMALL_PCS, "shipments": shipments(data), "of": rec["shipments"]}
    rec["partial"] = False


def _json(r: Any) -> Any:
    try:
        return r.json()
    except ValueError:
        return {"_text": r.text}


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--batch", type=int, required=True)
    p.add_argument("--apply", action="store_true", help="spend real credit (production key)")
    a = p.parse_args()
    logging.getLogger("httpx").setLevel(logging.WARNING)
    path = out_path(a.batch)
    rows = plan()
    if not a.apply:
        held = [r for r in rows if r.get("held")]
        print(f"batch {a.batch}: {sum(1 for r in held if r['held']['class'] == 'exact')} held exact (markets), "
              f"{sum(1 for r in held if r['held']['class'] == 'ambiguous')} held ambiguous (exact search), then "
              f"{len(rows) - len(held)} unchecked EPB suppliers in order until the cap of ${CAP_LIMIT:.0f}. "
              "Pass --apply to run.")
        return
    prior = sum(r["cost"] for r in load(path))
    v = Live(CAP_LIMIT, prior, start_used=account_used())
    print(f"${prior:.2f} already spent in batch {a.batch}, cap ${CAP_LIMIT:.2f}")
    with path.open("a", encoding="utf-8") as out:
        for row in rows:
            rec = new_rec(row)
            try:
                fetch(v, row, rec)
            except Rejected as e:
                print(f"  skipped: {e}")
            except Stop as e:
                print(f"STOPPED at {row['name']!r}: {e}")
                break
            finally:  # whatever was paid for is written, whatever stopped it
                if rec["calls"] or not rec["partial"]:
                    out.write(json.dumps(rec, ensure_ascii=False) + "\n")
                    out.flush()
            if rec["partial"]:
                continue
            print(f"  {rec['class']:9} {rec['shipments']:>6} shipments  markets={','.join(rec.get('markets') or [])}  {row['name']}")
    recs = load(path)
    print(f"calls={v.calls}; spent this run: our tally ${v.tally - prior:.2f}, by Volza's header "
          f"${v.header_spent - prior:.2f}; batch total ${v.spent:.2f}; rows {len(recs)}, "
          f"exact {sum(1 for r in recs if r['class'] == 'exact' and not r.get('partial'))}")


if __name__ == "__main__":
    main()
