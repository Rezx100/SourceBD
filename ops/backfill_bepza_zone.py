"""F12 Phase 4 + F12.5: derive suppliers.bepza_zone.

Pass 1 (F12.4): Case-insensitive regex on suppliers.address_raw (fall-back city).
Pass 2 (F12.5): For suppliers still NULL after Pass 1, scan their own
source_records.fields::text payloads with the same regex, restricted to verified
tiers (tier1_gov / tier2_industry / tier3_cert / tier4_brand / tier5_regulatory).
Tier 6 cross-check is excluded (Hard Rule #6: no Tier 6 source alone).

Closed list of the 8 active BEPZA Export Processing Zones. Idempotent. Fill-only
(Hard Rule #5): never overwrites an existing bepza_zone value.

Patterns are deliberately strict ("X EPZ" or the standard initialism) — we never
guess from a zone-adjacent city alone (Savar/Narayanganj/Chittagong contain both
EPZ and non-EPZ factories).
"""
from __future__ import annotations

import os
import re
import sys
import time

import psycopg


ZONES: list[tuple[str, list[str]]] = [
    ("Chittagong EPZ", [r"\bchittagong\s+epz\b", r"\bcepz\b", r"\bchittagong\s+export\s+processing\s+zone\b"]),
    ("Dhaka EPZ",      [r"\bdhaka\s+epz\b",      r"\bdepz\b", r"\bdhaka\s+export\s+processing\s+zone\b"]),
    ("Comilla EPZ",    [r"\b(comilla|cumilla)\s+epz\b", r"\bcmepz\b"]),
    ("Mongla EPZ",     [r"\bmongla\s+epz\b",     r"\bmepz\b"]),
    ("Ishwardi EPZ",   [r"\bishwardi\s+epz\b",   r"\biepz\b"]),
    ("Uttara EPZ",     [r"\buttara\s+epz\b",     r"\buepz\b", r"\bnilphamari\s+epz\b"]),
    ("Adamjee EPZ",    [r"\badamjee\s+epz\b",    r"\baepz\b"]),
    ("Karnaphuli EPZ", [r"\bkarnaphuli\s+epz\b", r"\bkepz\b"]),
]
COMPILED = [(name, [re.compile(p, re.IGNORECASE) for p in pats]) for name, pats in ZONES]


def detect(text: str | None) -> str | None:
    if not text:
        return None
    for name, pats in COMPILED:
        for p in pats:
            if p.search(text):
                return name
    return None


def main() -> int:
    dsn = os.environ.get("SUPABASE_DB_URL")
    if not dsn:
        print("ERROR: SUPABASE_DB_URL not set", file=sys.stderr)
        return 1

    with psycopg.connect(dsn, prepare_threshold=None, autocommit=False) as conn:
        with conn.cursor() as cur:
            cur.execute("select count(*) filter (where bepza_zone is not null), count(*) from public.suppliers")
            pre_filled, total = cur.fetchone()
            print(f"pre : {pre_filled:>6d} / {total:>6d}  ({100*pre_filled/total:.2f}%)", flush=True)

            cur.execute("""
                select id, address_raw, city
                  from public.suppliers
                 where bepza_zone is null
                   and (address_raw is not null or city is not null)
            """)
            rows = cur.fetchall()

        t0 = time.monotonic()
        updates: dict[str, list[str]] = {}
        for sid, addr, city in rows:
            z = detect(addr) or detect(city)
            if z:
                updates.setdefault(z, []).append(sid)

        total_updates = sum(len(v) for v in updates.values())
        with conn.cursor() as cur:
            for zone, ids in updates.items():
                cur.execute(
                    """update public.suppliers
                          set bepza_zone = %s,
                              updated_at = now()
                        where id = any(%s)
                          and bepza_zone is null""",
                    (zone, ids),
                )
        conn.commit()
        print(f"pass1 updated {total_updates} rows in {time.monotonic()-t0:.2f}s", flush=True)
        for k, v in sorted(updates.items(), key=lambda x: -len(x[1])):
            print(f"  {k:<20s} {len(v):>5d}")

        # ---- Pass 2 (F12.5): scan source_records.fields of verified tiers --
        with conn.cursor() as cur:
            cur.execute("""
                select sr.supplier_id, sr.fields::text
                  from public.source_records sr
                  join public.suppliers s on s.id = sr.supplier_id
                 where s.bepza_zone is null
                   and sr.status = 'active'
                   and sr.source_tier in (
                     'tier1_gov','tier2_industry','tier3_cert',
                     'tier4_brand','tier5_regulatory'
                   )
            """)
            t2 = time.monotonic()
            picked: dict[str, str] = {}
            scanned = 0
            for sid, payload in cur:
                scanned += 1
                if sid in picked:
                    continue
                z = detect(payload)
                if z:
                    picked[sid] = z

        pass2_updates: dict[str, list[str]] = {}
        for sid, z in picked.items():
            pass2_updates.setdefault(z, []).append(sid)
        pass2_total = sum(len(v) for v in pass2_updates.values())
        with conn.cursor() as cur:
            for zone, ids in pass2_updates.items():
                cur.execute(
                    """update public.suppliers
                          set bepza_zone = %s,
                              updated_at = now()
                        where id = any(%s)
                          and bepza_zone is null""",
                    (zone, ids),
                )
        conn.commit()
        print(
            f"pass2 scanned {scanned} verified source_records rows, "
            f"updated {pass2_total} suppliers in {time.monotonic()-t2:.2f}s",
            flush=True,
        )
        for k, v in sorted(pass2_updates.items(), key=lambda x: -len(x[1])):
            print(f"  {k:<20s} {len(v):>5d}")

        with conn.cursor() as cur:
            cur.execute("select count(*) filter (where bepza_zone is not null), count(*) from public.suppliers")
            post_filled, _ = cur.fetchone()
            print(f"post: {post_filled:>6d} / {total:>6d}  ({100*post_filled/total:.2f}%)", flush=True)

    return 0


if __name__ == "__main__":
    sys.exit(main())
