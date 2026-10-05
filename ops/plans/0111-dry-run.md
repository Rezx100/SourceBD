# 0111 — Team and roles (members, invites, last active): dry run

Run 5 Oct 2026 through the Supabase MCP (`execute_sql`), the SQL printed by
`python ops/dry_run_0111_workspace_team.py --print` (the direct connection
timed out from this machine, as for 0110). One `do` block that applies the
migration and then raises, so everything rolled back. Nothing committed.

Migration text md5 (LF, whole-line comments and blank lines removed, as run):
`bdfd66bc57a8990d2b63f9bf83cc003a`.

```
existed_before             tables false, last_active_at false, any function false
rls_on                     true    (both tables)
table_grants_anon_or_auth  0
functions_ok               true    (all 8: SECURITY DEFINER, search_path=public,
                                    authenticated yes, anon no)
guard_callable_by_auth     false   (_workspace_require_owner is internal)
profiles                   39
profiles_stamped           0       (no existing row changed)
buyers_read                5
teams_as_expected          true    (each: owner, a team of one, no invites)
```

Additive only: two new empty tables, one nullable column, nine new functions.
No buyer-visible row changes. The behaviour (invite, accept with the emailed
token, wrong account, supplier account, used / replaced / expired / cancelled
link, member cannot change the team, resend waits 10 minutes, role change,
leaving, no direct table access, anon calls nothing) is executed by CI on every
push: `supabase/ci/assert-0111.sql`.

## To apply (founder's go-ahead only, AGENTS rule 15)

Say "apply 0111". The agent re-runs this dry run (still `existed_before` all
false) and applies the file through the Supabase MCP `apply_migration`. Apply
before the Team page that calls these functions is deployed; nothing live
calls them yet, so applying early is harmless.

Rollback: the `drop` lines in the migration's header.
