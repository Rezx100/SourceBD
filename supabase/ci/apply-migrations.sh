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
#      and clearing them silently would undo something somebody meant. NOT
#      refused, deliberately: PGPORT, which CI sets and a developer may need,
#      and PGOPTIONS. Both can still change what you are talking to, which is
#      why check 3 below asks what the database CONTAINS rather than anything
#      about the connection.
#   2. Allow only a host we can see is local, and pass it to psql explicitly
#      rather than letting it be read back out of the environment.
#   3. Ask the server what SHAPE it is in. Names lie and DNS moves, and how the
#      connection was made says nothing either; a database that already holds
#      `public` relations is not a throwaway, whatever it is called and however
#      you reached it.
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

# psql prints connection errors with the user and database it tried, so a
# PGUSER containing the refusal token would make an ordinary connection failure
# read as a refusal. It fails closed — 2 becomes 9 — but a guard that can be
# made to lie in either direction is not one to leave alone.
case "${PGUSER:-}${PGDATABASE:-}" in
  *REPLAY-REFUSED*)
    echo "apply-migrations.sh: refusing a PGUSER/PGDATABASE that contains the refusal token." >&2
    exit 9
    ;;
esac

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
  #
  # `supabase_db_*` is a glob, and the arm above was hardened this same round
  # because `127.*` also matched `127.0.0.1.nip.io` — a name somebody else
  # controls. Three reviewers pointed out this one had the identical hole:
  # `supabase_db_x.evil.example` matched it. A container name has no dots, so
  # require that.
  host.docker.internal) ;;
  postgres|db|supabase_db_*)
    case "$host" in
      *.*)
        echo "apply-migrations.sh: refusing PGHOST=$host — a container name has no dots, so this is a domain." >&2
        exit 9
        ;;
    esac
    ;;
  *)
    echo "apply-migrations.sh: refusing to run against PGHOST=$host." >&2
    echo "It replays all migrations and redefines auth.uid/role/jwt; local hosts only." >&2
    exit 9
    ;;
esac

: "${PGDATABASE:?set PGDATABASE}"
# libpq expands a conninfo string given as a dbname in some call paths. psql
# does not take that path, so this is not a demonstrated hole — it is one line
# that removes the question permanently rather than leaving it to be re-argued.
case "$PGDATABASE" in
  *=*|*:*|*/*)
    echo "apply-migrations.sh: refusing PGDATABASE=$PGDATABASE — it looks like a connection string, not a database name." >&2
    exit 9
    ;;
esac
root="$(cd "$(dirname "$0")/../.." && pwd)"
mig="$root/supabase/migrations"
# `|| true` because `set -euo pipefail` kills the shell at the assignment when
# grep matches nothing, so the diagnosis below could never print: an empty or
# renamed migrations directory exited 1 in silence.
last="$(ls "$mig" | grep -E '^[0-9]{4}_.*\.sql$' | sort | tail -1 || true)"
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

# The check that does not trust a name.
#
# There used to be an address test here as well — refuse unless
# `inet_server_addr()` is loopback or null. It is gone, and the reason is worth
# keeping because it argues against putting it back. It failed in both
# directions:
#
#   - It could not stop the attack it was written for. `inet_server_addr()` is
#     null over a unix socket and reports the SERVER's own view otherwise, so a
#     production database reached through a loopback tunnel
#     (`PGHOST=localhost PGPORT=15432` over `ssh -L`) or through a socket
#     answers "127.0.0.1" or null and sails past. PGPORT is a target component
#     the refusal list above deliberately does not take, because CI sets it and
#     a developer with Postgres on 5433 is doing nothing wrong.
#   - It refused the one job it exists to protect. GitHub Actions runs the
#     Postgres service on a Docker bridge, so the server answers from
#     172.18.0.2 while the runner reaches it on localhost. The first CI run
#     that ever reached this block failed with
#     "REPLAY-REFUSED: the server answered from 172.18.0.2".
#
#     Widening it to accept RFC1918 would have fixed that and made it weaker
#     still — 10/8 and 172.16/12 are exactly where a self-hosted production
#     database lives. A check that cannot stop the attack and does stop the
#     job is not worth carrying.
#
# What is left is the SHAPE of the target, which is the check that was always
# doing the work. This script replays from zero: a throwaway database has no
# `public` relations at all when it starts, and production has a hundred. That
# is catalog data, so unlike the `select count(*) from public.suppliers` it
# replaced, it cannot be softened by RLS — the trap the row count fell into,
# because a non-superuser role on production sees its own filtered zero and the
# guard would have read that as "throwaway". It is also indifferent to how the
# connection was made, which is the property the address test only pretended to
# have.
#
# `set local search_path = pg_catalog` first and every reference qualified:
# PGOPTIONS can set a search_path and is not one of the variables refused
# above.
guard_sql="do \$guard\$
declare
  rels bigint;
begin
  set local search_path = pg_catalog;

  select pg_catalog.count(*) into rels
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm');

  if rels > 0 then
    raise exception
      'REPLAY-REFUSED: public already holds % relations, so this is not an empty throwaway database', rels;
  end if;
end
\$guard\$;"

# `set +e` around the capture, NOT `if ! …`. Inside `if ! cmd; then`, `$?` is
# the status of the NEGATION and is therefore always 0 — so this block read
# psql's exit code as 0 and passed it to `exit`. Any connection failure, auth
# failure or wrong database ended the script with exit 0, zero migrations
# applied, the bootstrap never run and assert-0104.sql never run, and the CI
# job whose entire purpose is to execute 0104 reported a green check. Four
# reviewers found it independently; the test that was supposed to hold this
# script up asserted only `code !== 9`, which exit 0 satisfies.
set +e
guard_err="$(printf '%s\n' "$guard_sql" | psql -X -h "$host" -v ON_ERROR_STOP=1 -q -f - 2>&1 >/dev/null)"
guard_status=$?
set -e
if [ "$guard_status" -ne 0 ]; then
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

psql -X -h "$host" -v ON_ERROR_STOP=1 -q -f "$root/supabase/ci/00-supabase-bootstrap.sql"

applied=0
for f in $(ls "$mig" | grep '\.sql$' | sort | grep -v "^${last}$") "$last"; do
  echo "--- $f"
  psql -X -h "$host" -v ON_ERROR_STOP=1 -q -f "$mig/$f"
  applied=$((applied + 1))
done
echo "applied $applied migrations"

psql -X -h "$host" -v ON_ERROR_STOP=1 -q -f "$root/supabase/ci/assert-0104.sql"
