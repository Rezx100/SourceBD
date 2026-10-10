"""Paid check: does Volza's live export search honour country and buyer filters? (founder: up to $3, 11 Oct 2026)

Export searches on suppliers we already know (Sep 2024 - Aug 2026), production key, so it runs only
with --apply (the founder runs it). Spend control is the live sample's (ops/volza_live_sample.py): cap
checked before every call, Volza's credit header watched. Each result keeps what Volza echoed back
(api_request_details). The echo has no field for supplier_company_id or the *_search_type settings
(Volza's spec), so for those a missing echo proves nothing; the count does.

  1-2  destination_country_name Germany / United Kingdom                          (1 record each)
  3-4  buyer_name NEW YORKER / H&M (contains)                                      (1 record each)
  5    supplier_company_id: Aboni's two IDs on the free company list, no name      (1 record)
  6    no filter, 10 records: which country and buyer fields a record really carries
  7    buyer_name Tesco Stores, verbatim from a record                             (1 record)
  8    buyer_name PRIMARK with no supplier: does one brand search list its suppliers?   (1 record)
  --rules (batch 0, report section 11; asked separately, inside the same $3 cap):
  9    remove_duplicate_shipments on Aboni: are our counts inflated by duplicates?
  10   the 27 EU countries in one call on Aboni: one market call instead of 27
  11-17 supplier_name_search_type exact on five names that swept in 2-4 exporters, case, and two names
       without "Ltd" (is exact honoured at all?)

  python ops/volza_filter_test.py                     # the plan, no key read, no calls
  python ops/volza_filter_test.py --apply             # run 1-8 (cap $3); results in etl/raw/volza/filter_test.json
  python ops/volza_filter_test.py --rules --apply     # 1-17, same cap and file
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent))

from volza_export_dryrun import RAW  # noqa: E402
from volza_live_sample import Live, Stop, account_used  # noqa: E402

OUT = RAW / "filter_test.json"
CAP = 3.0
# The first run (11 Oct 2026) spent $1.00 by Volza's header, $0.55 of it on the 10-record call that the
# guard stopped before its result was saved; it counts toward the $3. The second run (batch 0, 11 Oct)
# took the counter from 35.650 to 36.650: $1.00 more, so $2.00 of the $3 is spent.
PRIOR = 2.00
NAME = "Aboni Knit Wear"
TESTS: list[tuple[str, dict[str, Any], int]] = [
    # Field names from Volza's published spec (backend.volza.com/swagger/v1/swagger.json, read 11 Oct
    # 2026): destination_country_name, buyer_name + buyer_name_search_type, supplier_company_id. The
    # sandbox test of 10 Oct used destination_country and volza_company_id, which are not fields.
    ("country Germany", {"supplier_name": [NAME], "destination_country_name": ["Germany"]}, 1),
    ("country United Kingdom", {"supplier_name": [NAME], "destination_country_name": ["United Kingdom"]}, 1),
    ("buyer NEW YORKER", {"supplier_name": [NAME], "buyer_name": ["NEW YORKER"], "buyer_name_search_type": "contains"}, 1),
    ("buyer H&M", {"supplier_name": [NAME], "buyer_name": ["H&M"], "buyer_name_search_type": "contains"}, 1),
    # The free company list's IDs for Aboni (11 Oct): does an ID match the shipments filed as "Aboni Knit Wear Ltd"?
    ("supplier IDs from the free list", {"supplier_company_id": [70153649, 33452214]}, 1),
    ("no filter, 10 records", {"supplier_name": [NAME]}, 10),
    # NEW YORKER found 0 although the biggest shipment's buyer is "NEW YORKER FASHION LOGISTICS INT L":
    # one more buyer test with a name taken verbatim from a record (the UK top shipment, 11 Oct).
    ("buyer Tesco Stores", {"supplier_name": [NAME], "buyer_name": ["Tesco Stores"]}, 1),
    ("brand only PRIMARK", {"buyer_name": ["PRIMARK"], "buyer_name_search_type": "contains"}, 1),
]
# Spellings from Volza's free country list (countries/list, 11 Oct 2026).
EU = ["Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czech Republic", "Denmark", "Estonia", "Finland",
      "France", "Germany", "Greece", "Hungary", "Ireland", "Italy", "Latvia", "Lithuania", "Luxembourg", "Malta",
      "Netherlands", "Poland", "Portugal", "Romania", "Slovakia", "Slovenia", "Spain", "Sweden"]
EXACT = {"supplier_name_search_type": "exact"}
# Batch 0 (report section 11). Known answers to compare with: Aboni 4,652 shipments, 1 exporter; Germany
# alone 81; the other names' starts-with counts are in etl/raw/volza/live_sample.jsonl.
RULES: list[tuple[str, dict[str, Any], int]] = [
    ("duplicates removed", {"supplier_name": [NAME], "remove_duplicate_shipments": True}, 1),
    ("country EU-27 in one call", {"supplier_name": [NAME], "destination_country_name": EU}, 1),
    ("exact Utah", {"supplier_name": ["Utah Fashions Ltd"], **EXACT}, 1),  # 2 exporters, 4,568
    ("exact Utah upper case", {"supplier_name": ["UTAH FASHIONS LTD"], **EXACT}, 1),
    ("exact Square Apparels", {"supplier_name": ["Square Apparels Ltd", "Square Apparels Limited",
                                                 "Square Apparels Ltd."], **EXACT}, 1),  # 3 exporters, 2,830
    ("exact Sisal", {"supplier_name": ["Sisal Composite Ltd", "Sisal Composite Ltd."], **EXACT}, 1),  # 4, 1,660
    ("exact Rhythm", {"supplier_name": ["Rhythm Fashion Ltd", "Rhythm Fashion Limited",
                                        "Rhythm Fashion Ltd."], **EXACT}, 1),  # 4 exporters, 147
    # Batch 0 gave every exact search the starts-with totals, so is "exact" honoured at all? Without the
    # "Ltd" no shipment carries these names exactly: honoured means 0, ignored means 4,568 and 4,652.
    ("exact Utah without Ltd", {"supplier_name": ["Utah Fashions"], **EXACT}, 1),
    ("exact Aboni without Ltd", {"supplier_name": [NAME], **EXACT}, 1),
]


def worst(records: int) -> float:
    return 0.10 + 0.05 * records


def save(out: list[dict[str, Any]], label: str, sent: dict[str, Any], r: httpx.Response) -> None:
    """Everything Volza sent back, saved per call before the next one can stop the run: the whole body
    (echo, summary, every record, pagination, errors), the credit headers and when it was fetched."""
    try:
        d = r.json()
    except ValueError:
        d = {"_text": r.text}
    out.append({"label": label, "sent": json.loads(r.request.content), "filters": sent, "status": r.status_code,
                "fetched_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
                "credit": {k: v for k, v in r.headers.items() if k.lower().startswith("x-credit")},
                "response": d})
    OUT.write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    d = d if isinstance(d, dict) else {}
    recs = d.get("api_records") or []
    s = d.get("api_summary") or {}
    print(f"{label:32} {r.status_code} shipments={s.get('count_of_shipments')} "
          f"exporters={s.get('count_of_suppliers')} records={len(recs)}")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--apply", action="store_true", help="spend real credit (production key)")
    p.add_argument("--rules", action="store_true", help="add the batch 0 checks (9-17)")
    a = p.parse_args()
    logging.getLogger("httpx").setLevel(logging.WARNING)
    tests = TESTS + (RULES if a.rules else [])
    out: list[dict[str, Any]] = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else []
    # a rate-limited or failed call is kept for the record but asked again; a 200 or a 400 is an answer
    done = {r["label"] for r in out if r["status"] in (200, 400)}
    todo = [t for t in tests if t[0] not in done]
    if not a.apply:
        for label, f, n in todo:
            print(f"  {label:32} {json.dumps(f)[:110]}  up to ${worst(n):.2f}")
        print(f"{len(todo)} searches to go, worst case ${sum(worst(n) for _, _, n in todo):.2f}, "
              f"hard cap ${CAP:.2f} including ${PRIOR:.2f} already spent. Pass --apply to run.")
        return
    v = Live(CAP, PRIOR, start_used=account_used())
    try:
        for label, f, n in todo:
            v.records = n  # the guard's worst case follows the records this call asks for
            v.last_response = None
            try:
                v.search(f)
            finally:  # also when the header check stops the run after Volza billed the call
                if v.last_response is not None:
                    save(out, label, f, v.last_response)
    except Stop as e:
        print(f"STOPPED: {e}")
    print(f"calls={v.calls}; spent: our tally ${v.tally:.2f}, by Volza's header ${v.header_spent:.2f} -> {OUT}")


if __name__ == "__main__":
    main()
