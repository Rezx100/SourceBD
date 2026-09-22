#!/usr/bin/env bash
# Replay every migration against a throwaway Postgres, newest last, and stop
# on the first error. See 00-supabase-bootstrap.sql for why.
#
# Order: filename, EXCEPT that 0104 is applied last. The directory mixes two
# naming schemes — `0001_`…`0104_` and `20260724…` — and a plain sort puts the
# date-named ones after 0104 even though production applied them months
# earlier. `20260810065452_rsc_workers_batch_discover.sql` redefines
# discover_suppliers, so a plain sort would silently overwrite the function
# this whole exercise is here to execute.
set -euo pipefail

: "${PGDATABASE:?set PGDATABASE}"
root="$(cd "$(dirname "$0")/../.." && pwd)"
mig="$root/supabase/migrations"
last="0104_discover_v32.sql"

psql -v ON_ERROR_STOP=1 -q -f "$root/supabase/ci/00-supabase-bootstrap.sql"

applied=0
for f in $(ls "$mig" | grep '\.sql$' | sort | grep -v "^${last}$") "$last"; do
  echo "--- $f"
  psql -v ON_ERROR_STOP=1 -q -f "$mig/$f"
  applied=$((applied + 1))
done
echo "applied $applied migrations"

psql -v ON_ERROR_STOP=1 -q -f "$root/supabase/ci/assert-0104.sql"
