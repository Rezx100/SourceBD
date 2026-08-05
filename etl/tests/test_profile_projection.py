"""REZ-68 / A8 — highest-trust-then-most-recent profile numeric projection.

CI has no database. Tests cover:

1. The pure Python winner mirror (tier → fetched_at → record_id).
2. Static contracts on ops/backfill_profile_columns.py SQL:
   no greatest(), no `val > coalesce` guards, distinct on + nullif,
   arrays/established_date untouched, A6 locks present.
3. The KNIT GUARD shape: stored value with only a smaller active source
   must be overwriteable (is distinct from, not greater-than).
"""
from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path

from ops.backfill_profile_columns import (
    BGMEA_NON_WORKER_EMPLOYEE_KEYS,
    BGMEA_WORKER_COHORT_KEYS,
    NUMERIC_COLUMNS,
    SQL_STATEMENTS,
    NumericCandidate,
    TIER_RANK,
    _bgmea_production_workers,
    _digits_int,
    pick_numeric_winner,
)

REPO = Path(__file__).resolve().parents[2]
BACKFILL = REPO / "ops" / "backfill_profile_columns.py"


def _sql() -> str:
    return BACKFILL.read_text(encoding="utf-8")


def _cand(
    value: int,
    *,
    tier: str,
    fetched: str,
    record_id: str = "a",
    source_code: str = "BKMEA",
    supplier_id: str = "sup-1",
) -> NumericCandidate:
    return NumericCandidate(
        supplier_id=supplier_id,
        value=value,
        source_tier=tier,
        fetched_at=datetime.fromisoformat(fetched.replace("Z", "+00:00")),
        record_id=record_id,
        source_code=source_code,
    )


# ---------------------------------------------------------------------------
# Winner selection (Python mirror of the SQL distinct-on order)
# ---------------------------------------------------------------------------


def test_tier1_beats_tier2_even_when_smaller() -> None:
    """Issue test #1 — Tier 1 value 36 beats Tier 2 value 150."""
    winner = pick_numeric_winner(
        [
            _cand(150, tier="tier2_industry", fetched="2026-08-02T12:00:00+00:00", record_id="b"),
            _cand(36, tier="tier1_gov", fetched="2026-08-01T12:00:00+00:00", record_id="a"),
        ]
    )
    assert winner is not None
    assert winner.value == 36
    assert winner.source_tier == "tier1_gov"


def test_same_tier_newer_fetched_at_wins_even_when_smaller() -> None:
    """Issue test #2."""
    winner = pick_numeric_winner(
        [
            _cand(150, tier="tier2_industry", fetched="2026-08-02T03:18:00+00:00", record_id="old"),
            _cand(36, tier="tier2_industry", fetched="2026-08-02T04:46:00+00:00", record_id="new"),
        ]
    )
    assert winner is not None
    assert winner.value == 36
    assert winner.record_id == "new"


def test_same_tier_same_fetched_at_lower_record_id_wins() -> None:
    """Issue test #3 — deterministic tiebreak: lexicographically smaller record_id.

    SQL mirrors this with `ORDER BY ... sr.id` (ascending) after fetched_at desc.
    """
    ts = "2026-08-02T04:46:00+00:00"
    winner = pick_numeric_winner(
        [
            _cand(150, tier="tier2_industry", fetched=ts, record_id="bbbb"),
            _cand(36, tier="tier2_industry", fetched=ts, record_id="aaaa"),
        ]
    )
    assert winner is not None
    assert winner.value == 36
    assert winner.record_id == "aaaa"


def test_null_absent_candidate_does_not_beat_real_value() -> None:
    """Issue test #4 — callers omit NULL/missing; only real candidates compete."""
    winner = pick_numeric_winner(
        [
            _cand(120, tier="tier2_industry", fetched="2026-08-02T04:46:00+00:00"),
        ]
    )
    assert winner is not None
    assert winner.value == 120


def test_zero_is_not_a_valid_candidate() -> None:
    """Issue test #5 — zeros must not enter the candidate set.

    Production still has literal 0s in older BKMEA fields payloads; both the
    SQL `nullif(..., 0)` filter and Python `_digits_int` drop them before
    `pick_numeric_winner`. If a zero sorted as winner it would blank a real
    value via `is distinct from`.
    """
    assert _digits_int(0) is None
    assert _digits_int("0") is None
    assert _digits_int("36") == 36
    winner = pick_numeric_winner(
        [
            _cand(36, tier="tier2_industry", fetched="2026-08-02T03:00:00+00:00", record_id="a"),
        ]
    )
    assert winner is not None and winner.value == 36


def test_knit_guard_shape_smaller_active_source_overwrites_stored() -> None:
    """Pre-flight correction #2 — stored 150, active sources only report 36.

    Trust ranking is irrelevant (both BKMEA tier2). Removing greatest() and
    the `>` guard is what allows the overwrite.
    """
    winner = pick_numeric_winner(
        [
            _cand(36, tier="tier2_industry", fetched="2026-08-02T04:46:00+00:00", record_id="r1"),
            _cand(36, tier="tier2_industry", fetched="2026-08-02T03:18:00+00:00", record_id="r2"),
        ]
    )
    assert winner is not None
    assert winner.value == 36
    stored = 150
    assert stored != winner.value  # is distinct from → would write


# ---------------------------------------------------------------------------
# SQL contracts
# ---------------------------------------------------------------------------


def test_sql_has_no_greatest_and_no_greater_than_guard() -> None:
    numeric = "\n".join(sql for _, sql in SQL_STATEMENTS)
    assert "greatest(" not in numeric.lower()
    assert not re.search(r"x\.val\s*>\s*coalesce", numeric, flags=re.I)


def test_sql_uses_distinct_on_with_tier_rank_and_nullif() -> None:
    numeric = "\n".join(
        sql
        for label, sql in SQL_STATEMENTS
        if "set factory_types" not in sql
        and "set principal_products" not in sql
        and "set established_date" not in sql
    )
    assert numeric.lower().count("distinct on") == 6
    assert "when 'tier1_gov' then 1" in numeric
    assert "when 'tier2_industry' then 2" in numeric
    assert "fetched_at desc nulls last" in numeric.lower()
    # Load-bearing zero guard — must survive the max→distinct-on rewrite.
    assert numeric.count("nullif(") >= 6


def test_arrays_still_union_and_established_date_still_latest_fetched() -> None:
    """Issue test #6."""
    by_label = {label: sql for label, sql in SQL_STATEMENTS}
    est = by_label["BGMEA established_date"]
    assert "array_agg(sr.fields ->> 'established_date' order by sr.fetched_at desc)" in est
    assert "greatest(" not in est.lower()

    ft = [sql for label, sql in SQL_STATEMENTS if label.startswith("factory_types")][0]
    assert "union all" in ft.lower()
    assert "array_agg(distinct t" in ft

    pp = [sql for label, sql in SQL_STATEMENTS if label.startswith("principal_products")][0]
    assert "union all" in pp.lower()
    assert "array_agg(distinct p" in pp


def test_locked_column_predicate_present_on_every_numeric_update() -> None:
    """Issue test #7 — A6 lock predicates preserved on every UPDATE."""
    sql = _sql()
    preds = re.findall(
        r"and not exists \(\s*select 1 from public\.supplier_field_locks l\s+"
        r"where l\.supplier_id = s\.id\s+"
        r"and l\.column_name = '(\w+)'\s+"
        r"and l\.released_at is null\s*\)",
        sql,
        flags=re.IGNORECASE,
    )
    for col in NUMERIC_COLUMNS:
        assert col in preds, col
    assert "established_date" in preds
    assert "factory_types" in preds
    assert "principal_products" in preds


def test_numeric_updates_use_is_distinct_from() -> None:
    """Downward corrections require is distinct from, not greater-than."""
    for label, sql in SQL_STATEMENTS:
        if label.startswith(("factory_types", "principal_products", "BGMEA established")):
            continue
        assert "is distinct from x.val" in sql, label


def test_tier_rank_mapping_is_explicit() -> None:
    assert TIER_RANK["tier1_gov"] < TIER_RANK["tier2_industry"] < TIER_RANK["tier3_cert"]
    assert list(TIER_RANK) == [
        "tier1_gov",
        "tier2_industry",
        "tier3_cert",
        "tier4_brand",
        "tier5_regulatory",
        "tier6_crosscheck",
    ]


def test_source_exclusivity_preserved() -> None:
    """Do not widen which sources feed which column."""
    pcs = next(sql for label, sql in SQL_STATEMENTS if "pcs_day" in label)
    assert "BKMEA" in pcs
    assert "'BGMEA'" not in pcs

    dozen = next(sql for label, sql in SQL_STATEMENTS if "dozen_yearly" in label)
    assert "BGMEA" in dozen
    assert "'BKMEA'" not in dozen

    machines = next(sql for label, sql in SQL_STATEMENTS if label.startswith("machines_sewing"))
    assert "'BKMEA'" in machines and "'BGMEA'" in machines


# ---------------------------------------------------------------------------
# REZ-95 — BGMEA production workers = Employee Male + Employee Female
#
# These invert REZ-91, which summed all three keys. The first column is NOT a
# reliable management headcount, so adding it inflated 590 suppliers and exactly
# doubled 165. Against BKMEA's independent worker total (n=198) Male+Female is
# closer in every band.
# ---------------------------------------------------------------------------


def test_bgmea_production_workers_excludes_restated_total() -> None:
    """Issue test #1 — fakir-fashion: the first column restates Male+Female.

    18,547 == 9,274 + 9,273 exactly. Must be 18,547, NOT REZ-91's 37,094.
    """
    assert (
        _bgmea_production_workers(
            {
                "employees": {
                    "Management": "18547",
                    "Employee Male": "9274",
                    "Employee Female": "9273",
                }
            }
        )
        == 18547
    )


def test_bgmea_production_workers_excludes_doubling_case() -> None:
    """Issue test #2 — zaber-and-zubair-fabrics: 9,341 == 4,000 + 5,341.

    Must be 9,341, NOT REZ-91's 18,682.
    """
    assert (
        _bgmea_production_workers(
            {
                "employees": {
                    "Management": "9341",
                    "Employee Male": "4000",
                    "Employee Female": "5341",
                }
            }
        )
        == 9341
    )


def test_bgmea_production_workers_excludes_plausible_management_figure() -> None:
    """Issue test #3 — COAST TO COAST shape, where 850 looks like real management.

    Male+Female wins even in this band (94 of 116 against BKMEA), so 850 is
    still excluded: 2,450 + 1,000 = 3,450, not REZ-91's 4,300.
    """
    assert (
        _bgmea_production_workers(
            {
                "employees": {
                    "Management": "850",
                    "Employee Male": "2450",
                    "Employee Female": "1000",
                }
            }
        )
        == 3450
    )


def test_bgmea_production_workers_management_only_is_not_a_worker_total() -> None:
    """Issue test #4 — a management-only payload yields no worker count.

    Asserts current behaviour only. Whether such a record should lose to a
    cohort-bearing source is REZ-94's decision, not this issue's.
    """
    assert (
        _bgmea_production_workers(
            {"employees": {"Management": "550", "Employee Male": "", "Employee Female": ""}}
        )
        is None
    )
    assert _bgmea_production_workers({"employees": {"Management": "550"}}) is None


def test_bgmea_production_workers_skips_empty_string_cohorts() -> None:
    """Empty string is skipped, not treated as zero; one populated cohort stands."""
    assert (
        _bgmea_production_workers(
            {
                "employees": {
                    "Management": "650",
                    "Employee Male": "510",
                    "Employee Female": "",
                }
            }
        )
        == 510
    )
    assert _bgmea_production_workers({"employees": {"Employee Male": "1200"}}) == 1200


def test_bgmea_production_workers_skips_and_reports_unrecognised_keys() -> None:
    """Unrecognised keys are not summed; they are reported. Management is not."""
    unknown: list[str] = []
    assert (
        _bgmea_production_workers(
            {
                "employees": {
                    "Management": "100",
                    "Employee Male": "200",
                    "Employee Female": "300",
                    "Total": "9999",
                    "Workers": "50",
                }
            },
            unknown_keys=unknown,
        )
        == 500
    )
    # Management is recognised-but-excluded, so it must NOT be reported as unknown.
    assert sorted(unknown) == ["Total", "Workers"]


def test_bgmea_management_figure_is_preserved_not_deleted() -> None:
    """Step 4 — the first column stays in the payload; we only stop summing it."""
    fields = {
        "employees": {
            "Management": "850",
            "Employee Male": "2450",
            "Employee Female": "1000",
        }
    }
    _bgmea_production_workers(fields)
    assert fields["employees"]["Management"] == "850"


def test_two_source_records_still_compete_not_summed() -> None:
    """Cross-record A8 rule is unchanged: totals compete, never add."""
    winner = pick_numeric_winner(
        [
            _cand(
                3450,
                tier="tier2_industry",
                fetched="2026-08-02T04:00:00+00:00",
                record_id="bgmea-new",
                source_code="BGMEA",
            ),
            _cand(
                800,
                tier="tier2_industry",
                fetched="2026-08-01T04:00:00+00:00",
                record_id="bgmea-old",
                source_code="BGMEA",
            ),
        ]
    )
    assert winner is not None
    assert winner.value == 3450
    assert winner.value != 3450 + 800


def test_sql_employees_total_sums_worker_cohorts_only() -> None:
    """SQL contract: sum Male+Female only; Management must not be in the WHERE."""
    emp_sql = next(sql for label, sql in SQL_STATEMENTS if label.startswith("employees_total"))
    assert "select sum(" in emp_sql.lower()
    assert "'Employee Male'" in emp_sql
    assert "'Employee Female'" in emp_sql
    assert "v.key in ('Employee Male', 'Employee Female')" in emp_sql
    # The REZ-91 regression: Management enumerated in the summed key list.
    assert "v.key in ('Management', 'Employee Male', 'Employee Female')" not in emp_sql
    # The original bug: max over every key in the employees object.
    assert not re.search(
        r"select\s+max\(nullif\(regexp_replace\(v\.value",
        emp_sql,
        flags=re.I,
    )


def test_sql_does_not_touch_male_female_machines_or_capacity() -> None:
    """Non-goals: male/female key reads, machines, capacity stay as-is."""
    male = next(sql for label, sql in SQL_STATEMENTS if label.startswith("employees_male"))
    female = next(sql for label, sql in SQL_STATEMENTS if label.startswith("employees_female"))
    assert "Employee Male" in male
    assert "Employee Female" in female
    assert "select sum(" not in male.lower()
    assert "select sum(" not in female.lower()

    # The worker sum must appear only on employees_total, not sibling numerics.
    for label, sql in SQL_STATEMENTS:
        if label.startswith("employees_total"):
            continue
        assert "v.key in ('Employee Male', 'Employee Female')" not in sql, label


def test_worker_cohort_keys_constant_is_explicit() -> None:
    assert BGMEA_WORKER_COHORT_KEYS == frozenset({"Employee Male", "Employee Female"})
    # Management is known and deliberately excluded — not merely unrecognised.
    assert BGMEA_NON_WORKER_EMPLOYEE_KEYS == frozenset({"Management"})
    assert not (BGMEA_WORKER_COHORT_KEYS & BGMEA_NON_WORKER_EMPLOYEE_KEYS)