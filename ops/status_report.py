"""Print supplier counts grouped by source tag + recent etl_runs."""
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

        cur.execute(
            """
            SELECT COUNT(*) AS n FROM public.source_records sr
            JOIN public.sources s ON s.id = sr.source_id
            WHERE s.code = 'EPB'
            """
        )
        print(f"EPB source_records: {cur.fetchone()['n']}")

        cur.execute(
            """
            SELECT COUNT(*) AS n FROM public.source_records sr
            JOIN public.sources s ON s.id = sr.source_id
            WHERE s.code = 'BGAPMEA'
            """
        )
        print(f"BGAPMEA source_records: {cur.fetchone()['n']}")

        print("\n=== Recent etl_runs ===")
        cur.execute(
            """
            SELECT scraper_code, status, started_at, finished_at,
                   records_seen, records_upserted
            FROM public.etl_runs
            ORDER BY started_at DESC LIMIT 8
            """
        )
        for r in cur.fetchall():
            print(
                f"  {r['scraper_code']:18s} {r['status']:10s} "
                f"seen={r['records_seen']} up={r['records_upserted']} "
                f"start={r['started_at']} end={r['finished_at']}"
            )


if __name__ == "__main__":
    main()
