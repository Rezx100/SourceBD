#!/usr/bin/env bash
# Replay every migration against a throwaway Postgres, newest last, and stop
# on the first error. See 00-supabase-bootstrap.sql for why.
#
# Order: filename, EXCEPT that the highest-numbered `NNNN_` migration is
# applied last. The directory mixes two naming schemes — `0001_`…`0104_` and
# `20260724…` — and a plain sort puts the date-named ones after the numbered
# ones even though production applied them months earlier.
# `20260810065452_rsc_workers_batch_discover.sql` redefines
# discover_suppliers, so a plain sort would silently overwrite the newest
# definition, which is the one this exercise exists to execute.
#
# Derived, not hardcoded: pinning the literal `0104_discover_v32.sql` was
# itself the hazard it describes — the day `0105_*.sql` lands it sorts after
# 0104 and the forced-last rule then pushes it back in FRONT of 0104, quietly
# re-creating the overwrite. The rule is "the newest numbered migration goes
# last", so say that.
set -euo pipefail

# This script replays EVERY migration and `create or replace`s auth.uid,
# auth.role and auth.jwt (00-supabase-bootstrap.sql). It takes its target from
# ambient PG* env, and .claude/hooks/guard.py blocks `psql -c` but not
# `psql -f` — so the environment is the whole distance between a throwaway CI
# container and production.
#
# The first version of this guard checked PGHOST alone. Three reviewers broke
# it the same way within an hour, because libpq reads more than PGHOST:
# PGHOSTADDR is the address it actually dials (PGHOST then only names the host
# for authentication and SNI), PGSERVICE/PGSERVICEFILE can supply a host of
# their own, and PGHOST itself accepts a comma-separated list, so
# `/tmp,db.prod…` satisfied a check written for a socket path. It also refused
# DATABASE_URL/SUPABASE_DB_URL/PGURL, none of which libpq reads at all: it
# blocked what was inert and admitted what was live. Worse, refusing a variable
# this machine's own verification gate asks the founder to export is exactly
# what teaches somebody to move their target into a variable nothing checks.
#
# So: three checks, cheapest first, and the last one does not trust a name.
#
#   1. Refuse the redirect variables outright. A local replay never needs them,
#      and clearing them silently would undo something somebody meant.
#   2. Allow only a host we can see is local, and pass it to psql explicitly
#      rather than letting it be read back out of the environment.
#   3. Ask the server. Names lie and DNS moves; a database that already holds
#      suppliers is not a throwaway, whatever it is called.
#
# Exit 9 throughout: psql itself uses 0-3 (2 is a failed connection), a missing
# PGDATABASE exits 1 and a missing psql exits 127, so 9 lets a test tell the
# refusal from the script failing for some other reason.
for redirect in PGHOSTADDR PGSERVICE PGSERVICEFILE PGTARGETSESSIONATTRS; do
  eval "redirect_value=\${$redirect:-}"
  if [ -n "$redirect_value" ]; then
    echo "apply-migrations.sh: refusing to run with $redirect set." >&2
    echo "libpq takes its target from $redirect rather than from PGHOST, so the host check below would be reading the wrong variable. Unset it." >&2
    exit 9
  fi
done

host="${PGHOST:-localhost}"
case "$host" in
  *,*)
    # A comma-separated list: libpq tries each in turn, so one local-looking
    # entry says nothing about where the connection ends up.
    echo "apply-migrations.sh: refusing PGHOST=$host, which names more than one target." >&2
    exit 9
    ;;
  localhost|localhost.|::1|0.0.0.0) ;;
  # A unix socket directory — local by construction, and it cannot be a list
  # because the arm above already caught those.
  /*) ;;
  # 127.0.0.0/8, all of which is loopback — but only as an actual dotted
  # quad. A bare `127.*` glob also matched `127.0.0.1.nip.io`, and the same
  # glob would have taken `127.anything.example`, which is a name somebody
  # else controls.
  127.*)
    if [ -n "${host//[0-9.]/}" ]; then
      echo "apply-migrations.sh: refusing PGHOST=$host — it starts like a loopback address but is a name." >&2
      exit 9
    fi
    ;;
  # The names a local Postgres answers to: compose services, the Supabase
  # CLI's own container, Docker Desktop's host alias.
  postgres|db|host.docker.internal|supabase_db_*) ;;
  *)
    echo "apply-migrations.sh: refusing to run against PGHOST=$host." >&2
    echo "It replays all migrations and redefines auth.uid/role/jwt; local hosts only." >&2
    exit 9
    ;;
esac

: "${PGDATABASE:?set PGDATABASE}"
root="$(cd "$(dirname "$0")/../.." && pwd)"
mig="$root/supabase/migrations"
last="$(ls "$mig" | grep -E '^[0-9]{4}_.*\.sql$' | sort | tail -1)"
if [ -z "$last" ]; then
  echo "apply-migrations.sh: no NNNN_*.sql migration found in $mig" >&2
  exit 1
fi
echo "newest numbered migration, applied last: $last"

# Everything above refuses on names alone and must run even where psql is not
# installed — a developer reading the refusal is the point. From here on psql
# is required, and its absence is 127, not a refusal.
if ! command -v psql >/dev/null 2>&1; then
  echo "apply-migrations.sh: psql is not on PATH." >&2
  exit 127
fi

# The check that does not trust a name. `inet_server_addr()` is null over a
# unix socket and the peer address otherwise. A populated `suppliers` table
# means this is somebody's real database whatever PGHOST called it; a
# throwaway container answers null-or-loopback and has no such table yet.
guard_sql="do \$guard\$
declare
  addr inet := inet_server_addr();
  n bigint := 0;
begin
  if addr is not null and not (addr <<= inet '127.0.0.0/8' or addr = inet '::1') then
    raise exception 'REPLAY-REFUSED: the server answered from %, which is not a loopback address', addr;
  end if;
  if to_regclass('public.suppliers') is not null then
    execute 'select count(*) from public.suppliers' into n;
    if n > 0 then
      raise exception 'REPLAY-REFUSED: public.suppliers already holds % rows, so this is not a throwaway database', n;
    end if;
  end if;
end
\$guard\$;"

if ! guard_err="$(printf '%s\n' "$guard_sql" | psql -h "$host" -v ON_ERROR_STOP=1 -q -f - 2>&1 >/dev/null)"; then
  guard_status=$?
  printf '%s\n' "$guard_err" >&2
  case "$guard_err" in
    # Matched on a token nothing else emits. Matching on the script's own name
    # looked tidier and was wrong: when psql is missing, bash's own
    # "apply-migrations.sh: line N: psql: command not found" matched it, and a
    # machine with no psql reported the refusal exit for every host including
    # the local ones. Anything that is not our raise keeps its own exit code.
    *"REPLAY-REFUSED:"*) exit 9 ;;
  esac
  exit "$guard_status"
fi

psql -h "$host" -v ON_ERROR_STOP=1 -q -f "$root/supabase/ci/00-supabase-bootstrap.sql"

applied=0
for f in $(ls "$mig" | grep '\.sql$' | sort | grep -v "^${last}$") "$last"; do
  echo "--- $f"
  psql -h "$host" -v ON_ERROR_STOP=1 -q -f "$mig/$f"
  applied=$((applied + 1))
done
echo "applied $applied migrations"

psql -h "$host" -v ON_ERROR_STOP=1 -q -f "$root/supabase/ci/assert-0104.sql"
