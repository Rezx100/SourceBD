"""Load the 200-supplier live sample (etl/raw/volza/live_sample.jsonl) into volza_export_checks.

Needs migration 0137. No Volza calls, no credit. Without --apply it prints what it would write;
--apply upserts one row per supplier (matches and "nothing found" alike, so a fetch within the year
can skip them) through the REST API with the service key. The founder runs --apply.

  python ops/volza_load_sample.py            # dry run
  python ops/volza_load_sample.py --apply    # write
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent))

from volza_live_sample import OUT, WINDOW  # noqa: E402

# The sample ran 10 Oct 2026, about 23:30-23:36 Dhaka time; the file's last write stands in for
# every row (the per-call times were not kept). Rows expire one year later, to the second.
TOP_KEYS = ("shipment_date", "hsn_code", "product_description", "buyer_name", "destination_country",
            "trade_value_usd", "unit_rate_usd", "unit")


def rows(recs: list[dict[str, Any]], fetched_at: datetime) -> list[dict[str, Any]]:
    expires = fetched_at.replace(year=fetched_at.year + 1) - timedelta(seconds=1)
    out = []
    for r in recs:
        hit = bool(r["shipments"])
        out.append({
            "supplier_id": r["id"],
            "name_searched": r["matched_variant"] or (r["tried"][0][0] if r["tried"] else r["name"]),
            "window_start": WINDOW[0],
            "window_end": WINDOW[1],
            "shipments": r["shipments"],
            "exporters_matched": r["suppliers"],
            "match_class": r["class"] if hit else "none",
            "volza_supplier_name": r["volza_supplier"],
            "fob_usd": round(r["fob_usd"], 2) if hit and r.get("fob_usd") is not None else None,
            "buyers": r.get("buyers") if hit else None,
            "top_shipments": [{k: r["top"].get(k) for k in TOP_KEYS}] if hit and r.get("top") else [],
            "fetched_at": fetched_at.isoformat(),
            "expires_at": expires.isoformat(),
        })
    return out


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--apply", action="store_true", help="write to production")
    a = p.parse_args()
    logging.getLogger("httpx").setLevel(logging.WARNING)
    recs = [json.loads(line) for line in OUT.read_text(encoding="utf-8").splitlines()]
    fetched_at = datetime.fromtimestamp(OUT.stat().st_mtime, tz=timezone.utc).replace(microsecond=0)
    out = rows(recs, fetched_at)
    print(f"{len(out)} rows, fetched_at {out[0]['fetched_at']}, expires_at {out[0]['expires_at']}")
    print("by class", dict(Counter(r["match_class"] for r in out)),
          "| shown to paying buyers (exact):", sum(1 for r in out if r["match_class"] == "exact"))
    for r in [r for r in out if r["match_class"] == "exact"][:2]:
        print(json.dumps(r, ensure_ascii=False))
    if not a.apply:
        print("dry run; pass --apply to write")
        return
    from etl.core.config import settings

    key = settings.supabase_service_role_key
    r = httpx.post(f"{settings.supabase_url}/rest/v1/volza_export_checks?on_conflict=supplier_id",
                   json=out, timeout=60,
                   headers={"apikey": key, "Authorization": f"Bearer {key}",
                            "Prefer": "resolution=merge-duplicates,return=minimal"})
    r.raise_for_status()
    print(f"wrote {len(out)} rows")


if __name__ == "__main__":
    main()
