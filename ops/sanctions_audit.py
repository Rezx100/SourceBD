"""Inspect OFAC SDN run results: counts + every supplier match for audit."""
from etl.core.db import db

with db.conn() as c, c.cursor() as cur:
    cur.execute("select count(*) as n from sanctions_list_entries where list = 'ofac_sdn'")
    print("ofac_sdn entries in DB:", cur.fetchone()["n"])

    cur.execute("select list, count(*) as n from sanctions_list_entries group by list order by list")
    print("\nAll sanctions list entries:")
    for r in cur.fetchall():
        print(f"  {r['list']:12}  {r['n']:>6}")

    cur.execute(
        """select ss.list, ss.match_score, ss.list_entry_ref, ss.matched_name, ss.active,
                  s.company_name, s.id as supplier_id, s.is_sanctioned
             from sanctions_screening ss
             join suppliers s on s.id = ss.supplier_id
             order by ss.list, ss.match_score desc"""
    )
    rows = cur.fetchall()
    print(f"\nTotal screening hits: {len(rows)}")
    for r in rows:
        score = float(r["match_score"]) if r["match_score"] is not None else 0.0
        print(
            f"  [{r['list']:10}] score={score:5.2f} active={r['active']!s:5} "
            f"sanctioned={r['is_sanctioned']!s:5} | "
            f"supplier='{r['company_name']}' | "
            f"matched='{r['matched_name']}' (ref={r['list_entry_ref']})"
        )

    cur.execute("select count(*) as n from suppliers where is_sanctioned = true")
    print(f"\nSuppliers flagged is_sanctioned=true: {cur.fetchone()['n']}")
