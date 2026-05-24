"""F12 Phase 2: COALESCE-fill suppliers.employees_total from rsc_remediation.workers_count.

Idempotent. Fill-only (Hard Rule #5): never overwrites an existing employees_total.
RSC is tier-2 industry; workers_count is the audited factory headcount Accord
publishes in its remediation JSON.
"""
from __future__ import annotations

import os
import sys
import time

import psycopg


SQL = """
with x as (
  select r.supplier_id,
         max(r.workers_count) as val
    from public.rsc_remediation r
   where r.workers_count is not null
     and r.workers_count > 0
   group by r.supplier_id
)
update public.suppliers s
   set employees_total = x.val,
       updated_at = now()
  from x
 where s.id = x.supplier_id
   and s.employees_total is null
   and x.val is not null;
"""

COVERAGE = """
select count(*) filter (where employees_total is not null) as filled,
       count(*) as total
  from public.suppliers;
"""


def main() -> int:
    dsn = os.environ.get("SUPABASE_DB_URL")
    if not dsn:
        print("ERROR: SUPABASE_DB_URL not set", file=sys.stderr)
        return 1

    with psycopg.connect(dsn, prepare_threshold=None, autocommit=False) as conn:
        with conn.cursor() as cur:
            cur.execute(COVERAGE)
            pre = cur.fetchone()
            print(f"pre : {pre[0]:>6d} / {pre[1]:>6d}  ({100*pre[0]/pre[1]:.1f}%)", flush=True)

        t0 = time.monotonic()
        with conn.cursor() as cur:
            cur.execute(SQL)
            rows = cur.rowcount
        conn.commit()
        print(f"updated {rows} rows in {time.monotonic()-t0:.2f}s", flush=True)

        with conn.cursor() as cur:
            cur.execute(COVERAGE)
            post = cur.fetchone()
            print(f"post: {post[0]:>6d} / {post[1]:>6d}  ({100*post[0]/post[1]:.1f}%)", flush=True)

    return 0


if __name__ == "__main__":
    sys.exit(main())
