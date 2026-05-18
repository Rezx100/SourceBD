#!/usr/bin/env bash
# Supervisor: runs the full BKMEA pipeline overnight, restartable & self-healing.
# Detached in tmux session "supervisor". Safe to disconnect SSH / shut laptop.
set -u
cd /opt/sourcebd
LOG_DIR=/opt/sourcebd/etl/logs
mkdir -p "$LOG_DIR"
SLOG="$LOG_DIR/supervisor.log"

ts() { date -u +'%Y-%m-%dT%H:%M:%SZ'; }
log() { echo "[$(ts)] $*" | tee -a "$SLOG"; }

run_once() {
  local code="$1"
  local logf="$LOG_DIR/${code}.$(date -u +%Y%m%dT%H%M%SZ).log"
  log "START $code -> $logf"
  docker compose run --rm etl run "$code" >>"$logf" 2>&1
  local rc=$?
  log "END   $code rc=$rc"
  return $rc
}

# -- Phase A: list scrape (bkmea_web). Retry up to 3 times on failure.
attempt=0
while [ "$attempt" -lt 3 ]; do
  attempt=$((attempt+1))
  log "bkmea_web attempt $attempt"
  if run_once bkmea_web; then
    log "bkmea_web SUCCESS on attempt $attempt"
    break
  fi
  log "bkmea_web failed, sleeping 60s before retry"
  sleep 60
done

# -- Phase B: detail enrichment. Loop until two consecutive runs find nothing
#    new to enrich (i.e. all suppliers have email or address). Cap at 6 passes.
empty_streak=0
pass=0
while [ "$pass" -lt 6 ] && [ "$empty_streak" -lt 2 ]; do
  pass=$((pass+1))
  log "bkmea_detail pass $pass (empty_streak=$empty_streak)"
  before=$(docker compose run --rm --entrypoint python etl - <<'PY' 2>/dev/null | tail -1
import os, psycopg
c = psycopg.connect(os.environ["SUPABASE_DB_URL"])
cur = c.cursor()
cur.execute("""
  select count(*) from public.suppliers s
   where exists (select 1 from public.source_records sr
                  join public.sources src on src.id = sr.source_id
                 where sr.supplier_id = s.id and src.code = 'BKMEA')
     and (s.email_primary is null or s.address_raw is null)
""")
print(cur.fetchone()[0])
PY
)
  log "  suppliers needing enrichment: $before"
  if [ "${before:-0}" = "0" ]; then
    log "  nothing left to enrich -> done"
    break
  fi
  if run_once bkmea_detail; then
    after=$(docker compose run --rm --entrypoint python etl - <<'PY' 2>/dev/null | tail -1
import os, psycopg
c = psycopg.connect(os.environ["SUPABASE_DB_URL"])
cur = c.cursor()
cur.execute("""
  select count(*) from public.suppliers s
   where exists (select 1 from public.source_records sr
                  join public.sources src on src.id = sr.source_id
                 where sr.supplier_id = s.id and src.code = 'BKMEA')
     and (s.email_primary is null or s.address_raw is null)
""")
print(cur.fetchone()[0])
PY
)
    log "  after pass: $after still need enrichment"
    if [ "${after:-0}" = "${before:-x}" ]; then
      empty_streak=$((empty_streak+1))
    else
      empty_streak=0
    fi
  else
    log "  bkmea_detail rc!=0, sleep 120s"
    sleep 120
  fi
done

log "SUPERVISOR DONE"
