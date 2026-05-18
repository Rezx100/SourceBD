#!/usr/bin/env bash
cd /opt/sourcebd
docker compose run --rm --entrypoint python etl - <<'PY'
import os, psycopg
c = psycopg.connect(os.environ["SUPABASE_DB_URL"])
cur = c.cursor()
cur.execute("select count(*) from public.suppliers"); print("suppliers:", cur.fetchone()[0])
cur.execute("select count(*) from public.suppliers where bkmea_verified=true"); print("bkmea_verified:", cur.fetchone()[0])
cur.execute("select count(*) from public.suppliers where bgmea_verified=true"); print("bgmea_verified:", cur.fetchone()[0])
cur.execute("select count(*) from public.source_records"); print("source_records:", cur.fetchone()[0])
print("\n=== recent etl_runs ===")
cur.execute("""select scraper_code, status, records_seen, records_upserted, records_skipped,
                      started_at::text, coalesce(finished_at::text,'(running)') as finished_at,
                      error
                 from public.etl_runs order by started_at desc limit 8""")
for r in cur.fetchall():
    print(r)
PY
