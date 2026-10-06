# 0132 — the address on every entry, and Auth's sign-in log copied into the record

Moderation and evidence plan, item 1b. Two halves:

1. **Code.** The server adds `x-sourcebd-ip` and `x-sourcebd-ua` to every Supabase call
   (`lib/ledger/request-headers.ts`, used by `lib/supabase/server.ts` and
   `lib/supabase/middleware.ts`). The record (0131) reads them, so from the deploy every entry
   says where the action came from: the visitor's address (Cloudflare's header first, then
   `x-real-ip`, then the leftmost `x-forwarded-for`) and browser, beside the address the gateway
   itself saw. Until the deploy those two columns are null; nothing else changes.
2. **Migration `0132_ledger_auth_log_copy.sql`.** `ledger_copy_auth_log(limit)` copies Auth's
   own log (`auth.audit_log_entries`: sign-ins, sign-outs, sign-ups, password changes, two-step
   changes) into the record after a kept cursor, one entry per row, with the actor, Auth's
   address as the gateway address, the time Auth wrote it, and the whole payload. Token
   refreshes are skipped. Service role only; the hourly job (1e) calls it.

## Status: dry run NOT RUN against production (6 Oct 2026)

The migration adds one table and two functions and writes nothing until the job runs. The
check to make before applying, read-only:

```
select count(*), min(created_at), max(created_at) from auth.audit_log_entries;
select payload->>'action' as action, count(*) from auth.audit_log_entries group by 1 order by 2 desc;
```

That says how many rows the first run will copy (at most 1,000 a call; the job repeats hourly
until caught up) and which actions appear. Record both here with the date.

CI executes the behaviour on every push: `supabase/ci/assert-0132.sql`.

## To apply (founder's go-ahead only, AGENTS rule 15)

Say "apply 0132" (after 0131). Then the first copy is the job's first run (1e), or by hand
through the MCP as the service role: `select public.ledger_copy_auth_log(1000);` repeated until
`copied` is 0.

Rollback: `drop function public.ledger_copy_auth_log(int); drop function public._ledger_auth_kind(text);
drop table public.activity_ledger_jobs;` The entries already copied stay (the record is append-only).
