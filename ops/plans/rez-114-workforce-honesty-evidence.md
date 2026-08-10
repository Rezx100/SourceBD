# REZ-114 — Workforce / machines / capacity honesty — Phase 1 evidence

Generated: 2026-08-10T05:59:22.293034+00:00
Mutation: **none**
DB: production stnrfxrxfonwexzcvvpv via execute_sql 2026-08-10

## Recomputed vs brief (all match)

- Published companies: **10272**
- Both declared + RSC: **1122** (agree **132**, disagree **990**)
- Disagree >20%: **593**
- Five-fold or more: **70** (RSC larger 52, declared larger 18)
- Declared only: **4738**; RSC only: **8**; neither: **4404**
- Buildings: **584**; with machines **33**; annual cap **28**; daily **8**
- Mothers with buildings: **469**; of those with own machine count: **405**

## Spot-checks

### Alliance Knit Composite

Header `employees_total` **144** (140 male + 4 female). Active RSC **3,046** workers (fetched 2026-07-30).
Ratio RSC/declared ≈ **21×**. Same page shows both numbers today.

### Esquire Knit Composite

Header **7,539** declared. Mother RSC **5,801**. Unit 1 (unpublished facility) employees_total **568** = RSC **568**.
`buyer_supplier_facility_panel` group `employees_total.known_sum` = **8,107** = 7539+568.
That sum mixes the mother's **declared** figure with the building's figure (RSC-equal). Mother RSC 5801 is not in the sum.
Machines: own **140**, known_sum **140**, unknown_count **1** (Unit 1 has null machines) — lower-bound path already exists for machines.

### Knit Bazaar (REZ-101 motivating case)

Declared **290**, RSC **1,350** — still live.

## Where numbers render today (field each reads)

| Surface | Field / source |
| -- | -- |
| Header `company-profile-header.tsx` | `suppliers.employees_total` only; omit if null (no "Unknown") |
| Capacity tab `profile-capacity-tab.tsx` | `pickWorkforce(employees_total, male, female)` + `machines_sewing` + capacity cols |
| Overview prose `profile-overview-tab.tsx` | `employees_total` in narrative |
| Facilities section `profile-facilities-section.tsx` | `buyer_supplier_facility_panel` → `_facility_group_metric` on **employees_total / machines_sewing / capacity** columns only |
| Compliance RSC `profile-compliance-tab.tsx` | `rsc_remediation.workers_count` via `rscWorkforceLabel` |
| Discover `result-card.tsx` | `employees_total` (truthy check — 0 suppressed) |
| Saved / match / home demos | `employees_total` |
| Group arithmetic SQL | `supabase/migrations/0097_…` / `0098_…` `_facility_group_metric` — null≠0, but **sums declared columns only**, never RSC, never single-source |
| ETL roll-up Python | `etl/core/facility_rollup.py` + `lib/facility-rollup.ts` — REZ-92 artefacts; SQL is the live home per REZ-73 |
| Declared projection | `ops/backfill_profile_columns.py` + `etl/core/projection.py` — BGMEA/BKMEA only for employees_total |
| RSC fill | `ops/backfill_rsc_employees.py` — COALESCE only when `employees_total` already null |

## Root cause (verified)

1. **Two measures, silent mix.** Header/capacity/overview/discover read `employees_total` (association). Compliance RSC reads `workers_count`. No shared selection function.
2. **Group worker total adds declared columns across sites** (`_facility_group_metric`), so Esquire becomes 7539+568 without ever consulting RSC authority or same-source coverage.
3. **RSC cannot win the stored column** when any association figure exists (COALESCE fill-only) — REZ-101 already filed the floor variant.
4. **Machines/capacity** incompleteness on buildings (33/584) means any roll-up must stay a labelled lower bound; SQL already tracks `unknown_count` for those columns.
5. **Unknown omitted**, not labelled — header/capacity skip nulls; discover treats 0 as absent.

## Policy conflict — founder decision required before Phase 2

- **REZ-101 (Backlog):** RSC is a *floor* — only raise when RSC > declared; leave Liberty-class declared>RSC alone.
- **This brief:** RSC is *authority* when present for that site; declared only when no RSC; contradicted declared never the headline.

These disagree on the **18** five-fold cases where declared ≫ RSC, and on every case where declared > RSC (693 in the 5 Aug REZ-101 measure — recompute in Phase 2 if that rule wins).

## Non-goals this gate

No code change, no PR, no `--apply`, no acceptance token.

Evidence gate complete. Waiting for your decision.
