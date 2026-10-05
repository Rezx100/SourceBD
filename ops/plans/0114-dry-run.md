# 0114 — Evidence packs: dry run

Run 5 Oct 2026 through the Supabase MCP (`execute_sql`), the SQL printed by
`python ops/dry_run_0114_evidence_packs.py --print`. One `do` block that applies
the migration, builds a full pack (all three sections, CSV) as every live buyer
with saved suppliers, and then raises, so everything rolled back. Nothing committed.

Migration text md5 (LF, whole-line comments and blank lines removed, as run):
`ebd6b331086bc307b9bce2202aefab3c`.

```
existed_before                      table false, function false
definer                             true
anon_can_execute                    false
auth_can_execute                    true
rls_on                              true
write_grants                        0     (buyers read their own downloads only)
buyers_with_saved                   3
suppliers_in_packs                  39
rows_in_packs                       424
every_row_sourced_and_logged_once   true  (every row names a source and a check date;
                                           each pack wrote exactly one download row)
```

The first run found UFLPA rows with no check date: production has no UFLPA
screening rows (no saved supplier is on the list), so "no link found" now carries
the date our copy of the list was read (`sanctions_list_entries.fetched_at`).
The second run above is clean.

Additive only: one empty table, one function. No buyer-visible row changes.
Behaviour (certificates with state and source, a rejected certificate and an
unpublished supplier left out, the UFLPA state, sources with addresses, one
download row the buyer alone can read, bad input refused) is executed by CI on
every push: `supabase/ci/assert-0114.sql`.

## To apply (founder's go-ahead only, AGENTS rule 15)

Say "apply 0114". The agent re-runs this dry run (still `existed_before` all
false) and applies the file through the Supabase MCP `apply_migration`.

Rollback: the `drop` lines in the migration's header.
