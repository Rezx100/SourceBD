"""Paid check: does Volza's live export search honour country and buyer filters? (founder: up to $3, 11 Oct 2026)

Seven export searches on Aboni Knitwear (Sep 2024 - Aug 2026), production key, so it runs only with
--apply (the founder runs it). Spend control is the live sample's (ops/volza_live_sample.py): cap
checked before every call, Volza's credit header watched. Each result keeps what Volza echoed back
(api_request_details): a filter missing from the echo was ignored, and its count is the unfiltered one.

  1-2  destination_country_name Germany / United Kingdom                          (1 record each)
  3-4  buyer_name NEW YORKER / H&M (contains)                                      (1 record each)
  5    supplier_company_id: Aboni's two IDs on the free company list, no name      (1 record)
  6    no filter, 10 records: which country and buyer fields a record really carries
  7    buyer_name PRIMARK with no supplier: does one brand search list its suppliers?   (1 record)

  python ops/volza_filter_test.py            # the plan, no key read, no calls
  python ops/volza_filter_test.py --apply    # run it (cap $3); results in etl/raw/volza/filter_test.json
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

from volza_export_dryrun import HS, MIN_GAP, RAW  # noqa: E402
import volza_live_sample  # noqa: E402
from volza_live_sample import WINDOW, Live, Stop, account_used  # noqa: E402

OUT = RAW / "filter_test.json"
CAP = 3.0
# The first run (11 Oct 2026) spent $1.00 by Volza's header, $0.55 of it on the 10-record call that the
# guard stopped before its result was saved; it counts toward the $3.
PRIOR = 1.00
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


def worst(records: int) -> float:
    return 0.10 + 0.05 * records


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--apply", action="store_true", help="spend real credit (production key)")
    a = p.parse_args()
    logging.getLogger("httpx").setLevel(logging.WARNING)
    total = sum(worst(n) for _, _, n in TESTS)
    if not a.apply:
        for label, f, n in TESTS:
            print(f"  {label:32} {json.dumps(f)}  up to ${worst(n):.2f}")
        print(f"{len(TESTS)} searches, worst case ${total:.2f}, hard cap ${CAP:.2f}. Pass --apply to run.")
        return
    out: list[dict[str, Any]] = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else []
    done = {r["label"] for r in out}
    v = Live(CAP, PRIOR, start_used=account_used())
    try:
        for label, f, n in TESTS:
            if label in done:
                continue
            if v.spent + worst(n) > CAP + 1e-9:
                raise Stop(f"cap: ${v.spent:.2f} spent, next call up to ${worst(n):.2f}")
            body = {"hsn_code": HS, "start_date": WINDOW[0], "end_date": WINDOW[1], "max_count_per_page": n,
                    "sort_by": "trade_value_usd", "sort_order": "DESC", **f}
            wait = MIN_GAP - (time.monotonic() - v.last)
            if wait > 0:
                time.sleep(wait)
            v.last = time.monotonic()
            r = v.http.post("/bangladesh-exports", json=body)
            v.calls += 1
            data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {"_text": r.text[:300]}
            recs = (data.get("api_records") or []) if isinstance(data, dict) else []
            v.tally += (0.10 + 0.05 * len(recs)) if r.status_code == 200 else 0.0
            out.append({"label": label, "sent": f, "status": r.status_code,
                        "echo": data.get("api_request_details") if isinstance(data, dict) else None,
                        "summary": data.get("api_summary") if isinstance(data, dict) else None,
                        "records": recs, "error": data.get("error") if isinstance(data, dict) else None})
            s = (data.get("api_summary") or {}) if isinstance(data, dict) else {}
            print(f"{label:32} {r.status_code} shipments={s.get('count_of_shipments')} "
                  f"exporters={s.get('count_of_suppliers')} records={len(recs)}")
            # The live sample's per-call guard assumes one record; this call may ask for ten. The result
            # is saved above first, so a stop here never throws away what was paid for.
            volza_live_sample.WORST_CALL = worst(n)
            v._read_headers(r)
    except Stop as e:
        print(f"STOPPED: {e}")
    finally:
        RAW.mkdir(parents=True, exist_ok=True)
        OUT.write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"calls={v.calls}; spent: our tally ${v.tally:.2f}, by Volza's header ${v.header_spent:.2f} -> {OUT}")


if __name__ == "__main__":
    main()
