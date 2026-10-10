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


def one_year_on(t: datetime) -> datetime:
    """A second short of a year later (29 Feb counts to 28 Feb): inside the 0137 check."""
    try:
        return t.replace(year=t.year + 1) - timedelta(seconds=1)
    except ValueError:
        return t.replace(year=t.year + 1, day=28) - timedelta(seconds=1)


def rows(recs: list[dict[str, Any]], fetched_at: datetime) -> list[dict[str, Any]]:
    expires = one_year_on(fetched_at)
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
    if one_year_on(fetched_at) <= datetime.now(timezone.utc):
        raise SystemExit("this sample is over a year old; Volza's licence ends its storage. Nothing written.")
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
    http = httpx.Client(base_url=f"{settings.supabase_url}/rest/v1", timeout=60,
                        headers={"apikey": key, "Authorization": f"Bearer {key}"})
    # Expired rows go first: the licence's year is enforced by every writer, not only by reads.
    http.delete("/volza_export_checks", params={"expires_at": f"lte.{datetime.now(timezone.utc).isoformat()}"},
                headers={"Prefer": "return=minimal"}).raise_for_status()
    # Only suppliers that still exist: one merged away since the sample must not fail the rest.
    ids = ",".join(r["supplier_id"] for r in out)
    alive = {s["id"] for s in http.get("/suppliers", params={"select": "id", "id": f"in.({ids})"}).json()}
    keep = [r for r in out if r["supplier_id"] in alive]
    http.post("/volza_export_checks", params={"on_conflict": "supplier_id"}, json=keep,
              headers={"Prefer": "resolution=merge-duplicates,return=minimal"}).raise_for_status()
    print(f"wrote {len(keep)} rows; skipped {len(out) - len(keep)} suppliers no longer on file")


if __name__ == "__main__":
    main()
