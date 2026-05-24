"""F12 Phase 3: COALESCE-fill suppliers.parent_group_name from rsc_remediation.parent_group_name.

Idempotent. Fill-only (Hard Rule #5): never overwrites the Spec 10 curated seed
values (NASSA, Mondol, Biswas, Standard, Ha-Meem, Palmal) or any future
admin-reviewed `group_parent_review` outcomes.
"""
from __future__ import annotations

import os
import sys
import time

import psycopg


SQL = """
with x as (
  select r.supplier_id,
         min(r.parent_group_name) as val
    from public.rsc_remediation r
   where r.parent_group_name is not null
     and length(trim(r.parent_group_name)) > 0
   group by r.supplier_id
)
update public.suppliers s
   set parent_group_name = x.val,
       updated_at = now()
  from x
 where s.id = x.supplier_id
   and s.parent_group_name is null
   and x.val is not null;
"""

COVERAGE = """
select count(*) filter (where parent_group_name is not null) as filled,
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
