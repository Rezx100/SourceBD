# 0130 — a suspended account is stopped by the database: the gap, proven, and the dry run

Moderation and evidence plan, item 0f. Migration
`supabase/migrations/0130_suspension_enforced_in_database.sql`.

## The gap: proven from the code (6 Oct 2026)

`profiles.is_suspended` is read in one place that stops anything: `middleware.ts`, which turns a
suspended person away from `/app`, `/supplier`, `/admin` and `/api/v1`. No RLS policy and no
SECURITY DEFINER function checks it. The browser's Supabase client holds the session's own
token and talks to PostgREST, which our middleware never sees. So a suspended person with a
live session could call `thread_send_message`, `rfq_create`, `rfq_quote_submit`,
`order_create`, `order_milestone_add`, `claim_initiate` or `supplier_relationship_request`
directly and be served. Real, not only likely.

Not demonstrated against production (no database access from this machine, and it would mean
acting as a suspended user). CI demonstrates the closed state on every push:
`supabase/ci/assert-0130.sql`.

## What closes it

- `_account_can_act(user)` raises 42501 "This account is suspended." One function; the
  enforcement ladder (warn, restrict, ban; plan phase 3b) extends it.
- A BEFORE INSERT trigger on each of the eight tables where a person acts (messages,
  conversations, RFQs, quotes, orders, milestones, claims, partner requests) reads the actor
  from the row and calls it. A trigger fires inside every function and for every role, so no
  function body changes and nothing can forget.
- Suspending ends the person's sessions (an AFTER UPDATE trigger on profiles deletes their
  `auth.sessions` rows, and Supabase drops the refresh tokens with them). The access token
  already in their hands can still read for up to an hour, its lifetime; it cannot write.

## Status: dry run NOT RUN against production

```
python ops/dry_run_0130_suspension.py --print
```

Paste into the Supabase SQL editor or run through the MCP `execute_sql`. It applies the
migration in one block, reports `suspended_accounts_today` and
`live_sessions_of_suspended_today` (the sessions that could still call the database), proves the
check refuses exactly the suspended accounts, and rolls back. Expected:
`helper_callable_by_anon false`, `helper_callable_by_authenticated false`, `rows_unchanged true`,
`accounts_refused_by_check` = `suspended_accounts_today`.

## To apply (founder's go-ahead only, AGENTS rule 15)

Say "apply 0130". The agent re-runs the dry run and applies the file through the Supabase MCP
`apply_migration` as 0107 was. Deploy order does not matter; the routes already answer 403 to
sqlstate 42501.

The trigger ends sessions on the NEXT suspension. For accounts suspended before it, the founder
runs this once (it ends only suspended accounts' sessions):

```
delete from auth.sessions s using public.profiles p where p.id = s.user_id and coalesce(p.is_suspended, false);
```

Rollback: the drop statements in the migration's REVERSE section.
