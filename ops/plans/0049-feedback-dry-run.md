# 0049 — feedback table and functions: dry run (6 Oct 2026)

Found while bringing the Send feedback entry back: production has no `feedback_reports` table and no
`feedback_*` function. `0049_feedback_reports.sql` (Phase 7 P3) never reached it, so `POST /api/v1/feedback` and
`/admin/feedback` would fail there until it is applied. `0049` is additive (`create table if not exists`,
`create or replace function`) and touches no existing row.

Dry run through the Supabase MCP (`execute_sql`, project `stnrfxrxfonwexzcvvpv`): one `do` block that ran the table
and `feedback_submit` statements of the file, submitted a note as a signed-in user, and raised, so everything rolled
back. Nothing committed.

```
existed_before            false
row_written_open          1       (a signed-in call stores one row, status open)
short_note                refused by the table (the 10-character check holds under the route's own)
rls_on                    true    (no policy: the API keys read and write nothing directly; the functions are the way in)
```

The two admin functions (`feedback_admin_list`, `feedback_admin_set_status`) read `profiles.role` and
`auth.users`, which exist; they are exercised by the admin page's tests against a fake, and by CI's replay of the
file. The new CI guard in `supabase/ci/assert-0118.sql` (after PR 319) requires every `public` table to have RLS on:
this one does.

## To apply (founder's go-ahead only, AGENTS rule 15)

Say "apply 0049". The agent re-runs this dry run (still `existed_before` false) and applies the file through the
Supabase MCP `apply_migration`. Do it before Deploy Production, or the Send feedback dialog answers "Could not send
your feedback" (the route hides the database's words). Rollback: `drop function public.feedback_submit(text, text),
public.feedback_admin_list(text, int, int), public.feedback_admin_set_status(uuid, text); drop table
public.feedback_reports;` (only if no note matters).
