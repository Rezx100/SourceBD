"""Final verification of UFLPA + CBP WRO ingest."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from etl.core.db import db  # noqa: E402


def main() -> None:
    with db.conn() as c, c.cursor() as cur:
        cur.execute(
            "select list, count(*) as n from public.sanctions_list_entries "
            " group by list order by list"
        )
        print("=== sanctions_list_entries by list ===")
        for r in cur.fetchall():
            print(f"  {r['list']:15s} {r['n']}")

        cur.execute(
            "select count(*) as n, sum((active)::int) as active "
            "  from public.sanctions_screening"
        )
        r = cur.fetchone()
        print(f"\n=== sanctions_screening: total={r['n']} active={r['active']} ===")

        cur.execute(
            "select count(*) as n from public.suppliers where is_sanctioned = true"
        )
        print(f"=== suppliers.is_sanctioned=true: {cur.fetchone()['n']} ===")

        cur.execute(
            """select scraper_code, status, records_seen, records_upserted,
                      meta->>'matched_suppliers' as matched,
                      finished_at - started_at as duration
                 from public.etl_runs
                where scraper_code in ('uflpa','cbp_wro')
                order by started_at desc
                limit 4"""
        )
        print("\n=== recent etl_runs ===")
        for r in cur.fetchall():
            print(
                f"  {r['scraper_code']:10s} {r['status']:8s} "
                f"seen={r['records_seen']:>4} upserted={r['records_upserted']:>4} "
                f"matched={r['matched']:<4} duration={r['duration']}"
            )

        cur.execute("select code, name, tier from public.sources where code in ('UFLPA','US_WRO')")
        print("\n=== sources ===")
        for r in cur.fetchall():
            print(f"  {r['code']:10s} tier={r['tier']:<25s} {r['name']}")


if __name__ == "__main__":
    main()
