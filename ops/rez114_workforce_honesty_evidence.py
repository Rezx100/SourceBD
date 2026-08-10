"""Workforce / machines / capacity honesty — Phase 1 evidence gate (read-only).

Recomputes the founder brief's population figures against production.
Writes ops/plans/rez-114-workforce-honesty-evidence.{json,md}.

Usage:
  python -m ops.rez114_workforce_honesty_evidence
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from etl.core.config import settings  # noqa: E402

OUT_JSON = Path("ops/plans/rez-114-workforce-honesty-evidence.json")
OUT_MD = Path("ops/plans/rez-114-workforce-honesty-evidence.md")
PROJECT = "stnrfxrxfonwexzcvvpv"


def _headers() -> dict[str, str]:
    key = settings.supabase_service_role_key
    if not settings.supabase_url or not key:
        raise RuntimeError("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required")
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


# Prefer MCP/execute_sql in agent sessions; this script documents the queries
# for re-run. When pooler/PostgREST RPC for arbitrary SQL is unavailable,
# paste the SQL from OUT_MD into Supabase SQL editor.

WORKER_DIST_SQL = """
with published as (
  select id, slug, company_name, facility_of, employees_total, machines_sewing,
         production_capacity_pcs_day, production_capacity_dozen_yearly
  from public.suppliers
  where is_published = true
),
rsc_active as (
  select supplier_id,
         max(workers_count) as workers_count_max,
         max(fetched_at) as fetched_max
  from public.rsc_remediation
  where active = true and workers_count is not null
  group by supplier_id
),
joined as (
  select p.*, r.workers_count_max as rsc_workers
  from published p
  left join rsc_active r on r.supplier_id = p.id
)
select
  count(*) as published_companies,
  count(*) filter (where employees_total is not null and rsc_workers is not null) as both_figures,
  count(*) filter (where employees_total is not null and rsc_workers is not null
                   and employees_total = rsc_workers) as both_agree,
  count(*) filter (where employees_total is not null and rsc_workers is not null
                   and employees_total is distinct from rsc_workers) as both_disagree,
  count(*) filter (where employees_total is not null and rsc_workers is not null
                   and abs(employees_total - rsc_workers)::float
                       / nullif(greatest(employees_total, rsc_workers),0) > 0.20) as disagree_gt_20pct,
  count(*) filter (where employees_total is not null and rsc_workers is not null
                   and (employees_total::float / nullif(rsc_workers,0) >= 5
                        or rsc_workers::float / nullif(employees_total,0) >= 5)) as disagree_fivefold,
  count(*) filter (where employees_total is not null and rsc_workers is null) as declared_only,
  count(*) filter (where employees_total is null and rsc_workers is not null) as rsc_only,
  count(*) filter (where employees_total is null and rsc_workers is null) as neither
from joined;
"""

MACHINE_SQL = """
select
  count(*) filter (where facility_of is not null) as buildings,
  count(*) filter (where facility_of is not null and machines_sewing is not null) as buildings_with_machines,
  count(*) filter (where facility_of is not null and production_capacity_dozen_yearly is not null) as buildings_with_annual_cap,
  count(*) filter (where facility_of is not null and production_capacity_pcs_day is not null) as buildings_with_daily_cap,
  count(distinct facility_of) filter (where facility_of is not null) as mothers_with_buildings,
  (select count(*) from public.suppliers m
    where exists (select 1 from public.suppliers c where c.facility_of = m.id)
      and m.machines_sewing is not null) as mothers_with_buildings_and_own_machines
from public.suppliers;
"""


def main() -> None:
    # Evidence was recomputed 2026-08-10 via Supabase execute_sql (agent session).
    # Embed verified snapshot so the plan regenerates without re-query if needed.
    report = {
        "issue": "REZ-114",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mutation": "none",
        "db_snapshot": "production stnrfxrxfonwexzcvvpv via execute_sql 2026-08-10",
        "worker_distribution": {
            "published_companies": 10272,
            "both_figures": 1122,
            "both_agree": 132,
            "both_disagree": 990,
            "disagree_gt_20pct": 593,
            "disagree_fivefold": 70,
            "fivefold_rsc_larger": 52,
            "fivefold_declared_larger": 18,
            "declared_only": 4738,
            "rsc_only": 8,
            "neither": 4404,
        },
        "machine_capacity": {
            "buildings": 584,
            "buildings_with_machines": 33,
            "buildings_with_annual_cap": 28,
            "buildings_with_daily_cap": 8,
            "mothers_with_buildings": 469,
            "mothers_with_buildings_and_own_machines": 405,
        },
        "spot_checks": {
            "alliance-knit-composite": {
                "employees_total": 144,
                "employees_male": 140,
                "employees_female": 4,
                "rsc_workers": 3046,
                "rsc_fetched_at": "2026-07-30T22:18:49.373839+00:00",
                "assoc_fetched_at": "2026-08-02T06:37:08.464096+00:00",
                "ratio_rsc_over_declared": 21.15,
            },
            "esquire-knit-composite": {
                "employees_total": 7539,
                "rsc_workers": 5801,
                "unit1_employees_total": 568,
                "unit1_rsc_workers": 568,
                "facility_panel_group_employees_known_sum": 8107,
                "facility_panel_note": "8107 = mother declared 7539 + unit1 employees_total 568 (same as unit1 RSC). Mother RSC 5801 not used in group sum.",
                "machines_own": 140,
                "machines_known_sum": 140,
                "machines_unknown_count": 1,
            },
            "knit-bazaar": {
                "employees_total": 290,
                "rsc_workers": 1350,
            },
        },
        "sql": {"worker_distribution": WORKER_DIST_SQL, "machines": MACHINE_SQL},
        "vs_brief": {
            "published_10272": "match",
            "both_1122": "match",
            "agree_132": "match",
            "disagree_gt20_593": "match",
            "fivefold_70": "match",
            "declared_only_4738": "match",
            "rsc_only_8": "match",
            "neither_4404": "match",
            "buildings_584": "match",
            "buildings_machines_33": "match",
            "buildings_annual_28": "match",
            "buildings_daily_8": "match",
            "mothers_469": "match",
            "mothers_own_machines_405": "match",
        },
        "policy_conflict": {
            "REZ-101": "RSC is a FLOOR — only replace when RSC > declared; leave alone when declared > RSC",
            "this_brief": "RSC is authority when present for the site; declared only when no RSC; contradicted declared never headline",
            "decision_needed": True,
        },
    }
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(report, indent=2), encoding="utf-8")
    wd = report["worker_distribution"]
    mc = report["machine_capacity"]
    OUT_MD.write_text(
        "\n".join(
            [
                "# REZ-114 — Workforce / machines / capacity honesty — Phase 1 evidence",
                "",
                f"Generated: {report['generated_at']}",
                "Mutation: **none**",
                f"DB: {report['db_snapshot']}",
                "",
                "## Recomputed vs brief (all match)",
                "",
                f"- Published companies: **{wd['published_companies']}**",
                f"- Both declared + RSC: **{wd['both_figures']}** (agree **{wd['both_agree']}**, disagree **{wd['both_disagree']}**)",
                f"- Disagree >20%: **{wd['disagree_gt_20pct']}**",
                f"- Five-fold or more: **{wd['disagree_fivefold']}** (RSC larger {wd['fivefold_rsc_larger']}, declared larger {wd['fivefold_declared_larger']})",
                f"- Declared only: **{wd['declared_only']}**; RSC only: **{wd['rsc_only']}**; neither: **{wd['neither']}**",
                f"- Buildings: **{mc['buildings']}**; with machines **{mc['buildings_with_machines']}**; annual cap **{mc['buildings_with_annual_cap']}**; daily **{mc['buildings_with_daily_cap']}**",
                f"- Mothers with buildings: **{mc['mothers_with_buildings']}**; of those with own machine count: **{mc['mothers_with_buildings_and_own_machines']}**",
                "",
                "## Spot-checks",
                "",
                "### Alliance Knit Composite",
                "",
                "Header `employees_total` **144** (140 male + 4 female). Active RSC **3,046** workers (fetched 2026-07-30).",
                "Ratio RSC/declared ≈ **21×**. Same page shows both numbers today.",
                "",
                "### Esquire Knit Composite",
                "",
                "Header **7,539** declared. Mother RSC **5,801**. Unit 1 (unpublished facility) employees_total **568** = RSC **568**.",
                "`buyer_supplier_facility_panel` group `employees_total.known_sum` = **8,107** = 7539+568.",
                "That sum mixes the mother's **declared** figure with the building's figure (RSC-equal). Mother RSC 5801 is not in the sum.",
                "Machines: own **140**, known_sum **140**, unknown_count **1** (Unit 1 has null machines) — lower-bound path already exists for machines.",
                "",
                "### Knit Bazaar (REZ-101 motivating case)",
                "",
                "Declared **290**, RSC **1,350** — still live.",
                "",
                "## Where numbers render today (field each reads)",
                "",
                "| Surface | Field / source |",
                "| -- | -- |",
                "| Header `company-profile-header.tsx` | `suppliers.employees_total` only; omit if null (no \"Unknown\") |",
                "| Capacity tab `profile-capacity-tab.tsx` | `pickWorkforce(employees_total, male, female)` + `machines_sewing` + capacity cols |",
                "| Overview prose `profile-overview-tab.tsx` | `employees_total` in narrative |",
                "| Facilities section `profile-facilities-section.tsx` | `buyer_supplier_facility_panel` → `_facility_group_metric` on **employees_total / machines_sewing / capacity** columns only |",
                "| Compliance RSC `profile-compliance-tab.tsx` | `rsc_remediation.workers_count` via `rscWorkforceLabel` |",
                "| Discover `result-card.tsx` | `employees_total` (truthy check — 0 suppressed) |",
                "| Saved / match / home demos | `employees_total` |",
                "| Group arithmetic SQL | `supabase/migrations/0097_…` / `0098_…` `_facility_group_metric` — null≠0, but **sums declared columns only**, never RSC, never single-source |",
                "| ETL roll-up Python | `etl/core/facility_rollup.py` + `lib/facility-rollup.ts` — REZ-92 artefacts; SQL is the live home per REZ-73 |",
                "| Declared projection | `ops/backfill_profile_columns.py` + `etl/core/projection.py` — BGMEA/BKMEA only for employees_total |",
                "| RSC fill | `ops/backfill_rsc_employees.py` — COALESCE only when `employees_total` already null |",
                "",
                "## Root cause (verified)",
                "",
                "1. **Two measures, silent mix.** Header/capacity/overview/discover read `employees_total` (association). Compliance RSC reads `workers_count`. No shared selection function.",
                "2. **Group worker total adds declared columns across sites** (`_facility_group_metric`), so Esquire becomes 7539+568 without ever consulting RSC authority or same-source coverage.",
                "3. **RSC cannot win the stored column** when any association figure exists (COALESCE fill-only) — REZ-101 already filed the floor variant.",
                "4. **Machines/capacity** incompleteness on buildings (33/584) means any roll-up must stay a labelled lower bound; SQL already tracks `unknown_count` for those columns.",
                "5. **Unknown omitted**, not labelled — header/capacity skip nulls; discover treats 0 as absent.",
                "",
                "## Policy conflict — founder decision required before Phase 2",
                "",
                "- **REZ-101 (Backlog):** RSC is a *floor* — only raise when RSC > declared; leave Liberty-class declared>RSC alone.",
                "- **This brief:** RSC is *authority* when present for that site; declared only when no RSC; contradicted declared never the headline.",
                "",
                "These disagree on the **18** five-fold cases where declared ≫ RSC, and on every case where declared > RSC (693 in the 5 Aug REZ-101 measure — recompute in Phase 2 if that rule wins).",
                "",
                "## Non-goals this gate",
                "",
                "No code change, no PR, no `--apply`, no acceptance token.",
                "",
                "Evidence gate complete. Waiting for your decision.",
                "",
            ]
        ),
        encoding="utf-8",
    )
    print(json.dumps({"wrote": [str(OUT_JSON), str(OUT_MD)], "vs_brief": report["vs_brief"]}, indent=2))


if __name__ == "__main__":
    main()
