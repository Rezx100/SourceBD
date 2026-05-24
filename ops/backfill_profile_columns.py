"""Backfill suppliers.{employees_*, production_capacity_pcs_day,
production_capacity_dozen_yearly, machines_*, established_date,
principal_products, factory_types, annual_turnover}
from source_records.fields JSONB (BGMEA web, BKMEA detail, EPB).

Idempotent. Safe to rerun. Numeric fields use max-merge so reruns converge.

Trust-tier merge rules (per architecture.md "highest tier wins"):
- employees_total/male/female: max across BGMEA + BKMEA (same factory same headcount;
  reported zeros are noise, treat <= 0 as missing).
- production_capacity_pcs_day: BKMEA only (already in pcs/day per BKMEA registry
  semantics). BGMEA only ships "dozen yearly" which is a different unit and a
  different reporting basis (annual not daily) — converting would manufacture
  numbers, so we leave NULL when only BGMEA data exists.
- production_capacity_dozen_yearly: BGMEA only (factory's self-declared annual
  output in dozens, exposed as-is with native unit; UI labels accordingly).
- machines_sewing/knitting/dyeing: BKMEA only (BGMEA only has total `num_machines`).
- established_date: BGMEA only (text, year strings vary).
- factory_types: BGMEA `factory_types[].Type` (Woven / Knit / Sweater).
- annual_turnover: BGMEA jsonb list as-is.
- principal_products: union of BGMEA `principal_products[]`,
  EPB `epb_categories[].name`, and BKMEA `bkmea_products` string split.
"""

from __future__ import annotations

import os
import sys
import time

import psycopg


SQL_STATEMENTS: list[tuple[str, str]] = [
    # ---------------------------------------------------------------- BKMEA ints
    (
        "BKMEA employees_total",
        """
        with x as (
          select sr.supplier_id,
                 max(nullif((sr.fields ->> 'bkmea_employees_total')::int, 0)) as val
            from source_records sr
            join sources s on s.id = sr.source_id
           where s.code = 'BKMEA'
             and sr.status = 'active'
             and (sr.fields ? 'bkmea_employees_total')
             and (sr.fields ->> 'bkmea_employees_total') ~ '^[0-9]+$'
           group by sr.supplier_id
        )
        update public.suppliers s
           set employees_total = greatest(coalesce(s.employees_total, 0), x.val),
               updated_at = now()
          from x
         where s.id = x.supplier_id
           and x.val is not null
           and x.val > coalesce(s.employees_total, 0)
           and x.val <= 200000;
        """,
    ),
    (
        "BKMEA employees_male",
        """
        with x as (
          select sr.supplier_id,
                 max(nullif((sr.fields ->> 'bkmea_employees_male')::int, 0)) as val
            from source_records sr
            join sources s on s.id = sr.source_id
           where s.code = 'BKMEA'
             and sr.status = 'active'
             and (sr.fields ? 'bkmea_employees_male')
             and (sr.fields ->> 'bkmea_employees_male') ~ '^[0-9]+$'
           group by sr.supplier_id
        )
        update public.suppliers s
           set employees_male = greatest(coalesce(s.employees_male, 0), x.val),
               updated_at = now()
          from x
         where s.id = x.supplier_id
           and x.val is not null
           and x.val > coalesce(s.employees_male, 0)
           and x.val <= 200000;
        """,
    ),
    (
        "BKMEA employees_female",
        """
        with x as (
          select sr.supplier_id,
                 max(nullif((sr.fields ->> 'bkmea_employees_female')::int, 0)) as val
            from source_records sr
            join sources s on s.id = sr.source_id
           where s.code = 'BKMEA'
             and sr.status = 'active'
             and (sr.fields ? 'bkmea_employees_female')
             and (sr.fields ->> 'bkmea_employees_female') ~ '^[0-9]+$'
           group by sr.supplier_id
        )
        update public.suppliers s
           set employees_female = greatest(coalesce(s.employees_female, 0), x.val),
               updated_at = now()
          from x
         where s.id = x.supplier_id
           and x.val is not null
           and x.val > coalesce(s.employees_female, 0)
           and x.val <= 200000;
        """,
    ),
    (
        "BKMEA production_capacity_pcs_day",
        """
        with x as (
          select sr.supplier_id,
                 max(nullif((sr.fields ->> 'bkmea_production_capacity')::int, 0)) as val
            from source_records sr
            join sources s on s.id = sr.source_id
           where s.code = 'BKMEA'
             and sr.status = 'active'
             and (sr.fields ? 'bkmea_production_capacity')
             and (sr.fields ->> 'bkmea_production_capacity') ~ '^[0-9]+$'
           group by sr.supplier_id
        )
        update public.suppliers s
           set production_capacity_pcs_day = greatest(coalesce(s.production_capacity_pcs_day, 0), x.val),
               updated_at = now()
          from x
         where s.id = x.supplier_id
           and x.val is not null
           and x.val > coalesce(s.production_capacity_pcs_day, 0)
           and x.val <= 10000000;
        """,
    ),
    (
        "BKMEA machines_sewing",
        """
        with x as (
          select sr.supplier_id,
                 max(nullif((sr.fields ->> 'bkmea_machines_sewing')::int, 0)) as val
            from source_records sr
            join sources s on s.id = sr.source_id
           where s.code = 'BKMEA'
             and sr.status = 'active'
             and (sr.fields ? 'bkmea_machines_sewing')
             and (sr.fields ->> 'bkmea_machines_sewing') ~ '^[0-9]+$'
           group by sr.supplier_id
        )
        update public.suppliers s
           set machines_sewing = greatest(coalesce(s.machines_sewing, 0), x.val),
               updated_at = now()
          from x
         where s.id = x.supplier_id
           and x.val is not null
           and x.val > coalesce(s.machines_sewing, 0);
        """,
    ),
    (
        "BKMEA machines_knitting",
        """
        with x as (
          select sr.supplier_id,
                 max(nullif((sr.fields ->> 'bkmea_machines_knitting')::int, 0)) as val
            from source_records sr
            join sources s on s.id = sr.source_id
           where s.code = 'BKMEA'
             and sr.status = 'active'
             and (sr.fields ? 'bkmea_machines_knitting')
             and (sr.fields ->> 'bkmea_machines_knitting') ~ '^[0-9]+$'
           group by sr.supplier_id
        )
        update public.suppliers s
           set machines_knitting = greatest(coalesce(s.machines_knitting, 0), x.val),
               updated_at = now()
          from x
         where s.id = x.supplier_id
           and x.val is not null
           and x.val > coalesce(s.machines_knitting, 0);
        """,
    ),
    (
        "BKMEA machines_dyeing",
        """
        with x as (
          select sr.supplier_id,
                 max(nullif((sr.fields ->> 'bkmea_machines_dyeing')::int, 0)) as val
            from source_records sr
            join sources s on s.id = sr.source_id
           where s.code = 'BKMEA'
             and sr.status = 'active'
             and (sr.fields ? 'bkmea_machines_dyeing')
             and (sr.fields ->> 'bkmea_machines_dyeing') ~ '^[0-9]+$'
           group by sr.supplier_id
        )
        update public.suppliers s
           set machines_dyeing = greatest(coalesce(s.machines_dyeing, 0), x.val),
               updated_at = now()
          from x
         where s.id = x.supplier_id
           and x.val is not null
           and x.val > coalesce(s.machines_dyeing, 0);
        """,
    ),
    # ---------------------------------------------------------------- BGMEA ints
    # BGMEA `employees` is a dict like {"Management": "525", "Employee Male": "",
    # "Employee Female": ""}. Most rows have only Management. We treat any
    # non-empty numeric value as the headcount and max-merge into employees_total
    # (per schema, employees_total is the broadest figure; Management-only is
    # still informative for buyer filtering).
    (
        "BGMEA employees_total (from employees dict, max of Management/Worker/etc)",
        """
        with x as (
          select sr.supplier_id,
                 max(nullif(regexp_replace(v.value::text, '[^0-9]', '', 'g'), '')::bigint) as val
            from source_records sr
            join sources s on s.id = sr.source_id,
                 lateral jsonb_each_text(sr.fields -> 'employees') v
           where s.code = 'BGMEA'
             and sr.status = 'active'
             and jsonb_typeof(sr.fields -> 'employees') = 'object'
             and v.value ~ '[0-9]'
           group by sr.supplier_id
        )
        update public.suppliers s
           set employees_total = greatest(coalesce(s.employees_total, 0), x.val::int),
               updated_at = now()
          from x
         where s.id = x.supplier_id
           and x.val is not null
           and x.val > coalesce(s.employees_total, 0)
           and x.val <= 200000;
        """,
    ),
    (
        "BGMEA employees_male",
        """
        with x as (
          select sr.supplier_id,
                 max(nullif(regexp_replace((sr.fields -> 'employees' ->> 'Employee Male'), '[^0-9]', '', 'g'), '')::int) as val
            from source_records sr
            join sources s on s.id = sr.source_id
           where s.code = 'BGMEA'
             and sr.status = 'active'
             and jsonb_typeof(sr.fields -> 'employees') = 'object'
             and (sr.fields -> 'employees' ? 'Employee Male')
             and (sr.fields -> 'employees' ->> 'Employee Male') ~ '[0-9]'
           group by sr.supplier_id
        )
        update public.suppliers s
           set employees_male = greatest(coalesce(s.employees_male, 0), x.val),
               updated_at = now()
          from x
         where s.id = x.supplier_id
           and x.val is not null
           and x.val > coalesce(s.employees_male, 0);
        """,
    ),
    (
        "BGMEA employees_female",
        """
        with x as (
          select sr.supplier_id,
                 max(nullif(regexp_replace((sr.fields -> 'employees' ->> 'Employee Female'), '[^0-9]', '', 'g'), '')::int) as val
            from source_records sr
            join sources s on s.id = sr.source_id
           where s.code = 'BGMEA'
             and sr.status = 'active'
             and jsonb_typeof(sr.fields -> 'employees') = 'object'
             and (sr.fields -> 'employees' ? 'Employee Female')
             and (sr.fields -> 'employees' ->> 'Employee Female') ~ '[0-9]'
           group by sr.supplier_id
        )
        update public.suppliers s
           set employees_female = greatest(coalesce(s.employees_female, 0), x.val),
               updated_at = now()
          from x
         where s.id = x.supplier_id
           and x.val is not null
           and x.val > coalesce(s.employees_female, 0);
        """,
    ),
    # ---------------------------------------------------------------- BGMEA text/jsonb
    (
        "BGMEA established_date",
        """
        with x as (
          select sr.supplier_id,
                 (array_agg(sr.fields ->> 'established_date' order by sr.fetched_at desc))[1] as val
            from source_records sr
            join sources s on s.id = sr.source_id
           where s.code = 'BGMEA'
             and sr.status = 'active'
             and nullif(trim(sr.fields ->> 'established_date'), '') is not null
           group by sr.supplier_id
        )
        update public.suppliers s
           set established_date = x.val,
               updated_at = now()
          from x
         where s.id = x.supplier_id
           and (s.established_date is distinct from x.val);
        """,
    ),
    (
        "factory_types union (BGMEA + BKMEA + BGAPMEA + BTMA + GOTS + EPB + WRAP; F9)",
        """
        with bgmea as (
          select sr.supplier_id,
                 nullif(trim(ft ->> 'Type'), '') as t
            from source_records sr
            join sources s on s.id = sr.source_id,
                 lateral jsonb_array_elements(sr.fields -> 'factory_types') ft
           where s.code = 'BGMEA'
             and sr.status = 'active'
             and jsonb_typeof(sr.fields -> 'factory_types') = 'array'
        ),
        bkmea_prod as (
          select sr.supplier_id,
                 case
                   when part ~* '\\msweater'                then 'Sweater'
                   when part ~* '\\mwoven'                  then 'Woven'
                   when part ~* '\\mdenim'                  then 'Woven'
                   when part ~* '\\mknit'                   then 'Knit'
                   when part ~* '\\m(t[- ]?shirt|polo|tank|tee)' then 'Knit'
                   else null
                 end as t
            from source_records sr
            join sources s on s.id = sr.source_id,
                 lateral regexp_split_to_table(sr.fields ->> 'bkmea_products', '[,;/]+') part
           where s.code = 'BKMEA'
             and sr.status = 'active'
             and nullif(trim(sr.fields ->> 'bkmea_products'), '') is not null
        ),
        bkmea_default as (
          -- Every BKMEA member is by definition a knitwear factory; default
          -- to 'Knit' when bkmea_products is absent or unparseable so no
          -- BKMEA-tagged factory ends up with an empty factory_types array.
          select sr.supplier_id, 'Knit'::text as t
            from source_records sr
            join sources s on s.id = sr.source_id
           where s.code = 'BKMEA'
             and sr.status = 'active'
        ),
        bgapmea as (
          -- BGAPMEA = Garment Accessories & Packaging assoc; default Accessories,
          -- promote to Packaging when bgapmea_products mentions packaging/box/carton.
          select sr.supplier_id,
                 case
                   when (sr.fields ->> 'bgapmea_products') ~* '(packag|carton|\\mbox|hangtag|sticker|label\\M)' then 'Packaging'
                   else 'Accessories'
                 end as t
            from source_records sr
            join sources s on s.id = sr.source_id
           where s.code = 'BGAPMEA'
             and sr.status = 'active'
        ),
        btma as (
          -- BTMA = Textile Mills Association; every member is a textile mill.
          select sr.supplier_id, 'Textile Mill'::text as t
            from source_records sr
            join sources s on s.id = sr.source_id
           where s.code = 'BTMA'
             and sr.status = 'active'
        ),
        gots as (
          -- GOTS gots_field_of_operation is a comma-list of processes; map process
          -- tokens to canonical factory types.
          select sr.supplier_id,
                 case
                   when part ~* 'knit'      then 'Knit'
                   when part ~* 'weav'      then 'Woven'
                   when part ~* 'spin'      then 'Spinning'
                   when part ~* '(dye|print|finish)' then 'Dyeing'
                   else null
                 end as t
            from source_records sr
            join sources s on s.id = sr.source_id,
                 lateral regexp_split_to_table(sr.fields ->> 'gots_field_of_operation', '[,;/]+') part
           where s.code = 'GOTS'
             and sr.status = 'active'
             and nullif(trim(sr.fields ->> 'gots_field_of_operation'), '') is not null
        ),
        epb as (
          -- EPB epb_categories[].name is itself a factory_type (Knit/Woven/Jute).
          -- Split "Knit & Woven" into ["Knit","Woven"] and filter junk codes.
          select sr.supplier_id,
                 case
                   when cat ->> 'name' ~* '(^|\\W)(\\(?nb\\)?|\\(?b\\)?)(\\W|$)' then null
                   when cat ->> 'name' ~* 'jute'   then 'Jute'
                   when cat ->> 'name' ~* 'sweater' then 'Sweater'
                   when cat ->> 'name' ~* 'denim'  then 'Woven'
                   when cat ->> 'name' ~* 'knit'   then 'Knit'
                   when cat ->> 'name' ~* 'woven'  then 'Woven'
                   else null
                 end as t
            from source_records sr
            join sources s on s.id = sr.source_id,
                 lateral jsonb_array_elements(sr.fields -> 'epb_categories') cat
           where s.code = 'EPB'
             and sr.status = 'active'
             and jsonb_typeof(sr.fields -> 'epb_categories') = 'array'
        ),
        epb_split_kw as (
          -- "Knit & Woven" expands to both tokens.
          select sr.supplier_id, 'Knit'::text as t
            from source_records sr
            join sources s on s.id = sr.source_id,
                 lateral jsonb_array_elements(sr.fields -> 'epb_categories') cat
           where s.code = 'EPB' and sr.status = 'active'
             and jsonb_typeof(sr.fields -> 'epb_categories') = 'array'
             and (cat ->> 'name') ~* 'knit\\s*&\\s*woven'
          union all
          select sr.supplier_id, 'Woven'::text
            from source_records sr
            join sources s on s.id = sr.source_id,
                 lateral jsonb_array_elements(sr.fields -> 'epb_categories') cat
           where s.code = 'EPB' and sr.status = 'active'
             and jsonb_typeof(sr.fields -> 'epb_categories') = 'array'
             and (cat ->> 'name') ~* 'knit\\s*&\\s*woven'
        ),
        wrap as (
          select sr.supplier_id,
                 case
                   when part ~* 'sweater'                    then 'Sweater'
                   when part ~* '(denim|woven)'              then 'Woven'
                   when part ~* '(knit|t[- ]?shirt|polo|tank|legging|boxer|pajama|nightgown|knitwear)' then 'Knit'
                   else null
                 end as t
            from source_records sr
            join sources s on s.id = sr.source_id,
                 lateral regexp_split_to_table(sr.fields ->> 'wrap_products', '[,;/]+') part
           where s.code = 'WRAP'
             and sr.status = 'active'
             and nullif(trim(sr.fields ->> 'wrap_products'), '') is not null
        ),
        existing as (
          -- Carry existing factory_types so reruns/new-source additions are
          -- strictly additive (never lose a previously-set value).
          select id as supplier_id, unnest(factory_types) as t
            from public.suppliers
           where array_length(factory_types, 1) > 0
        ),
        all_t as (
          select * from bgmea
          union all select * from bkmea_prod
          union all select * from bkmea_default
          union all select * from bgapmea
          union all select * from btma
          union all select * from gots
          union all select * from epb
          union all select * from epb_split_kw
          union all select * from wrap
          union all select * from existing
        ),
        agg as (
          select supplier_id,
                 array_agg(distinct t order by t) as vals
            from all_t
           where t is not null and length(t) between 1 and 64
           group by supplier_id
        )
        update public.suppliers s
           set factory_types = agg.vals,
               updated_at = now()
          from agg
         where s.id = agg.supplier_id
           and agg.vals is not null
           and array_length(agg.vals, 1) > 0
           and (s.factory_types is distinct from agg.vals);
        """,
    ),
    (
        "BGMEA production_capacity_dozen_yearly",
        """
        with x as (
          select sr.supplier_id,
                 max(nullif((sr.fields ->> 'production_capacity_dozen_yearly')::bigint, 0)) as val
            from source_records sr
            join sources s on s.id = sr.source_id
           where s.code = 'BGMEA'
             and sr.status = 'active'
             and (sr.fields ? 'production_capacity_dozen_yearly')
             and (sr.fields ->> 'production_capacity_dozen_yearly') ~ '^[0-9]+$'
           group by sr.supplier_id
        )
        update public.suppliers s
           set production_capacity_dozen_yearly = greatest(coalesce(s.production_capacity_dozen_yearly, 0), x.val),
               updated_at = now()
          from x
         where s.id = x.supplier_id
           and x.val is not null
           and x.val > coalesce(s.production_capacity_dozen_yearly, 0)
           and x.val <= 200000000;
        """,
    ),
    (
        "BGMEA annual_turnover (latest payload as jsonb)",
        """
        with x as (
          select sr.supplier_id,
                 (array_agg(sr.fields -> 'annual_turnover' order by sr.fetched_at desc))[1] as val
            from source_records sr
            join sources s on s.id = sr.source_id
           where s.code = 'BGMEA'
             and sr.status = 'active'
             and jsonb_typeof(sr.fields -> 'annual_turnover') = 'array'
             and jsonb_array_length(sr.fields -> 'annual_turnover') > 0
           group by sr.supplier_id
        )
        update public.suppliers s
           set annual_turnover = x.val,
               updated_at = now()
          from x
         where s.id = x.supplier_id
           and x.val is not null
           and (s.annual_turnover is distinct from x.val);
        """,
    ),
    # ---------------------------------------------------------------- principal_products union
    # Single statement that unions all three sources per supplier_id and writes
    # the deduped lower-trimmed product list.
    (
        "principal_products union (BGMEA list + EPB categories + BKMEA split)",
        """
        with bgmea as (
          select sr.supplier_id,
                 nullif(trim(prod::text, '"'), '') as p
            from source_records sr
            join sources s on s.id = sr.source_id,
                 lateral jsonb_array_elements_text(sr.fields -> 'principal_products') prod
           where s.code = 'BGMEA'
             and sr.status = 'active'
             and jsonb_typeof(sr.fields -> 'principal_products') = 'array'
        ),
        epb as (
          select sr.supplier_id,
                 nullif(trim(cat ->> 'name'), '') as p
            from source_records sr
            join sources s on s.id = sr.source_id,
                 lateral jsonb_array_elements(sr.fields -> 'epb_categories') cat
           where s.code = 'EPB'
             and sr.status = 'active'
             and jsonb_typeof(sr.fields -> 'epb_categories') = 'array'
        ),
        bkmea as (
          select sr.supplier_id,
                 nullif(trim(part), '') as p
            from source_records sr
            join sources s on s.id = sr.source_id,
                 lateral regexp_split_to_table(sr.fields ->> 'bkmea_products', '[,;/]+') part
           where s.code = 'BKMEA'
             and sr.status = 'active'
             and nullif(trim(sr.fields ->> 'bkmea_products'), '') is not null
        ),
        all_p as (
          select * from bgmea
          union all
          select * from epb
          union all
          select * from bkmea
        ),
        agg as (
          select supplier_id,
                 array_agg(distinct p order by p) as vals
            from all_p
           where p is not null and length(p) between 1 and 200
           group by supplier_id
        )
        update public.suppliers s
           set principal_products = agg.vals,
               updated_at = now()
          from agg
         where s.id = agg.supplier_id
           and agg.vals is not null
           and array_length(agg.vals, 1) > 0
           and (s.principal_products is distinct from agg.vals);
        """,
    ),
]


COVERAGE_SQL = """
select
  count(*)                                                                  as total_suppliers,
  count(*) filter (where employees_total is not null)                       as with_employees_total,
  count(*) filter (where employees_male is not null)                        as with_employees_male,
  count(*) filter (where employees_female is not null)                      as with_employees_female,
  count(*) filter (where production_capacity_pcs_day is not null)           as with_capacity_pcs_day,
  count(*) filter (where production_capacity_dozen_yearly is not null)      as with_capacity_dozen_yearly,
  count(*) filter (where machines_sewing is not null)                       as with_machines_sewing,
  count(*) filter (where machines_knitting is not null)                     as with_machines_knitting,
  count(*) filter (where machines_dyeing is not null)                       as with_machines_dyeing,
  count(*) filter (where established_date is not null)                      as with_established_date,
  count(*) filter (where array_length(principal_products, 1) > 0)           as with_principal_products,
  count(*) filter (where array_length(factory_types, 1) > 0)                as with_factory_types,
  count(*) filter (where annual_turnover is not null)                       as with_annual_turnover
from public.suppliers;
"""


def main() -> int:
    dsn = os.environ.get("SUPABASE_DB_URL")
    if not dsn:
        print("ERROR: SUPABASE_DB_URL not set", file=sys.stderr)
        return 1

    with psycopg.connect(dsn, prepare_threshold=None, autocommit=False) as conn:
        for label, sql in SQL_STATEMENTS:
            t0 = time.monotonic()
            with conn.cursor() as cur:
                cur.execute(sql)
                rows = cur.rowcount
            conn.commit()
            print(f"  [{time.monotonic() - t0:6.2f}s] {rows:>6d} rows  -- {label}", flush=True)

        print("\n=== coverage after backfill ===", flush=True)
        with conn.cursor() as cur:
            cur.execute(COVERAGE_SQL)
            cols = [d.name for d in cur.description]
            row = cur.fetchone()
        for c, v in zip(cols, row):
            print(f"  {c:<32s} {v:>8d}", flush=True)

    return 0


if __name__ == "__main__":
    sys.exit(main())
