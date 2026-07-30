"""Re-key `address_geocodes` rows whose key predates the REZ-28 place lexicon.

Ran against production 30 Jul 2026: 3,344 rows updated, 0 failures. Left behind
are 61 rows that cannot be re-keyed — 54 because a canonical row already holds
the key and serves the app, 7 because two rows collapse onto one key. Both are
harmless duplicates, not gaps.

Why re-key rather than let the geocode backfill re-resolve them: `address_raw`
is stored alongside the key, so the canonical key is recomputable for every row
without asking Barikoi anything. That makes this free and instant where the
backfill would have cost 6,688 Rupantor calls for the same result. It is also
reversible without this script — the previous key is `raw_key(address_raw)` for
every row — though `--apply` still writes an exact rollback record first.

Idempotent: a second run finds nothing left to do. Pass --apply to write;
without it nothing is modified.
"""
import sys

import httpx

from etl.core.config import settings
from etl.jobs.barikoi_geocode import normalize_key

BASE = settings.supabase_url.rstrip("/")
H = {
    "apikey": settings.supabase_service_role_key,
    "Authorization": f"Bearer {settings.supabase_service_role_key}",
}
PAGE = 1000
APPLY = "--apply" in sys.argv


def raw_key(address: str) -> str:
    return " ".join(address.strip().lower().split())


def fetch_all(client: httpx.Client, table: str, select: str) -> list[dict]:
    out: list[dict] = []
    offset = 0
    while True:
        r = client.get(
            f"{BASE}/rest/v1/{table}",
            params={"select": select, "limit": PAGE, "offset": offset},
        )
        r.raise_for_status()
        batch = r.json()
        out.extend(batch)
        if len(batch) < PAGE:
            return out
        offset += PAGE


with httpx.Client(timeout=60, headers=H) as c:
    rows = fetch_all(
        c, "address_geocodes", "id,address_norm,address_raw,latitude,longitude"
    )
    print(f"rows: {len(rows)}")

    existing = {r["address_norm"] for r in rows}
    stale = [r for r in rows if r["address_norm"] != normalize_key(r["address_raw"] or "")]
    print(f"rows whose key is not canonical: {len(stale)}")

    # Prefer keeping a row that actually resolved, when two collapse to one key.
    def resolved(r: dict) -> bool:
        return r.get("latitude") is not None and r.get("longitude") is not None

    stale.sort(key=lambda r: (not resolved(r), r["address_norm"]))

    plan: list[tuple[str, str, str]] = []   # (id, old_key, new_key)
    blocked_by_existing = 0
    blocked_by_sibling = 0
    claimed: set[str] = set()

    for r in stale:
        target = normalize_key(r["address_raw"] or "")
        if not target:
            continue
        if target in existing:
            # Some other row already holds the canonical key: the app can find
            # that one, so this row is redundant rather than broken.
            blocked_by_existing += 1
            continue
        if target in claimed:
            blocked_by_sibling += 1
            continue
        claimed.add(target)
        plan.append((r["id"], r["address_norm"], target))

    with_coords = sum(1 for r in stale if resolved(r))
    print(f"  of those, rows holding coordinates : {with_coords}")
    print(f"  of those, negative cache entries   : {len(stale) - with_coords}")
    print("\n-- re-key plan --")
    print(f"  rows that can be re-keyed cleanly     : {len(plan)}")
    print(f"  skipped, canonical key already exists : {blocked_by_existing}")
    print(f"  skipped, two rows want the same key    : {blocked_by_sibling}")
    print("\n  sample (old key -> new key):")
    for _id, old, new in plan[:5]:
        print(f"    {old[:58]}\n      -> {new[:58]}")

    if not APPLY:
        print(f"\nDRY RUN. Re-run with --apply to update {len(plan)} rows.")
        raise SystemExit(0)

    # Belt and braces. Rollback does not actually need this file — the previous
    # key is `raw_key(address_raw)` for every row, recomputable at any time — but
    # an exact record costs nothing and removes the need to trust that claim.
    import json
    import tempfile
    from pathlib import Path

    backup = Path(tempfile.gettempdir()) / "sourcebd-address-norm-rollback.json"
    backup.write_text(
        json.dumps([{"id": i, "address_norm": old} for i, old, _ in plan], indent=1),
        encoding="utf-8",
    )
    print(f"rollback record written to {backup}")

    print(f"\napplying {len(plan)} updates ...")
    done = failed = 0
    for _id, _old, new in plan:
        r = c.patch(
            f"{BASE}/rest/v1/address_geocodes",
            params={"id": f"eq.{_id}"},
            headers={"Content-Type": "application/json", "Prefer": "return=minimal"},
            json={"address_norm": new},
        )
        if r.status_code < 300:
            done += 1
        else:
            failed += 1
            if failed <= 3:
                print(f"  FAILED {r.status_code}: {r.text[:120]}")
        if done and done % 500 == 0:
            print(f"  {done}/{len(plan)} ...")
    print(f"\nupdated: {done}   failed: {failed}")
