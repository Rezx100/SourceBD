"""REZ-63 / A3 — resolution_edges schema constraint contracts.

These tests do NOT exercise live Postgres. CI has no database, and applying
migrations to production is forbidden in this session. Instead:

1. A Python mirror of the CHECK / partial-unique rules encodes the five
   behavioural contracts from REZ-63.
2. Static assertions on `0093_resolution_edges.sql` pin the SQL shape to
   that mirror (canonical order, not-self, verdict CHECK, live-pair unique
   index, read-path indexes, RLS with no permissive policies, no silent-
   swap trigger, append-only comment).

Residual risk: the first real proof is founder apply-time against Postgres.
libpg_query (`ops/validate_sql_syntax.py`) covers syntax only.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from uuid import UUID

import pytest

REPO = Path(__file__).resolve().parents[2]
MIGRATION = REPO / "supabase" / "migrations" / "0093_resolution_edges.sql"

A = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
B = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
C = UUID("cccccccc-cccc-cccc-cccc-cccccccccccc")


class CheckViolation(Exception):
    """Stand-in for PostgreSQL check_violation (23514)."""


class UniqueViolation(Exception):
    """Stand-in for PostgreSQL unique_violation (23505)."""


@dataclass(frozen=True)
class Edge:
    supplier_a: UUID
    supplier_b: UUID
    verdict: str
    superseded_at: object | None = None


def validate_edge(edge: Edge, existing: list[Edge]) -> None:
    """Faithful mirror of resolution_edges constraints after 0093.

    Rejects the same cases Postgres would reject via CHECKs and the
    partial unique index `idx_resolution_edges_pair_active`.
    """
    if edge.supplier_a >= edge.supplier_b:
        # Covers both out-of-order (a > b) and self-edge (a = b).
        # Postgres has two named CHECKs; either fires for a self-edge.
        raise CheckViolation("canonical order / not-self")
    if edge.verdict not in ("same", "different"):
        raise CheckViolation("verdict")
    if edge.superseded_at is None:
        for other in existing:
            if (
                other.superseded_at is None
                and other.supplier_a == edge.supplier_a
                and other.supplier_b == edge.supplier_b
            ):
                raise UniqueViolation("live pair")


def _sql() -> str:
    return MIGRATION.read_text(encoding="utf-8")


def test_migration_file_exists():
    assert MIGRATION.is_file()


def test_sql_creates_table_with_required_columns():
    sql = _sql()
    assert "create table if not exists public.resolution_edges" in sql
    for col in (
        "supplier_a",
        "supplier_b",
        "verdict",
        "decided_by",
        "decided_at",
        "rationale",
        "evidence_note",
        "superseded_at",
        "superseded_by",
    ):
        assert col in sql
    assert "references public.suppliers(id) on delete cascade" in sql
    assert "references public.resolution_edges(id)" in sql


def test_sql_enforces_canonical_order_and_not_self():
    sql = _sql()
    assert "chk_resolution_edges_canonical_order" in sql
    assert "check (supplier_a < supplier_b)" in sql
    assert "chk_resolution_edges_not_self" in sql
    assert "check (supplier_a <> supplier_b)" in sql
    # Explicit CHECK failure, not a silent rewrite.
    assert "create trigger" not in sql.lower()
    assert "silent-swap" in sql


def test_sql_verdict_check():
    sql = _sql()
    assert "chk_resolution_edges_verdict" in sql
    assert "check (verdict in ('same', 'different'))" in sql


def test_sql_live_pair_unique_and_read_indexes():
    sql = _sql()
    assert "idx_resolution_edges_pair_active" in sql
    assert "on public.resolution_edges (supplier_a, supplier_b)" in sql
    assert "idx_resolution_edges_a" in sql
    assert "idx_resolution_edges_b" in sql
    assert sql.count("where superseded_at is null") >= 3


def test_sql_rls_enabled_without_permissive_policies():
    sql = _sql()
    assert "alter table public.resolution_edges enable row level security;" in sql
    assert "create policy" not in sql.lower()


def test_sql_documents_append_only_and_caller_sort():
    sql = _sql()
    assert "comment on table public.resolution_edges" in sql
    assert "append-only" in sql
    assert "never UPDATE verdict" in sql or "never UPDATE" in sql
    assert "supplier_a < supplier_b" in sql
    assert "CALLER CONTRACT" in sql


def test_out_of_order_pair_rejected():
    """Case 1 — supplier_a > supplier_b is rejected."""
    with pytest.raises(CheckViolation):
        validate_edge(Edge(B, A, "same"), [])


def test_self_edge_rejected():
    """Case 2 — self-edge is rejected."""
    with pytest.raises(CheckViolation):
        validate_edge(Edge(A, A, "same"), [])


def test_two_live_edges_same_pair_rejected():
    """Case 3 — two live edges for the same pair are rejected."""
    live = Edge(A, B, "same")
    with pytest.raises(UniqueViolation):
        validate_edge(Edge(A, B, "different"), [live])


def test_superseded_plus_new_live_allowed():
    """Case 4 — superseded edge + new live edge for same pair is allowed."""
    old = Edge(A, B, "same", superseded_at="2026-08-01T00:00:00Z")
    validate_edge(Edge(A, B, "different"), [old])


def test_invalid_verdict_rejected():
    """Case 5 — verdict outside ('same','different') is rejected."""
    with pytest.raises(CheckViolation):
        validate_edge(Edge(A, B, "maybe"), [])


def test_canonical_same_verdict_accepted():
    validate_edge(Edge(A, B, "same"), [])
    validate_edge(Edge(A, C, "different"), [Edge(A, B, "same")])
