#!/usr/bin/env bash
cd /opt/sourcebd
docker compose run --rm --entrypoint python etl - <<'PY'
import os, json, psycopg
from psycopg.rows import dict_row
c = psycopg.connect(os.environ["SUPABASE_DB_URL"], row_factory=dict_row)
cur = c.cursor()
cur.execute("""select sr.source_ref, sr.fetched_at, sr.fields,
                      s.email_primary, s.contact_name, s.address_raw, s.updated_at
                 from public.source_records sr
                 join public.suppliers s on s.id = sr.supplier_id
                 join public.sources src on src.id = sr.source_id
                where src.code = 'BKMEA' and sr.source_ref = '2828'""")
for r in cur.fetchall():
    print("ref:", r["source_ref"])
    print("fetched_at:", r["fetched_at"])
    print("supplier.updated_at:", r["updated_at"])
    print("supplier.email:", r["email_primary"])
    print("supplier.contact:", r["contact_name"])
    print("supplier.address:", r["address_raw"])
    print("source_records.fields:", json.dumps(r["fields"], indent=2)[:1500])
PY
