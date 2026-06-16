"""Sample inspection of RSC fields + suppliers.city for no-address suppliers."""
from etl.core.config import settings
import psycopg, json

url = settings.supabase_db_url + ("&" if "?" in settings.supabase_db_url else "?") + "sslmode=require"
c = psycopg.connect(url, prepare_threshold=None, connect_timeout=30)
cur = c.cursor()

# Check whether these "no-address" suppliers nevertheless have city / district / lat / lng populated
cur.execute("""
with addr_have as (select distinct supplier_id from public.v_supplier_addresses),
no_addr as (
  select s.*
  from public.suppliers s
  left join addr_have ah on ah.supplier_id = s.id
  where coalesce(nullif(btrim(s.address_raw),''), null) is null
    and ah.supplier_id is null
)
select
  count(*) total,
  count(*) filter (where city is not null and btrim(city)<>'')     as has_city,
  count(*) filter (where district is not null and btrim(district)<>'')  as has_district,
  count(*) filter (where lat is not null)                              as has_lat,
  count(*) filter (where website is not null and btrim(website)<>'')   as has_website,
  count(*) filter (where contact_name is not null and btrim(contact_name)<>'') as has_contact_name,
  count(*) filter (where array_length(phones,1)>=1)                    as has_phones
from no_addr;
""")
labels = ["total","has_city","has_district","has_lat","has_website","has_contact_name","has_phones"]
print("--- no-address suppliers: what else do we know about them? ---")
for k, v in zip(labels, cur.fetchone()):
    print(f"  {k:20s} {v}")

# Pull 8 sample rows: name, slug, source_tags, city, district, plus the RSC source_record fields
cur.execute("""
with addr_have as (select distinct supplier_id from public.v_supplier_addresses),
no_addr as (
  select s.id, s.company_name, s.slug, s.source_tags, s.city, s.district, s.country
  from public.suppliers s
  left join addr_have ah on ah.supplier_id = s.id
  where coalesce(nullif(btrim(s.address_raw),''), null) is null
    and ah.supplier_id is null
  limit 8
)
select na.company_name, na.slug, na.source_tags, na.city, na.district,
       sr.fields->>'rsc_location'         as rsc_location,
       sr.fields->>'rsc_factory_name'     as rsc_factory_name,
       sr.fields->'raw'                   as raw_blob_preview
from no_addr na
join public.source_records sr on sr.supplier_id = na.id
join public.sources src on src.id = sr.source_id and src.code='RSC';
""")
print()
print("--- 8 samples ---")
for name, slug, tags, city, district, rsc_loc, rsc_fac, raw in cur.fetchall():
    print(f"{name}  [{slug}]")
    print(f"  source_tags={tags}  suppliers.city={city!r}  district={district!r}")
    print(f"  rsc_location={rsc_loc!r}  rsc_factory_name={rsc_fac!r}")
    # show just the keys of the raw blob
    if isinstance(raw, dict):
        addr_like = {k: v for k, v in raw.items() if any(t in k.lower() for t in ("addr","loc","city","dist","street","road"))}
        print(f"  raw addr-keys: {addr_like}")
    print()

# What does the Accord raw blob's address structure actually look like? Dump one full.
cur.execute("""
with addr_have as (select distinct supplier_id from public.v_supplier_addresses),
no_addr as (
  select s.id
  from public.suppliers s
  left join addr_have ah on ah.supplier_id = s.id
  where coalesce(nullif(btrim(s.address_raw),''), null) is null
    and ah.supplier_id is null
  limit 1
)
select sr.fields->'raw'
from no_addr na
join public.source_records sr on sr.supplier_id = na.id
join public.sources src on src.id = sr.source_id and src.code='RSC';
""")
print("--- one full raw blob ---")
print(json.dumps(cur.fetchone()[0], indent=2)[:2500])

c.close()
