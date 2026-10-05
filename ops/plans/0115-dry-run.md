# 0115 — Account sessions: dry run

Run 5 Oct 2026 through the Supabase MCP (`execute_sql`) on project `stnrfxrxfonwexzcvvpv`: one `do` block that
creates the two functions (the migration's own text), reads as the busiest user with the JWT claims set and the
role switched to `authenticated`, and then raises, so everything rolled back. Nothing committed. (The repo has
no Python here, so the `ops/dry_run_*.py --print` form was not used; the block above is the migration text.)

```
existed_before          false   (neither function was there)
anon_can_run            false   (both revoked by name)
authenticated_can_run   true
sessions_in_db          86
sessions_for_busiest    13      (account_sessions() answered for that user)
agents                  node    (every session so far was opened by a server action: Auth recorded the
                                 server's user agent, not the browser's; see the spec, decision 3)
end_unknown_id          false   (a made-up id changes nothing and answers false)
```

Additive only: two functions, no table, column or row changes. Behaviour (own live sessions only, the current one
flagged, an expired session and another person's hidden, no address returned, ending deletes only the caller's own
row and refuses the current one, a made-up id and null, anon cannot run either, nobody signed in lists nothing and
cannot end anything) is executed by CI on every push: `supabase/ci/assert-0115.sql`, against a stub of
`auth.sessions` in `00-supabase-bootstrap.sql`.

## To apply (founder's go-ahead only, AGENTS rule 15)

Say "apply 0115". The agent re-runs this dry run (still `existed_before` false) and applies the file through the
Supabase MCP `apply_migration`. Until then the Security page lists no devices and says it could not load them;
two-step sign-in and "Sign out everywhere else" need no migration.

Rollback: the `drop` lines in the migration's header.
