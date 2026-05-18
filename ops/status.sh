#!/usr/bin/env bash
# Quick "what's the state?" — safe to run anytime, including via mobile SSH.
cd /opt/sourcebd
echo "=== TMUX ==="
tmux ls 2>&1 || echo "(no sessions)"
echo
echo "=== SUPERVISOR TAIL ==="
tail -30 /opt/sourcebd/etl/logs/supervisor.log 2>/dev/null || echo "(no supervisor log)"
echo
echo "=== LATEST LOG FILES ==="
ls -lt /opt/sourcebd/etl/logs/ 2>/dev/null | head -10
echo
echo "=== DB STATUS ==="
docker compose run --rm --entrypoint python etl - <<'PY'
import os, psycopg
c = psycopg.connect(os.environ["SUPABASE_DB_URL"])
cur = c.cursor()
cur.execute("select count(*) from public.suppliers"); print("suppliers total:        ", cur.fetchone()[0])
cur.execute("select count(*) from public.suppliers where bkmea_verified=true"); print("bkmea_verified:         ", cur.fetchone()[0])
cur.execute("select count(*) from public.suppliers where email_primary is not null"); print("with email:             ", cur.fetchone()[0])
cur.execute("select count(*) from public.suppliers where address_raw is not null"); print("with address:           ", cur.fetchone()[0])
cur.execute("select count(*) from public.suppliers where contact_name is not null"); print("with contact_name:      ", cur.fetchone()[0])
cur.execute("select count(*) from public.suppliers where array_length(phones,1) > 0"); print("with phone:             ", cur.fetchone()[0])
cur.execute("select count(*) from public.source_records"); print("source_records:         ", cur.fetchone()[0])
print()
print("=== recent etl_runs ===")
cur.execute("""select scraper_code, status, records_seen, records_upserted, records_skipped,
                      to_char(started_at,'MM-DD HH24:MI') as start,
                      coalesce(to_char(finished_at,'HH24:MI'),'(running)') as fin
                 from public.etl_runs order by started_at desc limit 10""")
for r in cur.fetchall():
    print(r)
PY
