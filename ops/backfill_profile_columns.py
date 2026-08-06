"""Backfill suppliers.{employees_*, production_capacity_pcs_day,
production_capacity_dozen_yearly, machines_sewing, established_date,
principal_products, factory_types}
from source_records.fields JSONB (BGMEA web, BKMEA detail, EPB).

Idempotent. Safe to rerun. Dry-run is the default (REST); pass --apply to
write via psycopg (founder approval required for production).

Numeric projection rules (winner selection, caps, BGMEA worker cohorts,
per-source column map) live in ``etl.core.projection`` — shared with
``ops/repair_bgmea_conflations.py`` (REZ-100). This module owns the SQL
apply path, the REST dry-run I/O, and the residual
``entity_type = 'factory'`` gate on BGMEA ``num_machines``.

Each UPDATE skips suppliers with a live `supplier_field_locks` row on the
target column (REZ-66 / A6). Released locks (`released_at` set) do not block.

Arrays / established_date (not in the shared module):
- established_date: BGMEA only (latest-fetched)
- factory_types / principal_products: array unions (additive)
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from collections import Counter
from datetime import datetime
from typing import Any

import httpx
import psycopg

from etl.core.projection import (
    BGMEA_NON_WORKER_EMPLOYEE_KEYS,  # noqa: F401 — re-export for tests
    BGMEA_WORKER_COHORT_KEYS,  # noqa: F401 — re-export for tests
    NUMERIC_COLUMNS,
    NumericCandidate,
    TIER_RANK,  # noqa: F401 — re-export for tests
    bgmea_production_workers,
    digits_int,
    pick_numeric_winner,
    value_for_column,
    within_numeric_cap,
)

# Re-exports under the historical private names so existing tests keep
# importing from this module unmodified (REZ-100 pure move).
_bgmea_production_workers = bgmea_production_workers
_digits_int = digits_int


SQL_STATEMENTS: list[tuple[str, str]] = [
    # ---------------------------------------------------------------- numerics (REZ-68)

    (
        "employees_total (BKMEA + BGMEA; highest-trust then most-recent)",
        """
        with candidates as (
          select sr.supplier_id,
                 nullif((sr.fields ->> 'bkmea_employees_total')::int, 0) as val,
                 sr.source_tier,
                 sr.fetched_at,
                 sr.id,
                 'BKMEA'::text as source_code
            from source_records sr
            join sources src on src.id = sr.source_id
           where src.code = 'BKMEA'
             and sr.status = 'active'
             and (sr.fields ? 'bkmea_employees_total')
             and (sr.fields ->> 'bkmea_employees_total') ~ '^[0-9]+$'
          union all
          select sr.supplier_id,
                 (
                   -- REZ-95: production workers = Employee Male + Employee Female.
                   -- 'Management' is deliberately NOT summed; it is not reliably a
                   -- management headcount (REZ-91 regression). Not max either.
                   -- Empty-string values fail ~ '[0-9]' and are skipped.
                   select sum(nullif(regexp_replace(v.value::text, '[^0-9]', '', 'g'), '')::bigint)
                     from jsonb_each_text(sr.fields -> 'employees') v
                    where v.key in ('Employee Male', 'Employee Female')
                      and v.value ~ '[0-9]'
                 ) as val,
                 sr.source_tier,
                 sr.fetched_at,
                 sr.id,
                 'BGMEA'::text as source_code
            from source_records sr
            join sources src on src.id = sr.source_id
           where src.code = 'BGMEA'
             and sr.status = 'active'
             and jsonb_typeof(sr.fields -> 'employees') = 'object'
        ),
        x as (
          select distinct on (c.supplier_id)
                 c.supplier_id,
                 c.val::int as val,
                 c.source_code
            from candidates c
           where c.val is not null
             and c.val <> 0
           order by c.supplier_id,
                    case c.source_tier
              when 'tier1_gov' then 1
              when 'tier2_industry' then 2
              when 'tier3_cert' then 3
              when 'tier4_brand' then 4
              when 'tier5_regulatory' then 5
              when 'tier6_crosscheck' then 6
              else 99
            end,
                    c.fetched_at desc nulls last,
                    c.id
        )
        update public.suppliers s
           set employees_total = x.val,
               updated_at = now()
          from x
         where s.id = x.supplier_id
           and x.val is not null
           and s.employees_total is distinct from x.val
           and x.val <= 200000
           and not exists (
             select 1 from public.supplier_field_locks l
              where l.supplier_id = s.id
                and l.column_name = 'employees_total'
                and l.released_at is null
           );
        """,
    ),

    (
        "employees_male (BKMEA + BGMEA; highest-trust then most-recent)",
        """
        with candidates as (
          select sr.supplier_id,
                 nullif((sr.fields ->> 'bkmea_employees_male')::int, 0) as val,
                 sr.source_tier,
                 sr.fetched_at,
                 sr.id,
                 'BKMEA'::text as source_code
            from source_records sr
            join sources src on src.id = sr.source_id
           where src.code = 'BKMEA'
             and sr.status = 'active'
             and (sr.fields ? 'bkmea_employees_male')
             and (sr.fields ->> 'bkmea_employees_male') ~ '^[0-9]+$'
          union all
          select sr.supplier_id,
                 nullif(regexp_replace((sr.fields -> 'employees' ->> 'Employee Male'), '[^0-9]', '', 'g'), '')::int as val,
                 sr.source_tier,
                 sr.fetched_at,
                 sr.id,
                 'BGMEA'::text as source_code
            from source_records sr
            join sources src on src.id = sr.source_id
           where src.code = 'BGMEA'
             and sr.status = 'active'
             and jsonb_typeof(sr.fields -> 'employees') = 'object'
             and (sr.fields -> 'employees' ? 'Employee Male')
             and (sr.fields -> 'employees' ->> 'Employee Male') ~ '[0-9]'
        ),
        x as (
          select distinct on (c.supplier_id)
                 c.supplier_id,
                 c.val,
                 c.source_code
            from candidates c
           where c.val is not null
             and nullif(c.val, 0) is not null
           order by c.supplier_id,
                    case c.source_tier
              when 'tier1_gov' then 1
              when 'tier2_industry' then 2
              when 'tier3_cert' then 3
              when 'tier4_brand' then 4
              when 'tier5_regulatory' then 5
              when 'tier6_crosscheck' then 6
              else 99
            end,
                    c.fetched_at desc nulls last,
                    c.id
        )
        update public.suppliers s
           set employees_male = x.val,
               updated_at = now()
          from x
         where s.id = x.supplier_id
           and x.val is not null
           and s.employees_male is distinct from x.val
           and x.val <= 200000
           and not exists (
             select 1 from public.supplier_field_locks l
              where l.supplier_id = s.id
                and l.column_name = 'employees_male'
                and l.released_at is null
           );
        """,
    ),

    (
        "employees_female (BKMEA + BGMEA; highest-trust then most-recent)",
        """
        with candidates as (
          select sr.supplier_id,
                 nullif((sr.fields ->> 'bkmea_employees_female')::int, 0) as val,
                 sr.source_tier,
                 sr.fetched_at,
                 sr.id,
                 'BKMEA'::text as source_code
            from source_records sr
            join sources src on src.id = sr.source_id
           where src.code = 'BKMEA'
             and sr.status = 'active'
             and (sr.fields ? 'bkmea_employees_female')
             and (sr.fields ->> 'bkmea_employees_female') ~ '^[0-9]+$'
          union all
          select sr.supplier_id,
                 nullif(regexp_replace((sr.fields -> 'employees' ->> 'Employee Female'), '[^0-9]', '', 'g'), '')::int as val,
                 sr.source_tier,
                 sr.fetched_at,
                 sr.id,
                 'BGMEA'::text as source_code
            from source_records sr
            join sources src on src.id = sr.source_id
           where src.code = 'BGMEA'
             and sr.status = 'active'
             and jsonb_typeof(sr.fields -> 'employees') = 'object'
             and (sr.fields -> 'employees' ? 'Employee Female')
             and (sr.fields -> 'employees' ->> 'Employee Female') ~ '[0-9]'
        ),
        x as (
          select distinct on (c.supplier_id)
                 c.supplier_id,
                 c.val,
                 c.source_code
            from candidates c
           where c.val is not null
             and nullif(c.val, 0) is not null
           order by c.supplier_id,
                    case c.source_tier
              when 'tier1_gov' then 1
              when 'tier2_industry' then 2
              when 'tier3_cert' then 3
              when 'tier4_brand' then 4
              when 'tier5_regulatory' then 5
              when 'tier6_crosscheck' then 6
              else 99
            end,
                    c.fetched_at desc nulls last,
                    c.id
        )
        update public.suppliers s
           set employees_female = x.val,
               updated_at = now()
          from x
         where s.id = x.supplier_id
           and x.val is not null
           and s.employees_female is distinct from x.val
           and x.val <= 200000
           and not exists (
             select 1 from public.supplier_field_locks l
              where l.supplier_id = s.id
                and l.column_name = 'employees_female'
                and l.released_at is null
           );
        """,
    ),

    (
        "BKMEA production_capacity_pcs_day",
        """
        with x as (
          select distinct on (sr.supplier_id)
                 sr.supplier_id,
                 nullif((sr.fields ->> 'bkmea_production_capacity')::int, 0) as val
            from source_records sr
            join sources src on src.id = sr.source_id
           where src.code = 'BKMEA'
             and sr.status = 'active'
             and (sr.fields ? 'bkmea_production_capacity')
             and (sr.fields ->> 'bkmea_production_capacity') ~ '^[0-9]+$'
             and nullif((sr.fields ->> 'bkmea_production_capacity')::int, 0) is not null
           order by sr.supplier_id,
                    case sr.source_tier
              when 'tier1_gov' then 1
              when 'tier2_industry' then 2
              when 'tier3_cert' then 3
              when 'tier4_brand' then 4
              when 'tier5_regulatory' then 5
              when 'tier6_crosscheck' then 6
              else 99
            end,
                    sr.fetched_at desc nulls last,
                    sr.id
        )
        update public.suppliers s
           set production_capacity_pcs_day = x.val,
               updated_at = now()
          from x
         where s.id = x.supplier_id
           and x.val is not null
           and s.production_capacity_pcs_day is distinct from x.val
           and x.val <= 10000000
           and not exists (
             select 1 from public.supplier_field_locks l
              where l.supplier_id = s.id
                and l.column_name = 'production_capacity_pcs_day'
                and l.released_at is null
           );
        """,
    ),

    (
        "machines_sewing (BKMEA + BGMEA factories; highest-trust then most-recent)",
        """
        with candidates as (
          select sr.supplier_id,
                 nullif((sr.fields ->> 'bkmea_machines_sewing')::int, 0) as val,
                 sr.source_tier,
                 sr.fetched_at,
                 sr.id,
                 'BKMEA'::text as source_code
            from source_records sr
            join sources src on src.id = sr.source_id
           where src.code = 'BKMEA'
             and sr.status = 'active'
             and (sr.fields ? 'bkmea_machines_sewing')
             and (sr.fields ->> 'bkmea_machines_sewing') ~ '^[0-9]+$'
          union all
          select sr.supplier_id,
                 nullif(regexp_replace(sr.fields ->> 'num_machines', '[^0-9]', '', 'g'), '')::int as val,
                 sr.source_tier,
                 sr.fetched_at,
                 sr.id,
                 'BGMEA'::text as source_code
            from source_records sr
            join sources src on src.id = sr.source_id
           where src.code = 'BGMEA'
             and sr.status = 'active'
             and (sr.fields ? 'num_machines')
             and (sr.fields ->> 'num_machines') ~ '[0-9]'
        ),
        x as (
          select distinct on (c.supplier_id)
                 c.supplier_id,
                 c.val,
                 c.source_code
            from candidates c
            join public.suppliers sup on sup.id = c.supplier_id
           where c.val is not null
             and nullif(c.val, 0) is not null
             and (
               c.source_code = 'BKMEA'
               or (
                 c.source_code = 'BGMEA'
                 and sup.entity_type = 'factory'
                 and c.val between 1 and 20000
               )
             )
           order by c.supplier_id,
                    case c.source_tier
              when 'tier1_gov' then 1
              when 'tier2_industry' then 2
              when 'tier3_cert' then 3
              when 'tier4_brand' then 4
              when 'tier5_regulatory' then 5
              when 'tier6_crosscheck' then 6
              else 99
            end,
                    c.fetched_at desc nulls last,
                    c.id
        )
        update public.suppliers s
           set machines_sewing = x.val,
               updated_at = now()
          from x
         where s.id = x.supplier_id
           and x.val is not null
           and s.machines_sewing is distinct from x.val
           and not exists (
             select 1 from public.supplier_field_locks l
              where l.supplier_id = s.id
                and l.column_name = 'machines_sewing'
                and l.released_at is null
           );
        """,
    ),

    (
        "BGMEA production_capacity_dozen_yearly",
        """
        with x as (
          select distinct on (sr.supplier_id)
                 sr.supplier_id,
                 nullif((sr.fields ->> 'production_capacity_dozen_yearly')::bigint, 0) as val
            from source_records sr
            join sources src on src.id = sr.source_id
           where src.code = 'BGMEA'
             and sr.status = 'active'
             and (sr.fields ? 'production_capacity_dozen_yearly')
             and (sr.fields ->> 'production_capacity_dozen_yearly') ~ '^[0-9]+$'
             and nullif((sr.fields ->> 'production_capacity_dozen_yearly')::bigint, 0) is not null
           order by sr.supplier_id,
                    case sr.source_tier
              when 'tier1_gov' then 1
              when 'tier2_industry' then 2
              when 'tier3_cert' then 3
              when 'tier4_brand' then 4
              when 'tier5_regulatory' then 5
              when 'tier6_crosscheck' then 6
              else 99
            end,
                    sr.fetched_at desc nulls last,
                    sr.id
        )
        update public.suppliers s
           set production_capacity_dozen_yearly = x.val,
               updated_at = now()
          from x
         where s.id = x.supplier_id
           and x.val is not null
           and s.production_capacity_dozen_yearly is distinct from x.val
           and x.val <= 200000000
           and not exists (
             select 1 from public.supplier_field_locks l
              where l.supplier_id = s.id
                and l.column_name = 'production_capacity_dozen_yearly'
                and l.released_at is null
           );
        """,
    ),
    # ---------------------------------------------------------------- text/jsonb (unchanged)
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
           and (s.established_date is distinct from x.val)
           and not exists (
             select 1 from public.supplier_field_locks l
              where l.supplier_id = s.id
                and l.column_name = 'established_date'
                and l.released_at is null
           );
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
           and (s.factory_types is distinct from agg.vals)
           and not exists (
             select 1 from public.supplier_field_locks l
              where l.supplier_id = s.id
                and l.column_name = 'factory_types'
                and l.released_at is null
           );
        """,
    ),
    (
        "principal_products union (BGMEA + EPB + BKMEA + BGAPMEA + GOTS + WRAP; F10)",
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
        bgapmea as (
          select sr.supplier_id,
                 nullif(trim(regexp_replace(part, '\\.+\\s*$', '')), '') as p
            from source_records sr
            join sources s on s.id = sr.source_id,
                 lateral regexp_split_to_table(sr.fields ->> 'bgapmea_products', '[,;/]+') part
           where s.code = 'BGAPMEA'
             and sr.status = 'active'
             and nullif(trim(sr.fields ->> 'bgapmea_products'), '') is not null
        ),
        gots as (
          -- gots_product_category is the curated short list; gots_product_details
          -- is the verbose codes string (skipped — too noisy for buyer filtering).
          select sr.supplier_id,
                 nullif(trim(part), '') as p
            from source_records sr
            join sources s on s.id = sr.source_id,
                 lateral regexp_split_to_table(sr.fields ->> 'gots_product_category', '[,;/]+') part
           where s.code = 'GOTS'
             and sr.status = 'active'
             and nullif(trim(sr.fields ->> 'gots_product_category'), '') is not null
        ),
        wrap as (
          select sr.supplier_id,
                 nullif(trim(part), '') as p
            from source_records sr
            join sources s on s.id = sr.source_id,
                 lateral regexp_split_to_table(sr.fields ->> 'wrap_products', '[,;/]+') part
           where s.code = 'WRAP'
             and sr.status = 'active'
             and nullif(trim(sr.fields ->> 'wrap_products'), '') is not null
        ),
        existing as (
          select id as supplier_id, unnest(principal_products) as p
            from public.suppliers
           where array_length(principal_products, 1) > 0
        ),
        all_p as (
          select * from bgmea
          union all select * from epb
          union all select * from bkmea
          union all select * from bgapmea
          union all select * from gots
          union all select * from wrap
          union all select * from existing
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
           and (s.principal_products is distinct from agg.vals)
           and not exists (
             select 1 from public.supplier_field_locks l
              where l.supplier_id = s.id
                and l.column_name = 'principal_products'
                and l.released_at is null
           );
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
  count(*) filter (where established_date is not null)                      as with_established_date,
  count(*) filter (where array_length(principal_products, 1) > 0)           as with_principal_products,
  count(*) filter (where array_length(factory_types, 1) > 0)                as with_factory_types
from public.suppliers;
"""


def _parse_fetched_at(raw: Any) -> datetime | None:
    if not raw:
        return None
    if isinstance(raw, datetime):
        return raw
    s = str(raw).replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(s)
    except ValueError:
        return None


class Rest:
    """Supabase REST + service-role key (pooler :6543 times out from this machine)."""

    def __init__(self) -> None:
        base = os.environ.get("SUPABASE_URL", "").rstrip("/")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        if not base or not key:
            print("ERROR: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set", file=sys.stderr)
            raise SystemExit(1)
        self.base = base + "/rest/v1"
        self.client = httpx.Client(
            headers={"apikey": key, "Authorization": f"Bearer {key}"}, timeout=120
        )

    def all_rows(self, path: str, params: dict[str, str]) -> list[dict]:
        out: list[dict] = []
        offset = 0
        while True:
            r = self.client.get(
                f"{self.base}/{path}",
                params=params,
                headers={"Range": f"{offset}-{offset + 999}", "Prefer": "count=exact"},
            )
            r.raise_for_status()
            rows = r.json()
            out.extend(rows)
            if len(rows) < 1000:
                return out
            offset += 1000


def _candidates_for_column(
    column: str,
    records: list[dict],
    source_by_id: dict[str, str],
    entity_type_by_supplier: dict[str, str | None],
    *,
    unknown_employee_keys: list[str] | None = None,
) -> dict[str, list[NumericCandidate]]:
    """Build per-supplier candidate lists mirroring the SQL statements.

    Column mapping + caps live in ``etl.core.projection``. The
    ``entity_type = 'factory'`` gate on BGMEA ``machines_sewing`` stays here
    deliberately — the repair port does not apply it (REZ-100 non-goal).
    """
    by_sup: dict[str, list[NumericCandidate]] = {}
    for sr in records:
        sid = sr.get("supplier_id")
        if not sid:
            continue
        code = source_by_id.get(sr.get("source_id") or "", "")
        fields = sr.get("fields") or {}
        if not isinstance(fields, dict):
            continue
        unk = unknown_employee_keys if column == "employees_total" else None
        val = value_for_column(fields, code, column, unknown_employee_keys=unk)
        if val is None:
            continue
        # Residual divergence vs repair_bgmea_conflations: only the canonical
        # path refuses BGMEA machine counts on non-factory entity types.
        if column == "machines_sewing" and code == "BGMEA":
            if entity_type_by_supplier.get(sid) != "factory":
                continue
        if not within_numeric_cap(column, val):
            continue
        by_sup.setdefault(sid, []).append(
            NumericCandidate(
                value=val,
                source_tier=sr.get("source_tier") or "",
                fetched_at=_parse_fetched_at(sr.get("fetched_at")),
                record_id=str(sr.get("id") or ""),
                supplier_id=sid,
                source_code=code,
            )
        )
    return by_sup


def dry_run_numeric_diff(rest: Rest) -> dict[str, Any]:
    """Compute per-column change counts and largest corrections via REST."""
    sources = rest.all_rows("sources", {"select": "id,code", "code": "in.(BKMEA,BGMEA)"})
    source_by_id = {s["id"]: s["code"] for s in sources}
    source_ids = ",".join(source_by_id.keys())
    print(f"  sources: {{{', '.join(f'{v}' for v in source_by_id.values())}}}", flush=True)

    records = rest.all_rows(
        "source_records",
        {
            "select": "id,supplier_id,source_id,source_tier,fetched_at,fields",
            "status": "eq.active",
            "source_id": f"in.({source_ids})",
        },
    )
    print(f"  active BKMEA/BGMEA source_records: {len(records)}", flush=True)

    suppliers = rest.all_rows(
        "suppliers",
        {
            "select": "id,slug,company_name,entity_type," + ",".join(NUMERIC_COLUMNS),
        },
    )
    print(f"  suppliers: {len(suppliers)}", flush=True)
    entity_type_by_supplier = {s["id"]: s.get("entity_type") for s in suppliers}
    by_id = {s["id"]: s for s in suppliers}

    locks = rest.all_rows(
        "supplier_field_locks",
        {
            "select": "supplier_id,column_name",
            "released_at": "is.null",
            "column_name": f"in.({','.join(NUMERIC_COLUMNS)})",
        },
    )
    locked = {(r["supplier_id"], r["column_name"]) for r in locks}
    print(f"  live numeric field locks: {len(locked)}", flush=True)

    report: dict[str, Any] = {"per_column": {}, "downward": [], "upward": []}
    all_downward: list[dict[str, Any]] = []
    all_upward: list[dict[str, Any]] = []
    unknown_employee_keys: list[str] = []

    for col in NUMERIC_COLUMNS:
        unk = unknown_employee_keys if col == "employees_total" else None
        cand_map = _candidates_for_column(
            col, records, source_by_id, entity_type_by_supplier, unknown_employee_keys=unk
        )
        changed = 0
        downward = 0
        upward = 0
        for sid, cands in cand_map.items():
            if (sid, col) in locked:
                continue
            winner = pick_numeric_winner(cands)
            if winner is None:
                continue
            sup = by_id.get(sid)
            if not sup:
                continue
            before = sup.get(col)
            after = winner.value
            if before == after:
                continue
            changed += 1
            row = {
                "column": col,
                "supplier_id": sid,
                "slug": sup.get("slug"),
                "company_name": sup.get("company_name"),
                "before": before,
                "after": after,
                "delta": (after - before) if before is not None else after,
                "winner_source": winner.source_code,
                "winner_tier": winner.source_tier,
                "winner_fetched_at": (
                    winner.fetched_at.isoformat() if winner.fetched_at else None
                ),
            }
            if before is not None and after < before:
                downward += 1
                all_downward.append({**row, "delta": before - after})
            else:
                upward += 1
                all_upward.append(row)
        report["per_column"][col] = {
            "changed": changed,
            "downward": downward,
            "upward_or_fill": upward,
        }
        print(
            f"  {col}: {changed} changed ({downward} downward, {upward} upward/fill)",
            flush=True,
        )

    all_downward.sort(key=lambda r: r["delta"], reverse=True)
    all_upward.sort(key=lambda r: abs(r["delta"] or 0), reverse=True)
    report["downward"] = all_downward[:10]
    report["downward_total"] = len(all_downward)
    report["upward"] = all_upward[:15]
    report["upward_total"] = len(all_upward)
    # Unique unknown keys encountered while projecting employees_total
    unk_counts = Counter(unknown_employee_keys)
    report["unknown_employee_keys"] = dict(unk_counts.most_common())
    if unk_counts:
        print(f"  unknown BGMEA employees keys skipped: {dict(unk_counts)}", flush=True)
    else:
        print("  unknown BGMEA employees keys skipped: (none)", flush=True)
    return report


def format_dry_run_markdown(report: dict[str, Any]) -> str:
    lines: list[str] = [
        "## Profile numeric dry-run (REST, no writes)",
        "",
        "BGMEA `employees_total` is **production workers** = `Employee Male` + "
        "`Employee Female` within one record (REZ-95). `Management` is recognised "
        "and deliberately excluded. Cross-record winner rule is unchanged "
        "(REZ-68 / A8: highest `source_tier`, then most recent `fetched_at`). "
        "Two records' totals are never added to each other.",
        "",
        "### Suppliers changed per column",
        "",
        "| Column | Changed | Downward | Upward/fill |",
        "| -- | -- | -- | -- |",
    ]
    for col, stats in report["per_column"].items():
        lines.append(
            f"| `{col}` | {stats['changed']} | {stats['downward']} | "
            f"{stats['upward_or_fill']} |"
        )
    unk = report.get("unknown_employee_keys") or {}
    lines += [
        "",
        f"Total downward corrections across columns: **{report['downward_total']}**",
        f"Total upward/fill corrections across columns: **{report['upward_total']}**",
        "",
        "### Unknown BGMEA `employees` keys skipped (not summed)",
        "",
    ]
    if unk:
        lines.append("| Key | Sightings |")
        lines.append("| -- | -- |")
        for k, n in unk.items():
            lines.append(f"| `{k}` | {n} |")
    else:
        lines.append("_None — production payloads only use the three recognised cohorts._")
    lines += [
        "",
        "### Largest upward `employees_total` corrections (cohort sum vs stored max)",
        "",
        "| Supplier | Before -> After | Delta | Winning source |",
        "| -- | -- | -- | -- |",
    ]
    emp_up = [r for r in report.get("upward", []) if r["column"] == "employees_total"][:10]
    if not emp_up:
        lines.append("| _(none)_ | | | |")
    for row in emp_up:
        name = row.get("slug") or row.get("company_name") or row["supplier_id"][:8]
        lines.append(
            f"| {name} | {row['before']} -> {row['after']} | "
            f"+{row['delta']} | {row['winner_source']} ({row['winner_tier']}) |"
        )
    lines += [
        "",
        "### Ten largest downward corrections (any column)",
        "",
        "| Column | Supplier | Before -> After | Delta | Winning source |",
        "| -- | -- | -- | -- | -- |",
    ]
    for row in report["downward"]:
        name = row.get("slug") or row.get("company_name") or row["supplier_id"][:8]
        lines.append(
            f"| `{row['column']}` | {name} | {row['before']} -> {row['after']} | "
            f"{row['delta']} | {row['winner_source']} ({row['winner_tier']}) |"
        )
    lines += [
        "",
        "Production untouched. Re-run with `--apply` only after founder approval.",
    ]
    return "\n".join(lines)


def apply_via_psycopg() -> int:
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


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="execute UPDATEs via psycopg (default: REST dry-run, no writes)",
    )
    args = parser.parse_args()

    if args.apply:
        print("APPLY mode — writing via psycopg", flush=True)
        return apply_via_psycopg()

    print("Dry-run (REST) — no writes", flush=True)
    rest = Rest()
    report = dry_run_numeric_diff(rest)
    print()
    print(format_dry_run_markdown(report))
    return 0


if __name__ == "__main__":
    sys.exit(main())
