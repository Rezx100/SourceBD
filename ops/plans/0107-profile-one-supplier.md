# 0107 — `buyer_supplier_profile` reads one supplier's rows (applied 29 Sep 2026)

Migration: `supabase/migrations/0107_buyer_supplier_profile_one_supplier.sql`.
Script: `ops/dry_run_0107_profile_one_supplier.py` (one transaction, always
rolled back). Why: `ops/plans/buyer-app-speed-29sep.md` — opening a record
took 3.9–4.9 s on the live site, 1.1 s of it this function, and a line
called it twice.

## What changes

Two FROM clauses. The `pills` and `addresses` CTEs joined a view to the
one-row CTE `s`; the planner cannot push a join into a view, so each view was
built for every supplier and then matched. They now filter on
`(select id from s)`, which the planner pushes into every UNION ALL branch.
Nothing else in the function changes: the body is production's live
definition (md5 `63ee7ea06bacb0d30a537d78bc38ae28`, 16,265 bytes, read
29 Sep 2026) with those two clauses and two comments. The rebuilt copy of the
live text matched that md5 byte for byte before the two clauses were changed.
Production's copy is ahead of the repo (it carries `'fetched_at', rr.fetched_at`
on RSC rows, which no migration adds), which is why 0107 is built from the
live text and not from 0099; the dry-run script stops if the live definition
has changed since.

## Evidence (production, 29 Sep 2026)

The new body was created as a session-only copy (`pg_temp.bsp_0107`) through
the Supabase MCP and compared with the live function. Nothing was written to
any schema; the copy vanished with the session. `SUPABASE_DB_URL`'s pooler
timed out from this machine (as on 25 Sep), so the psycopg script has not run
here; it performs the same checks inside a rolled-back transaction and is the
one to run before applying.

Same payload (`jsonb` equality, old against new):

| Records | Picked as | Different |
| -- | -- | -- |
| 34 | at random (two seeds) | 0 |
| 12 | the most active source records | 0 |
| 6 | mothers of facility buildings | 0 |
| 4 | EPB-only | 0 |
| 3 | named: benchmark-apparels, iris-fabrics, aboni-knitwear | 0 |
| 1 | an unknown slug | both null |

The extension-building, sanctioned and partner branches have no published
record today; their SQL is unchanged.

Time in the database, 8 records, median: **1,120 ms before, 318 ms after**.
One record alone: `v_supplier_registry_ids` 284 ms → 3 ms;
`v_supplier_addresses` 731 ms → 178 ms. What is left of the 318 ms is mostly
that view's materialised `src` CTE (all 22,140 active source records), which
other readers of the view share; changing the view is a separate decision.

## The command for the founder

Dry run again first (safe, rolled back, no approval needed):

```
python ops/dry_run_0107_profile_one_supplier.py
```

It must end `RESULT : clean — safe to apply`. Then, one transaction:

```
psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -1 -f E:/SourceBD/supabase/migrations/0107_buyer_supplier_profile_one_supplier.sql
```

or paste the file into the Supabase SQL editor. No deploy order: the payload
is identical before and after, so the code does not care which comes first.
Rollback, if ever needed: `ops/rollback_0107_buyer_supplier_profile.sql` is
the live definition as read on 29 Sep (its text hashes to the md5 above), run
the same way.

## Applied (29 Sep 2026, ~08:30 UTC)

On the founder's go-ahead in chat. The script above still could not connect
(the pooler timed out again), so its checks were run through the Supabase MCP
instead, and the apply went the same way (`apply_migration`, recorded in
`supabase_migrations.schema_migrations` as `20260929083008
0107_buyer_supplier_profile_one_supplier`).

The statement (from `create or replace` to the closing `$function$`, 16,894
bytes, md5 `81dd9bd50d0e8b4c51f2dae96ad7f6bd`) was sent as a string literal
and run with `execute` inside one `do` block, which refused unless the
literal's md5 matched the file and the live definition was still the base
above. That proves the bytes that ran are the file's.

Dry run first (session-only `pg_temp` copy of that same literal; nothing
persisted), on the script's own sample:

| Records | Picked as | Different | Median before | Median after |
| -- | -- | -- | -- | -- |
| 20 | at random | 0 | 962 ms | 168 ms |
| 12 | the most active source records | 0 | 1,041 ms | 248 ms |
| 8 | mothers of facility buildings | 0 | 1,121 ms | 322 ms |
| 4 | EPB-only | 0 | 961 ms | 170 ms |
| 1 | an unknown slug | 0 (both null) | 2 ms | 1 ms |
| **45** | all | **0** | **967 ms** | **171 ms** |

The apply block then also refused unless volatility, `SECURITY DEFINER`,
`search_path`, grants and owner were unchanged and the new filter was in the
body. After: live md5 `8648d817b31901d05edd72dddcf90089`, 12 further records
at random all whole, median 170 ms; `aboni-knitwear` returns its 10 registry
pills.
