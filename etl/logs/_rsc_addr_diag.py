"""Diagnose what RSC actually stored for the 789 no-address suppliers."""
from etl.core.config import settings
import psycopg, json

url = settings.supabase_db_url + ("&" if "?" in settings.supabase_db_url else "?") + "sslmode=require"
c = psycopg.connect(url, prepare_threshold=None, connect_timeout=30)
cur = c.cursor()

# Step 1: full breakdown of what fields RSC source_records actually carry,
# restricted to the 789 suppliers that currently have no surfaced address.
cur.execute("""
with addr_have as (select distinct supplier_id from public.v_supplier_addresses),
no_addr as (
  select s.id
  from public.suppliers s
  left join addr_have ah on ah.supplier_id = s.id
  where coalesce(nullif(btrim(s.address_raw),''), null) is null
    and ah.supplier_id is null
),
rsc as (
  select sr.supplier_id, sr.fields
  from public.source_records sr
  join public.sources src on src.id = sr.source_id
  where src.code = 'RSC' and sr.status='active'
)
select
  count(*)                                                                       as rsc_rows,
  count(*) filter (where coalesce(nullif(fields->>'rsc_factory_address',''), null) is not null) as has_rsc_factory_address,
  count(*) filter (where coalesce(nullif(fields->>'address',''), null) is not null)            as has_address_key,
  count(*) filter (where coalesce(nullif(fields->>'raw_address',''), null) is not null)        as has_raw_address_key,
  count(*) filter (where coalesce(nullif(fields->>'rsc_location',''), null) is not null)       as has_rsc_location,
  count(*) filter (where coalesce(nullif(fields->>'rsc_factory_name',''), null) is not null)   as has_rsc_factory_name
from rsc r
where r.supplier_id in (select id from no_addr);
""")
row = cur.fetchone()
labels = ["rsc_rows", "has_rsc_factory_address", "has_address_key",
          "has_raw_address_key", "has_rsc_location", "has_rsc_factory_name"]
print("--- RSC source_records for the no-address suppliers ---")
for k, v in zip(labels, row):
    print(f"  {k:30s} {v}")

# Step 2: distinct top-level field-keys present in those RSC records.
cur.execute("""
with addr_have as (select distinct supplier_id from public.v_supplier_addresses),
no_addr as (
  select s.id
  from public.suppliers s
  left join addr_have ah on ah.supplier_id = s.id
  where coalesce(nullif(btrim(s.address_raw),''), null) is null
    and ah.supplier_id is null
),
rsc as (
  select sr.fields
  from public.source_records sr
  join public.sources src on src.id = sr.source_id
  where src.code='RSC' and sr.status='active'
    and sr.supplier_id in (select id from no_addr)
)
select key, count(*) c
from rsc, jsonb_each_text(fields)
group by 1
order by 2 desc;
""")
print()
print("--- field keys present (RSC, no-address subset) ---")
for k, n in cur.fetchall():
    print(f"  {k:35s} {n}")

# Step 3: peek 5 sample rows.
cur.execute("""
with addr_have as (select distinct supplier_id from public.v_supplier_addresses),
no_addr as (
  select s.id, s.name, s.slug, s.source_tags
  from public.suppliers s
  left join addr_have ah on ah.supplier_id = s.id
  where coalesce(nullif(btrim(s.address_raw),''), null) is null
    and ah.supplier_id is null
  limit 5
)
select na.name, na.slug, na.source_tags, sr.fields
from no_addr na
join public.source_records sr on sr.supplier_id = na.id
join public.sources src on src.id = sr.source_id and src.code='RSC';
""")
print()
print("--- sample 5 ---")
for name, slug, tags, fields in cur.fetchall():
    print(f"{name}  [{slug}]  tags={tags}")
    print(f"  fields keys: {sorted(fields.keys())}")
    for k in ("rsc_location","rsc_factory_address","address","raw_address","city","district"):
        if k in fields:
            print(f"  {k} = {fields[k]!r}")
    print()

c.close()
