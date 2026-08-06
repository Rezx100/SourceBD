"""Pure numeric profile-projection rules — single home for both write paths.

Imported by ``ops/backfill_profile_columns.py`` (psycopg / SQL apply + REST
dry-run) and ``ops/repair_bgmea_conflations.py`` (REST-only). Those scripts
exist as separate I/O paths because the Postgres pooler is unreachable from
the machine that runs the repair; they must share this module rather than
import each other.

Nothing in this file may import ``psycopg``, ``httpx``, or any network /
database client. A unit test asserts that constraint so the next drift of
"copy the rules into the port" cannot return.

Winner rule (A8 / REZ-68): highest ``source_tier``, then most recent
``fetched_at``, then lower ``source_records.id``. Never the largest. Never
sum across records.

Within one BGMEA ``employees`` object (REZ-95): ``employees_total`` is
production workers = ``Employee Male`` + ``Employee Female``. ``Management``
is recognised and deliberately excluded.

Source-exclusivity (which payload feeds which column):
- employees_total / employees_male / employees_female: BGMEA + BKMEA
- production_capacity_pcs_day: BKMEA only (native pcs/day)
- production_capacity_dozen_yearly: BGMEA only (native dozen/year)
- machines_sewing: BKMEA (``bkmea_machines_sewing``) + BGMEA (``num_machines``)

Callers decide whether BGMEA ``num_machines`` also requires
``entity_type = 'factory'``. The canonical backfill gates on it; the repair
port does not. That divergence is intentional until filed separately —
do not paper over it here.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any

# Explicit integer ranking — do not rely on Postgres enum physical order.
TIER_RANK: dict[str, int] = {
    "tier1_gov": 1,
    "tier2_industry": 2,
    "tier3_cert": 3,
    "tier4_brand": 4,
    "tier5_regulatory": 5,
    "tier6_crosscheck": 6,
}

# BGMEA production-worker cohorts — the only keys summed into employees_total
# (REZ-95). Do not add future keys like "Total" here without an explicit
# precedence rule; unrecognised keys are skipped and reported.
BGMEA_WORKER_COHORT_KEYS: frozenset[str] = frozenset({"Employee Male", "Employee Female"})

# Recognised but deliberately excluded from the worker total (REZ-95). BGMEA's
# first column is sometimes a management headcount, sometimes a restatement of
# the total, sometimes neither — on 419 of 1,607 records it is provably not
# management (192 exactly equal Male+Female, 227 exceed the whole worker count).
# It is genuine sourced data: keep it in the payload, never sum it, and never
# render it. Listing it here keeps it out of the unknown-key report.
BGMEA_NON_WORKER_EMPLOYEE_KEYS: frozenset[str] = frozenset({"Management"})

# Sanity caps shared by both write paths. A value outside the range is dropped
# from the candidate set, not clamped.
NUMERIC_CAPS: dict[str, int] = {
    "employees_total": 200_000,
    "employees_male": 200_000,
    "employees_female": 200_000,
    "machines_sewing": 20_000,
    "production_capacity_pcs_day": 10_000_000,
    "production_capacity_dozen_yearly": 200_000_000,
}

NUMERIC_COLUMNS: tuple[str, ...] = (
    "employees_total",
    "employees_male",
    "employees_female",
    "production_capacity_pcs_day",
    "machines_sewing",
    "production_capacity_dozen_yearly",
)

# Which association registers may feed each derived column.
COLUMN_SOURCES: dict[str, frozenset[str]] = {
    "employees_total": frozenset({"BGMEA", "BKMEA"}),
    "employees_male": frozenset({"BGMEA", "BKMEA"}),
    "employees_female": frozenset({"BGMEA", "BKMEA"}),
    "production_capacity_pcs_day": frozenset({"BKMEA"}),
    "production_capacity_dozen_yearly": frozenset({"BGMEA"}),
    "machines_sewing": frozenset({"BGMEA", "BKMEA"}),
}

_DIGITS_RE = re.compile(r"[^0-9]")


@dataclass(frozen=True)
class NumericCandidate:
    """One non-zero numeric observation from an active source_record.

    ``supplier_id`` / ``source_code`` are optional ranking-irrelevant metadata
    the backfill dry-run reports; the repair path may leave them empty.
    """

    value: int
    source_tier: str
    fetched_at: datetime | None
    record_id: str
    supplier_id: str = ""
    source_code: str = ""


def pick_numeric_winner(candidates: list[NumericCandidate]) -> NumericCandidate | None:
    """Highest trust, then most recent fetched_at, then lower record_id.

    Tiebreak (same tier, same fetched_at): lexicographically smaller
    ``record_id`` wins — stated here so same-tier/same-fetched_at results
    are deterministic across SQL (ORDER BY sr.id) and this Python mirror.
    Zeros and NULLs must not appear in ``candidates`` (callers filter them).
    A record with no ``fetched_at`` sorts last within its tier.
    """
    if not candidates:
        return None
    return min(
        candidates,
        key=lambda c: (
            TIER_RANK.get(c.source_tier, 99),
            # None fetched_at sorts last (least preferred)
            (0, -(c.fetched_at.timestamp())) if c.fetched_at is not None else (1, 0.0),
            c.record_id,
        ),
    )


def digits_int(raw: Any) -> int | None:
    """Parse a positive integer from a payload value; 0 / blank → None.

    Mirrors SQL ``nullif(..., 0)`` so a zero-reporting record cannot blank a
    real figure. Bools are rejected (``True`` is not a headcount).
    """
    if raw is None:
        return None
    if isinstance(raw, bool):
        return None
    if isinstance(raw, int):
        return raw if raw != 0 else None
    text = _DIGITS_RE.sub("", str(raw))
    if not text:
        return None
    val = int(text)
    return val if val != 0 else None


def within_numeric_cap(column: str, value: int) -> bool:
    """True when ``value`` is a positive integer inside the column's sanity cap."""
    cap = NUMERIC_CAPS.get(column)
    if cap is None:
        return value > 0
    return 0 < value <= cap


def bgmea_production_workers(
    fields: dict[str, Any],
    *,
    unknown_keys: list[str] | None = None,
) -> int | None:
    """Sum BGMEA's production-worker cohorts (REZ-95).

    ``Employee Male + Employee Female`` only. ``Management`` is recognised and
    deliberately excluded. Empty-string / non-digit / zero cohorts are skipped.
    Keys that are neither summed nor knowingly excluded are appended to
    ``unknown_keys`` for reporting when that list is provided. A payload with
    no populated cohort yields no candidate rather than 0.
    """
    emp = fields.get("employees")
    if not isinstance(emp, dict):
        return None
    total = 0
    found = False
    for key, raw in emp.items():
        if key not in BGMEA_WORKER_COHORT_KEYS:
            if unknown_keys is not None and key not in BGMEA_NON_WORKER_EMPLOYEE_KEYS:
                unknown_keys.append(str(key))
            continue
        n = digits_int(raw)
        if n is None:
            continue
        total += n
        found = True
    return total if found else None


def value_for_column(
    fields: dict[str, Any],
    source: str,
    column: str,
    *,
    unknown_employee_keys: list[str] | None = None,
) -> int | None:
    """Non-zero value one source record contributes to ``column``, or None.

    Encodes the per-source payload-key mapping and source-exclusivity table.
    Does not apply sanity caps (callers use ``within_numeric_cap``) and does
    not gate BGMEA ``machines_sewing`` on ``entity_type`` — that gate stays
    at the backfill call site so the repair port's divergent behaviour remains
    visible.
    """
    allowed = COLUMN_SOURCES.get(column)
    if allowed is not None and source not in allowed:
        return None

    if source == "BGMEA":
        if column == "employees_total":
            return bgmea_production_workers(
                fields, unknown_keys=unknown_employee_keys
            )
        if column == "employees_male":
            emp = fields.get("employees") if isinstance(fields.get("employees"), dict) else {}
            return digits_int(emp.get("Employee Male"))
        if column == "employees_female":
            emp = fields.get("employees") if isinstance(fields.get("employees"), dict) else {}
            return digits_int(emp.get("Employee Female"))
        if column == "machines_sewing":
            return digits_int(fields.get("num_machines"))
        if column == "production_capacity_dozen_yearly":
            return digits_int(fields.get("production_capacity_dozen_yearly"))
        return None

    if source == "BKMEA":
        if column == "employees_total":
            return digits_int(fields.get("bkmea_employees_total"))
        if column == "employees_male":
            return digits_int(fields.get("bkmea_employees_male"))
        if column == "employees_female":
            return digits_int(fields.get("bkmea_employees_female"))
        if column == "machines_sewing":
            return digits_int(fields.get("bkmea_machines_sewing"))
        if column == "production_capacity_pcs_day":
            return digits_int(fields.get("bkmea_production_capacity"))
        return None

    return None
