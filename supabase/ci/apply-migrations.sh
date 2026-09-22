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

: "${PGDATABASE:?set PGDATABASE}"
root="$(cd "$(dirname "$0")/../.." && pwd)"
mig="$root/supabase/migrations"
last="$(ls "$mig" | grep -E '^[0-9]{4}_.*\.sql$' | sort | tail -1)"
if [ -z "$last" ]; then
  echo "apply-migrations.sh: no NNNN_*.sql migration found in $mig" >&2
  exit 1
fi
echo "newest numbered migration, applied last: $last"

psql -v ON_ERROR_STOP=1 -q -f "$root/supabase/ci/00-supabase-bootstrap.sql"

applied=0
for f in $(ls "$mig" | grep '\.sql$' | sort | grep -v "^${last}$") "$last"; do
  echo "--- $f"
  psql -v ON_ERROR_STOP=1 -q -f "$mig/$f"
  applied=$((applied + 1))
done
echo "applied $applied migrations"

psql -v ON_ERROR_STOP=1 -q -f "$root/supabase/ci/assert-0104.sql"
