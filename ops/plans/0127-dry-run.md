# 0127 — the dealing tables refuse the delete of a person or a company: dry run

Migration: `supabase/migrations/0127_dealings_refuse_delete.sql` (moderation and evidence
plan, item 0b). Nineteen foreign keys on conversations, participants, messages, files, RFQs,
quotes, orders, milestones, claims, export records and admin actions go from
`on delete cascade` (or `set null`) to `on delete restrict`. No row changes.

## Status: NOT RUN against production (6 Oct 2026)

This machine has no database access (no psql, no Python, the pooler times out, the Supabase
MCP is not authorised in this session). The SQL is ready:

```
python ops/dry_run_0127_dealings_refuse_delete.py --print
```

Paste its output into the Supabase SQL editor or run it through the MCP `execute_sql`. It
is one `do` block that applies the migration, reads back every key and every row count, tries
to delete the first buyer who has a conversation, and then raises `DRYRUN_RESULT {...}` so
everything rolls back. Expected result:

```
all_restrict_after                       true
rows_unchanged                           true
delete_of_a_buyer_with_a_conversation    "refused: update or delete on table "users" violates foreign key constraint ..."
```

The behaviour itself is executed by CI on every push: `supabase/ci/assert-0127.sql` (a buyer,
a supplier user, a supplier company, a conversation, an RFQ, an order and a message with
dealings are all refused; a sign-up with no dealings still deletes; the review queue's merge
leaves the loser's dealings on the loser).

## What a founder should know before applying

- After this, deleting a user in the Supabase dashboard FAILS when that user has ever had a
  conversation, RFQ, quote, order, claim or export. That is the intent: close the account
  (suspend) instead. A user with no dealings still deletes as before.
- `ops/merge_duplicate_suppliers.py` deletes the loser supplier row at the end of a merge; it
  already refuses while anything references the loser, and a dealing is now such a reference.
- The review queue's Release merge (`_queue_absorb_supplier`) never deleted; it unpublishes the
  duplicate and leaves its conversations, RFQs, orders and claims on it. Not moved, by design:
  moving them would rewrite what the buyer dealt with.

## To apply (founder's go-ahead only, AGENTS rule 15)

Say "apply 0127". The agent re-runs this dry run, checks `rows_unchanged` and
`all_restrict_after`, and applies the file through the Supabase MCP `apply_migration` as
0107 was. Order with the deploy does not matter: no code reads these constraints.

Rollback: the same loop with `on delete cascade` (`set null` for `admin_audit_log.actor_id`).
