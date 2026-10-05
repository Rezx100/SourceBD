# 0113 — Saved-search alerts and the last search: dry run

Run 5 Oct 2026 through the Supabase MCP (`execute_sql`), the SQL printed by
`python ops/dry_run_0113_saved_search_alerts.py --print`. One `do` block that
applies the migration and then raises, so everything rolled back. Nothing committed.

Migration text md5 (LF, whole-line comments and blank lines removed, as run):
`3a705090aa8fe542785d1a3fa4dce21d`.

```
existed_before        columns false, table false, functions false
                      saved searches 0, buyer settings rows 29
switched_on           0       (the switch defaults off: nobody is emailed)
due                   0
alerts_rls_on         true
alerts_grants         0
job_service_only      true    (the job's 3 calls: service_role only)
buyer_calls_not_anon  true
buyers_read           29
last_search_all_null  true
```

Additive only: two nullable columns and one defaulted-off switch, one empty
table, five new functions. No buyer-visible row changes. Behaviour (due,
baseline, only the new ids, not due again for 6 days, suspended and
switched-off owners never due, the buyer cannot touch the job's table, the last
search reads back and knows when it is saved) is executed by CI on every push:
`supabase/ci/assert-0113.sql`.

## To apply (founder's go-ahead only, AGENTS rule 15)

Say "apply 0113". The agent re-runs this dry run (still `existed_before` all
false) and applies the file through the Supabase MCP `apply_migration`. Nothing
is emailed until the weekly job (Sonnet) ships and a buyer turns a switch on.

Rollback: the `drop` lines in the migration's header.
