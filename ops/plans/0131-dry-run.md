# 0131 — the activity record: dry run

Moderation and evidence plan, item 1a. Migration `supabase/migrations/0131_activity_ledger.sql`:
the append-only `activity_ledger` table, the one writer `_ledger_write`, and a trigger on each of
the seven dealing tables (messages, conversations, files, RFQs, quotes, orders, milestones) that
writes every insert, edit and delete down with the row before and after.

From the moment it is applied, every dealing is recorded. Rows that already exist get their
"as found" entry in phase 1f; the dry run below counts them.

## Status: NOT RUN against production (6 Oct 2026)

This machine has no database access. The SQL is ready:

```
python ops/dry_run_0131_activity_ledger.py --print
```

Paste it into the Supabase SQL editor or run it through the MCP `execute_sql`. It applies the
migration inside one block, probes the record (a writer call, then an UPDATE and a DELETE that
must be refused), counts the dealing tables, and raises `DRYRUN_RESULT {...}` so everything rolls
back. Expected:

```
rls_on                               true
authenticated_select / insert        false / false
service_role_update / delete         false / false
writer_callable_by_authenticated     false
update_on_record                     "refused: the activity record is append-only: UPDATE is refused"
delete_on_record                     "refused: the activity record is append-only: DELETE is refused"
dealing_rows_unchanged               true
```

The behaviour itself is executed by CI on every push: `supabase/ci/assert-0131.sql` (a sent
message's entry with sender, email, role, other party, conversation, supplier, both addresses,
browser, session and the text's fingerprint but never the text; RFQ, quote, acceptance, order,
milestone, cancel and delete each with their kind and the row before and after; a touch writes
nothing; UPDATE, DELETE and TRUNCATE refused for the owner; a signed-in person cannot read it).

## Cost

One extra row per dealing, written in the same transaction. A message also costs one decrypt
for its fingerprint. Nothing a buyer sees changes.

## To apply (founder's go-ahead only, AGENTS rule 15)

Say "apply 0131". The agent re-runs this dry run, checks the expected lines above, and applies the
file through the Supabase MCP `apply_migration` as 0107 was. Apply BEFORE the 1b deploy or with
it: 1b's code only adds two request headers, which this migration reads when present and
leaves null when not.

Rollback: the REVERSE section of the migration. Dropping the table is the one delete of the
record this plan ever allows, and only by hand.
