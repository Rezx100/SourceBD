# HS catalogue exporter-count reconciliation (21 Sep 2026)

Mutation: **none**. Read-only reconciliation of
`design/assets/products/hs/manifest.json`'s `exporters` field against
SourceBD's own EPB-export population. Project: `stnrfxrxfonwexzcvvpv`.
Script: `ops/hs_catalogue_exporter_reconciliation.py` (same query as below).

## Why this exists

Truthfulness audit, cycle 19, BLOCKING 1. The product sheet's "Other
exporters of `<code>`" figure (`lib/dashboard/build-models.ts`'s
`otherExporters`) is `hsExporterCount(code) - 1`, sourced from
`lib/hs-catalogue.ts`'s `exporters`, generated from this manifest. The
manifest's numbers were the EPB government page's own exporter count per
heading — a **wider** population than SourceBD itself shows: SourceBD
excludes any `(host_slug, source_ref)` pair on
`epb_record_is_foreign_to_host`'s denylist (a second EPB record on that
host that actually belongs to a different company —
`supabase/migrations/0103_epb_detail_url_and_hscodes.sql`).

Live evidence at the time: HS 6105 showed "Other exporters of 6105  1,634"
(catalogue 1635, minus 1 for the record itself). SourceBD's own count for
6105 is 1634 total, so the true "other" figure is 1633 — off by 1, caused
by `bsa-apparels`'s EPB record (`source_ref` `4491`) being on the denylist
(SourceBD shows no 6105 line on that record; the old catalogue counted it
anyway).

## The authoritative population

`supplier_epb_hscodes(p_slug)` (the app's own live reader for one
supplier's HS lines) aggregated across every supplier and grouped by
4-digit heading instead of by supplier:

```sql
with epb_lines as (
  select s.id as supplier_id,
         left(btrim(hs.elem->>'code'), 4) as heading4
    from public.suppliers s
    join public.source_records sr
      on sr.supplier_id = s.id
     and sr.status = 'active'
    join public.sources src
      on src.id = sr.source_id
     and src.code = 'EPB'
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(sr.fields->'epb_hscodes') = 'array'
        then sr.fields->'epb_hscodes'
        else '[]'::jsonb
      end
    ) as hs(elem)
   where s.is_published = true
     and sr.source_ref ~ '^[0-9]+$'
     and not public.epb_record_is_foreign_to_host(s.slug, sr.source_ref)
     and btrim(coalesce(hs.elem->>'code', '')) ~ '^[0-9]{4,6}$'
)
select heading4, count(distinct supplier_id) as exporters
  from epb_lines
 where heading4 in (<the 46 catalogued headings>)
 group by heading4
 order by heading4;
```

Run live 21 Sep 2026 (read-only, via Supabase MCP `execute_sql`). 29 of
the 46 headings differed from the manifest, all lower (the manifest's
no-exclusion count was never lower than the true one), by 1 or 2:

| Heading | Manifest (old) | Live (correct) | Delta |
| --- | ---: | ---: | ---: |
| 6103 | 1713 | 1711 | −2 |
| 6104 | 1799 | 1797 | −2 |
| 6105 | 1635 | 1634 | −1 |
| 6106 | 1567 | 1565 | −2 |
| 6107 | 1541 | 1540 | −1 |
| 6108 | 1539 | 1538 | −1 |
| 6109 | 1764 | 1763 | −1 |
| 6110 | 1778 | 1777 | −1 |
| 6111 | 1638 | 1637 | −1 |
| 6112 | 1303 | 1302 | −1 |
| 6113 | 1002 | 1000 | −2 |
| 6114 | 1259 | 1258 | −1 |
| 6115 | 954 | 953 | −1 |
| 6116 | 834 | 833 | −1 |
| 6117 | 1005 | 1004 | −1 |
| 6202 | 1198 | 1196 | −2 |
| 6204 | 1423 | 1422 | −1 |
| 6206 | 1275 | 1273 | −2 |
| 6208 | 1113 | 1112 | −1 |
| 6209 | 1186 | 1185 | −1 |
| 6210 | 911 | 910 | −1 |
| 6212 | 810 | 809 | −1 |
| 6213 | 631 | 630 | −1 |
| 6214 | 707 | 706 | −1 |
| 6215 | 659 | 658 | −1 |
| 6216 | 599 | 598 | −1 |
| 6217 | 629 | 628 | −1 |
| 6301 | 56 | 55 | −1 |
| 6505 | 462 | 461 | −1 |

The other 17 headings (4202, 6001, 6006, 6101, 6102, 6201, 6203, 6205,
6207, 6211, 6302, 6303, 6304, 6305, 6307, 6504, 6506) matched exactly —
those exporters have no EPB record on the denylist.

## What was fixed

- `design/assets/products/hs/manifest.json`: the 29 `exporters` values
  above, and `queried_at` → `2026-09-21`.
- `node scripts/build-hs-photos.mjs` (with
  `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium`) regenerated
  `lib/hs-catalogue.ts` from the corrected manifest. Source images
  unchanged, so the 92 committed webp files were byte-identical (`git
  status` showed no change to them) — only the generated TypeScript file
  and its `queried` comment moved.
- Two tests pinned to the old derived value: `lib/dashboard/build-models
  .test.ts`'s `ps.otherExporters === 1634` → `1633`, and
  `components/dashboard/render.test.ts`'s `/1,634/` → `/1,633/`.
- Mutation guard `c19-hs-catalogue-6105-exporter-count-regresses` added to
  `scripts/mutation/mutate.py`, flipping HS 6105's catalogue row back to
  1635 — verified RED against the corrected tests before this fix (see the
  commit).

## The permanent gap this does not close

Nothing in CI reconciles any `exporters` figure against production — CI
has no database credentials, so this can only be re-run by hand
(`ops/hs_catalogue_exporter_reconciliation.py`, needs `SUPABASE_DB_URL`).
The manifest is a snapshot; it goes stale the moment a supplier's EPB
record changes after `queried_at`. `lib/dashboard/hs-photos.test.ts`
already guards the one thing CI *can* check — that `lib/hs-catalogue.ts`
is byte-consistent with `manifest.json` and every `hasPhoto` row has its
files — which is a structural guard, not a truthfulness one. Re-running
this reconciliation script whenever the catalogue is refreshed (AGENTS.md
rule 14: re-run the existing script, update this report in place, note
the date) is the intended maintenance path, not a new CI gate.
