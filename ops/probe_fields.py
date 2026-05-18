"""Probe source_records.fields shape for BKMEA + RSC to inform city backfill."""
from etl.core.db import db

with db.conn() as c, c.cursor() as cur:
    print("=== BKMEA sample fields keys ===")
    cur.execute(
        """select sr.fields from public.source_records sr
             join public.sources s on s.id = sr.source_id
            where s.code = 'BKMEA' limit 3"""
    )
    for r in cur.fetchall():
        f = r["fields"] or {}
        print("  keys:", sorted(f.keys()))
        # show city-likely keys
        for k in f:
            if any(t in k.lower() for t in ("city", "district", "address", "location", "area", "zone", "thana", "upazila")):
                v = f[k]
                if isinstance(v, str) and len(v) > 80:
                    v = v[:80] + "..."
                print(f"    {k} = {v!r}")
        print()

    print("=== RSC sample fields keys ===")
    cur.execute(
        """select sr.fields from public.source_records sr
             join public.sources s on s.id = sr.source_id
            where s.code = 'RSC' limit 3"""
    )
    for r in cur.fetchall():
        f = r["fields"] or {}
        print("  top-level keys:", sorted(f.keys()))
        # raw is the API response; check inside
        raw = f.get("raw") or {}
        if raw:
            print("  raw keys:", sorted(raw.keys()))
        print()
