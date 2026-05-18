#!/usr/bin/env bash
cd /opt/sourcebd
docker compose run --rm --entrypoint python etl - <<'PY'
import os, json, psycopg
from psycopg.rows import dict_row
c = psycopg.connect(os.environ["SUPABASE_DB_URL"], row_factory=dict_row)
cur = c.cursor()
cur.execute("""select s.company_name, s.email_primary, s.phones, s.address_raw, s.district,
                      s.contact_name, sr.fields
                 from public.suppliers s
                 join public.source_records sr on sr.supplier_id = s.id
                where s.bkmea_verified
                  and s.email_primary is not null
                order by s.updated_at desc
                limit 3""")
for r in cur.fetchall():
    print("="*70)
    print("name:    ", r["company_name"])
    print("email:   ", r["email_primary"])
    print("phones:  ", r["phones"])
    print("contact: ", r["contact_name"])
    print("address: ", r["address_raw"])
    print("district:", r["district"])
    print("payload keys:", sorted(r["fields"].keys()))
    print("employees:", r["fields"].get("bkmea_employees_total"),
          "machines_sewing:", r["fields"].get("bkmea_machines_sewing"),
          "capacity:", r["fields"].get("bkmea_production_capacity"))
PY
