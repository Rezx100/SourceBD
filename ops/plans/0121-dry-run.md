# 0121 review decisions for held records: dry run (6 Oct 2026)

Migration: `supabase/migrations/0121_etl_hold_review.sql`
sha256 (LF, as committed): `9f122dcdf1bf5bd8b6abd894c5815743a17a9a9285665fe6af786becaf1e80fb`
Spec: `context/feature-specs/spec-etl-freshness.md` §8.3, slice C2.

## How it was run

Production `stnrfxrxfonwexzcvvpv`, Supabase MCP `execute_sql`. The migration ran
inside one `DO` block that inserts a test held row (against `as-fashion`), asks
the plan about it and about the newest existing `fuzzy_match_review` row, then
ends in `raise exception`, so everything rolled back. A read afterwards found no
renamed function, no new index and no test row.

## Result

```
DRY RUN OK (rolled back) | held={"action": "held_same",
  "winner_id": "b53333ad-…", "buyer_destination": "Release if this is A. S. Fashion:
  the record joins that company. Reject if it is a different company: it is added
  as a new one."} | old_unchanged=t | old=keep_separate | index=1
```

- A held record now gets a plan: Release = same company, Reject = different.
- Every existing review row gets exactly the plan it got before (`old_unchanged=t`):
  the live function is renamed and called unchanged.

## What changes for buyers when it is applied

Nothing directly. It only lets an admin's Release on a held record go through.
Before it is applied, Release on a held record stops with "needs a human" (nothing
moves) and Reject already works, so the code is safe to deploy first.

## To apply (founder)

Say "apply 0121". It is applied through the Supabase MCP `apply_migration`, gated
on the sha256 above, then verified by asking the plan about one held row.

## Rollback

The REVERSE block in the migration header renames the 0102 function back.
