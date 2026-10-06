# 0117 — The public site's facts: dry run

Run 5 Oct 2026 through the Supabase MCP (`execute_sql`) on project `stnrfxrxfonwexzcvvpv`: one `do` block that
creates `marketing_facts()` (the migration's own text), calls it as `anon`, and raises, so everything rolled back.
Nothing committed.

```
existed_before        false
anon_can_run          true
answer                2,654 bytes
suppliers_published   10268
sources_listed        25
sources_with_records  14      (EPB, RSC, BGAPMEA, BGMEA, BKMEA, BTMA, GOTS, OEKO-TEX, SA8000, WRAP, ASOS, H&M, M&S, NEXT)
certificates_on_file  4275    (rejected ones left out)
certificates_expired  518
rsc_records           2331
latest_read           2026-10-02
sources[]             25 rows: code, tier, records, suppliers, latest (BEPZA has none; RSC 2331 records, 2256 suppliers)
```

Read-only and additive: one function, no table, column or row changes. It returns counts and dates and nothing
that names a supplier, a certificate or an address (CI asserts that: `supabase/ci/assert-0117.sql`, which also
checks every count against its table, that a rejected certificate is not counted and an expired one is, and that
`anon` can call it).

Why it exists: Paper's footer, home and methodology pages print "25 sources listed · 14 hold supplier records",
"certificates on file, N have already expired" and a table of every source. `marketing_stats()` carries none of
them, and a figure typed into a page goes stale. The site reads this function (cached ten minutes); before it is
applied the pages leave those figures out, never a stale number.

Not here: a district count. The district column mixes spellings (Chattogram, Chittagong, CHATTOGRAM) and
sub-districts (Savar, Ashulia), so any number would be a guess; the live site's "48 districts" was one, and Paper's
"47" is not reproducible either.

## To apply (founder's go-ahead only, AGENTS rule 15)

Say "apply 0117". The agent re-runs this dry run (still `existed_before` false) and applies the file through the
Supabase MCP `apply_migration`. Rollback: `drop function public.marketing_facts();`.
