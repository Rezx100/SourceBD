"""Read-only audit of the Barikoi geocode cache. Makes no Barikoi calls.

Reports how many cached rows are keyed canonically versus by the pre-REZ-28 raw
spelling, then runs the real `select_pending` against real production data, so
the pending count it prints is exactly what the next geocode run would spend.

It also prints what the *old* pending scan would have said, which is the cheapest
way to confirm the two key paths still agree. They must: when they diverged, the
gap between those two numbers was the recurring Rupantor bill.

Reads over PostgREST rather than the Postgres wire, because the pooler is not
reachable from a dev machine on ports 5432 or 6543.
"""
import httpx

from etl.core.config import settings
from etl.jobs.barikoi_geocode import normalize_key, select_pending

BASE = settings.supabase_url.rstrip("/")
H = {
    "apikey": settings.supabase_service_role_key,
    "Authorization": f"Bearer {settings.supabase_service_role_key}",
}
PAGE = 1000


def raw_key(address: str) -> str:
    """Exactly what the old SQL computed: lower + collapse whitespace, no lexicon."""
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
    cache = fetch_all(c, "address_geocodes", "address_norm,address_raw")
    print(f"address_geocodes rows: {len(cache)}")

    canonical_keyed = raw_keyed = untouched = odd = 0
    for row in cache:
        stored = row.get("address_norm") or ""
        original = row.get("address_raw") or ""
        canon = normalize_key(original)
        rawk = raw_key(original)
        if canon == rawk:
            untouched += 1           # lexicon does not affect this address
        elif stored == canon:
            canonical_keyed += 1     # written post-REZ-28: was being re-billed
        elif stored == rawk:
            raw_keyed += 1           # written pre-REZ-28: orphaned from the app
        else:
            odd += 1

    print("\n-- cache key generations --")
    print(f"  lexicon-irrelevant (never affected) : {untouched}")
    print(f"  canonical-keyed  (was re-billed)    : {canonical_keyed}")
    print(f"  raw-keyed        (orphaned, no pin) : {raw_keyed}")
    print(f"  unclassified                        : {odd}")

    # What the next run will actually do, using the shipped logic.
    cached_keys = {r["address_norm"] for r in cache if r.get("address_norm")}
    candidates: list[str] = []
    try:
        rows = fetch_all(c, "v_supplier_addresses", "address")
        candidates += [r["address"] for r in rows if r.get("address")]
        print(f"\nv_supplier_addresses candidates: {len(rows)}")
    except httpx.HTTPStatusError as exc:
        print(f"\nv_supplier_addresses not readable over REST: {exc.response.status_code}")
    rows = fetch_all(c, "suppliers", "address_raw")
    candidates += [r["address_raw"] for r in rows if r.get("address_raw")]
    print(f"suppliers.address_raw candidates: {len(rows)}")

    candidates = [a for a in candidates if len(a.strip()) >= 8]
    candidates.sort(key=len, reverse=True)
    pending = select_pending(candidates, cached_keys, None)

    print("\n-- what the next run would do --")
    print(f"  distinct candidate addresses : {len(candidates)}")
    print(f"  pending after the fix        : {len(pending)}")
    print(f"  Rupantor calls (2 per addr)  : {len(pending) * 2}")

    # The same figure under the OLD scan, for comparison.
    old_pending = [a for a in candidates if raw_key(a) not in cached_keys]
    old_seen: set[str] = set()
    old_unique = []
    for a in old_pending:
        if raw_key(a) in old_seen:
            continue
        old_seen.add(raw_key(a))
        old_unique.append(a)
    print(f"  (old scan would have said     : {len(old_unique)} -> {len(old_unique) * 2} calls)")
