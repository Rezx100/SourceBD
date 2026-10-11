# 0141 dry run (11 Oct 2026, production, rolled back)

Migration `supabase/migrations/0141_volza_shipment_reveal.sql` as merged (sha256
`688882378e5f7f3adaaf74cd672ae070d288d9ba8174df3199cc4d9afde2e137`), full-line comments stripped, executed inside
`do $dry$ … execute $m$ <migration> $m$; <checks>; raise exception …`, so everything rolled back by construction.
Checks ran as the first admin on the first exact-match supplier; no Volza call was made (the fetch step was
played by passing 25 made-up records to `volza_reveal_finish`). Second run, after the interface added
`supplier_shipment_reveal_state`; the first run (same day, before that function) also passed.

Result (the raise message):

```
DRY RUN OK | begin=fetch name=4 Stitch Knit Composite Ltd. | finish=t | read n=25 first=2026-08-25
unit_price_hidden=t | state=shown n=25 | ledger=1
rl api_reveal=t claim_verify=f api_export=t | anon begin=f auth finish=f auth table=f
settings={"live": true, "daily_max": 20, "spent_usd": 1.35, "monthly_cap_usd": 100.00, "credit_floor_usd": 100.00,
          "growth_per_month": 30, "enterprise_per_month": 100, "credit_remaining_usd": 2900.00}
```

Afterwards: `volza_shipment_reveals` and `supplier_shipment_reveal_state` absent, rl_check unpatched, no
`shipments.revealed` entries. `claim_verify=f` is production as it stands (0129 not applied); 0141 leaves the
email buckets alone.

The full behaviour (Starter and suspended shown the plans line, 15 vs 25, busy, allowance, off switch, cap,
credit floor, no settings row, abort, empty answer, expiry) is asserted on every CI run by
`supabase/ci/assert-0141.sql`.

Apply: the founder says "apply 0141"; then `apply_migration` with the file as merged, and a read to confirm.
