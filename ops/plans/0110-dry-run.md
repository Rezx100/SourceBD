# 0110 — order_cancel refuses shipped and in-transit orders: dry run

Run 4 Oct 2026 through the Supabase MCP (`execute_sql`), the SQL printed by
`python ops/dry_run_0110_order_cancel.py --print`. One `do` block that applies
the migration and then raises, so everything rolled back. Nothing committed.

Migration text md5 (LF, as run): `a595d8f444c095e580fa4a9b2ee7198b`.
sha256 of the file: LF `428efeec…334c9f`, CRLF `efa1f926…6c19f9`.

```
live_was_0029              true    (live md5 fe955411… = 0029's text, checked first)
security_definer           true
search_path                ["search_path=public"]
anon_can_execute           false   (true before: Supabase's default grant)
authenticated_can_execute  true
orders                     0       (production has no orders yet)
all_as_expected            true
```

With no live orders, no buyer-visible row can change. The behaviour itself
(draft and in-production cancel; shipped, in-transit, delivered and cancelled
refused with the status kept; another buyer's order and a signed-out caller
refused) is executed by CI on every push: `supabase/ci/assert-0110.sql`.

## To apply (founder's go-ahead only, AGENTS rule 15)

Say "apply 0110". The agent re-runs this dry run, checks the live md5 is still
`fe955411…`, and applies the file through the Supabase MCP `apply_migration`
as 0107 was. Order with the deploy does not matter: the page already hides the
button, and the old function keeps working until the new one replaces it.

Rollback: re-run the `create or replace function public.order_cancel` block of
`0029_orders.sql`.
