# 0129 — supplier claims: who, a decision at any stage, resend: dry run

Moderation and evidence plan, item 0e. Migration
`supabase/migrations/0129_claims_admin_any_stage.sql`: `claim_admin_list` gains the claimant's
user id, the link's expiry and the email journal; `claim_admin_decide` works at any open stage
with a reason; new `claim_admin_resend`; `rl_check` learns `email:claim_verify`. No row changes.

## Status: NOT RUN against production (6 Oct 2026)

This machine has no database access. The SQL is ready:

```
python ops/dry_run_0129_claims.py --print
```

Paste its output into the Supabase SQL editor or run it through the MCP `execute_sql`. It
applies the migration inside one block, reads the figures below, and raises
`DRYRUN_RESULT {...}` so everything rolls back.

## Why the three claims are stuck at the email step: what the dry run will say

Two figures answer it before anything is changed:

| Figure | What it means |
| -- | -- |
| `pending_email_with_expired_link` | claims whose 24-hour link ran out unclicked. The status flips to `expired` only when someone clicks after the deadline, so an unclicked claim sits at `pending_email` for ever. Expected: 3. |
| `email_journal_rows_for_any_claim` | whether any verification email was ever journaled. Expected: 0, because the old route sent through `sendTransactionalEmail`, which wrote no `email_log` row, so a failed send (no `RESEND_API_KEY`, a Resend error, a bad origin) was invisible. |

From this release every claim email goes through the journaled sender with the claim id as
its reference, and the admin page shows "Sent …", "Failed …: <why>" or "No record" per claim,
plus whether the link has expired. The three stuck claims have no record (sent before the
journal); Resend gives each a fresh link and a journaled send.

## To apply (founder's go-ahead only, AGENTS rule 15)

Say "apply 0129". The agent re-runs this dry run, checks `rows_unchanged`, that every function
is `security_definer` with `anon: false`, and `rl_check_knows_claim_verify`, and applies the
file through the Supabase MCP `apply_migration` as 0107 was. Deploy order: the page and the
route call the new keys and `claim_admin_resend`; until 0129 is applied, the page draws the
rows without the journal and Resend answers "function not found". Apply before or with the deploy.

Rollback: `drop function public.claim_admin_resend(uuid)`; restore `claim_admin_list` and
`claim_admin_decide` from `0032_supplier_claims.sql`; re-run the rl_check patch without
`email:claim_verify`.
