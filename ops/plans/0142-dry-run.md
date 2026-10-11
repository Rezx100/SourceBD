# 0142 — search by customs exports: dry run and apply (11 Oct 2026)

Migration `supabase/migrations/0142_discover_customs_exports.sql` (sha256 `154ee71c…`): `volza_reader_entitled()`
and `discover_customs_exports(...)`, the Exports filter, its sorts and the row figures for the search
(spec-volza-reveal section 4, item 4; Paper page 34, boards E, H, J1, G).

## Dry run (production, DO block ending in `raise exception`, rolled back)

    DRY RUN OK | no user: 0 rows | admin: 73 rows | top by avg: Rezaul Apparels (Pvt.) Ltd 113818/244;
    ZS KNIT WEAR 103948/23; NGS FASHION LTD 59149/12; Galpex Ltd. 57274/87 | ships to UK: 42 | US$10m+: 30

Signed out: no rows. An admin: all 73 exact customs records; average shipment ranks 10+ shipments only.

## Apply

The founder said "apply 0142" on 11 Oct 2026; applied via MCP `apply_migration`. Verified after:
`anon` cannot execute either function; `authenticated` can (the function answers only entitled readers).
