"""Inspect details of currently-active sanctions matches to verdict TP vs FP."""
from etl.core.db import db

REFS = ["sdn-51057", "sdn-54178", "sdn-27528"]

with db.conn() as c, c.cursor() as cur:
    for ref in REFS:
        cur.execute(
            """select id, list, entry_ref, entity_name, aliases, country,
                      merchandise, status, status_notes, source_url, raw
                 from sanctions_list_entries
                where entry_ref = %s""",
            (ref,),
        )
        row = cur.fetchone()
        print("=" * 80)
        print(f"REF: {ref}")
        if not row:
            print("  NOT FOUND")
            continue
        print(f"  entity_name: {row['entity_name']!r}")
        print(f"  aliases:     {row['aliases']}")
        print(f"  country:     {row['country']!r}")
        print(f"  merchandise: {row['merchandise']!r}")
        print(f"  status:      {row['status']!r}")
        print(f"  status_notes:{row['status_notes']!r}")
        print(f"  source_url:  {row['source_url']!r}")
        raw = row["raw"] or {}
        # Print only the most useful raw fields if present
        for k in ("sdn_type", "program", "title", "remarks", "vess_flag",
                  "vess_owner", "tonnage", "call_sign"):
            if k in raw and raw[k]:
                print(f"  raw.{k}: {raw[k]!r}")

    # Also show the suppliers we matched, to compare
    print()
    print("=" * 80)
    print("MATCHED SUPPLIERS:")
    cur.execute(
        """select s.id, s.company_name, s.address, s.country, s.member_of,
                  s.business_type, s.is_sanctioned
             from suppliers s
             join sanctions_screening ss on ss.supplier_id = s.id
            where ss.active = true
            order by s.company_name"""
    )
    for r in cur.fetchall():
        print(f"  - {r['company_name']!r}")
        print(f"      country: {r['country']!r}  type: {r['business_type']!r}")
        print(f"      address: {r['address']!r}")
        print(f"      member_of: {r['member_of']!r}")
