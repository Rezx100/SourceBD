"""Print supplier counts grouped by source tag."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from etl.core.db import db  # noqa: E402


def main() -> None:
    with db.conn() as c, c.cursor() as cur:
        print("=== Suppliers by source tag ===")
        cur.execute(
            """
            SELECT unnest(source_tags) AS s, COUNT(*) AS n
            FROM public.suppliers
            GROUP BY 1 ORDER BY n DESC
            """
        )
        for r in cur.fetchall():
            print(f"  {r['s']:20s} {r['n']}")

        cur.execute("SELECT COUNT(*) AS n FROM public.suppliers")
        print(f"\nTotal suppliers: {cur.fetchone()['n']}")

        # Multi-source overlap (data trust signal)
        cur.execute(
            """
            SELECT array_length(source_tags, 1) AS k, COUNT(*) AS n
            FROM public.suppliers
            GROUP BY 1 ORDER BY 1
            """
        )
        print("\n=== Suppliers by # of sources ===")
        for r in cur.fetchall():
            print(f"  {r['k']} source(s): {r['n']}")


if __name__ == "__main__":
    main()
