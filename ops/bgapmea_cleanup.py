"""Delete BGAPMEA suppliers created with breadcrumb-polluted names.

Removes any supplier whose name starts with "Home" (matches the breadcrumb
prefix bug). For suppliers that share other sources, only the BGAPMEA
source_records row is removed; suppliers with no other source are deleted.

Run with --apply to make changes, otherwise dry-run.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from etl.core.db import db  # noqa: E402


def main(apply: bool) -> None:
    with db.conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, company_name FROM public.suppliers
            WHERE company_name LIKE 'Home %'
            """
        )
        rows = cur.fetchall()
        print(f"Found {len(rows)} polluted suppliers")
        for r in rows[:10]:
            print(" ", r["id"], r["company_name"][:120])

        if not rows:
            return
        if not apply:
            print("\n(dry-run; pass --apply to delete)")
            return

        ids = [r["id"] for r in rows]

        cur.execute(
            """
            DELETE FROM public.source_records
            WHERE supplier_id = ANY(%s::uuid[])
              AND source_id = (SELECT id FROM public.sources WHERE code = 'BGAPMEA')
            """,
            (ids,),
        )
        print("source_records deleted:", cur.rowcount)

        cur.execute(
            """
            SELECT s.id FROM public.suppliers s
            WHERE s.id = ANY(%s::uuid[])
              AND NOT EXISTS (
                  SELECT 1 FROM public.source_records sr
                  WHERE sr.supplier_id = s.id
              )
            """,
            (ids,),
        )
        orphan_ids = [r["id"] for r in cur.fetchall()]
        print(f"Orphan suppliers (no remaining source): {len(orphan_ids)}")
        if orphan_ids:
            cur.execute(
                "DELETE FROM public.suppliers WHERE id = ANY(%s::uuid[])",
                (orphan_ids,),
            )
            print("suppliers deleted:", cur.rowcount)
        conn.commit()
        print("committed.")


if __name__ == "__main__":
    main("--apply" in sys.argv)
