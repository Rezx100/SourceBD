"""Both directions of sanctions screening share one pair-level predicate (REZ-32).

Until this fix, screening was one-directional: `_match_and_screen` fired only
when a list *entry* was ingested, so a factory placed on a sanctions list
BEFORE it entered the catalog published clean — production had 3 screening
rows ever, 0 active, while 13,366 list entries sat stored. The supplier-side
screen now runs inside the upsert transaction, and both directions decide
through `_pair_matches`, so detection cannot drift between them (the same
principle as `ops/check_supplier_conflations.py` reusing `_names_compatible`).

The "must not match" pairs are the failure modes already pinned for supplier
dedup — except that here a false positive does not merge two factories, it
brands a real factory as sanctioned and zeroes its score. The "must match"
set is the counterweight: a guard that refuses everything just lets
sanctioned entities publish clean.
"""
from __future__ import annotations

import json
from typing import Any

import pytest

from etl.core.normalize import normalize_company_name
from etl.core.sanctions import (
    SanctionEntry,
    _match_and_screen,
    _pair_matches,
    screen_supplier_against_entries,
)


def _norm(a: str, b: str) -> tuple[str, str]:
    return normalize_company_name(a), normalize_company_name(b)


# Different companies that a bare token_sort_ratio >= 95 cannot tell apart:
# it sorts tokens before comparing, so a word-order permutation scores 100 and
# a swapped leading initials block scores 95+ on longer names. Same observed
# pattern as the 31 Jul 2026 conflation audit.
CONFLATION_PAIRS = [
    ("COTTON FAIR (PVT) LTD", "FAIR COTTON (PVT) LTD"),      # token_sort 100
    ("H. R TEXTILE MILLS LTD.", "G.R TEXTILE MILLS LTD"),    # initials swap
    ("A. B. KNITWEAR INDUSTRIES LTD", "B. A. KNITWEAR INDUSTRIES LTD"),
]

# One entity, written down two ways — the supplier and the list entry must
# still screen as a match.
TRUE_VARIANTS = [
    ("KNIT RADIX LTD", "Knit Radix Limited"),
    ("Fakir Apparels Ltd", "FAKIR APPARELS LIMITED"),
    ("Ha-Meem Sportswear Ltd.", "HA MEEM SPORTSWEAR LTD"),
    ("IMPERIAL KNITTING INDUSTRIES LTD.", "IMPERIAL KNITTING INDUSTRIES LTD"),
]

# Names that collapse to fewer than two significant tokens after normalisation
# can never be screened safely, on EITHER side of the pair.
UNSCREENABLE_NAMES = ["M S D", "M.S.D. International"]


# ------------------------------------------------------------- fake db ----
class _FakeCursor:
    """Records statements and emulates the 0089 partial unique index.

    The idempotency guard lives in Postgres (`on conflict do nothing` against
    `idx_sanc_screening_unique_active`), so the fake enforces the same key —
    (supplier_id, list, coalesce(list_entry_ref, '')) over active rows — to
    prove the code issues conflict-able inserts with a stable match identity.
    """

    def __init__(
        self,
        *,
        suppliers: list[dict[str, Any]] | None = None,
        entries: list[dict[str, Any]] | None = None,
    ) -> None:
        self._suppliers = suppliers or []
        self._entries = entries or []
        self.statements: list[str] = []
        self.screening_rows: list[dict[str, Any]] = []
        self._active_keys: set[tuple[Any, ...]] = set()
        self._rows: list[dict[str, Any]] = []

    def execute(self, sql: str, params: tuple[Any, ...] | None = None) -> None:
        stmt = " ".join(sql.split())
        self.statements.append(stmt)
        self._rows = []
        if "from public.suppliers" in stmt:
            self._rows = list(self._suppliers)
        elif "from public.sanctions_list_entries" in stmt:
            self._rows = list(self._entries)
        elif stmt.startswith("insert into public.sanctions_screening"):
            assert "on conflict do nothing" in stmt
            assert "now(), true)" in stmt  # every screening row is born active
            assert params is not None
            supplier_id, list_code, matched_name, score, entry_ref, details = params
            key = (supplier_id, list_code, entry_ref or "")
            if key not in self._active_keys:
                self._active_keys.add(key)
                self.screening_rows.append(
                    {
                        "supplier_id": supplier_id,
                        "list": list_code,
                        "matched_name": matched_name,
                        "match_score": score,
                        "list_entry_ref": entry_ref,
                        "details": json.loads(details),
                    }
                )

    def fetchall(self) -> list[dict[str, Any]]:
        return self._rows


def _entry(name: str, *, ref: str = "ofac-1") -> SanctionEntry:
    return SanctionEntry(
        list_code="ofac_sdn",
        source_code="OFAC",
        entry_ref=ref,
        entity_name=name,
        source_url="https://sanctions.example/list",
    )


def _entry_row(name: str, *, entry_id: str = "e-1", ref: str = "ofac-1") -> dict[str, Any]:
    return {
        "id": entry_id,
        "list": "ofac_sdn",
        "entry_ref": ref,
        "entity_name": name,
        "entity_name_norm": normalize_company_name(name),
        "source_url": "https://sanctions.example/list",
    }


def _supplier_row(name: str, *, supplier_id: str = "s-1") -> dict[str, Any]:
    return {"id": supplier_id, "company_name_norm": normalize_company_name(name)}


# ---------------------------------------------------------- the predicate ----
@pytest.mark.parametrize(("a", "b"), CONFLATION_PAIRS)
def test_different_companies_never_screen_as_a_match(a: str, b: str) -> None:
    na, nb = _norm(a, b)
    assert _pair_matches(na, nb) is False
    assert _pair_matches(nb, na) is False


@pytest.mark.parametrize(("a", "b"), TRUE_VARIANTS)
def test_true_variants_still_screen_as_a_match(a: str, b: str) -> None:
    na, nb = _norm(a, b)
    assert _pair_matches(na, nb) is True
    assert _pair_matches(nb, na) is True


@pytest.mark.parametrize("name", UNSCREENABLE_NAMES)
def test_single_significant_token_names_are_unscreenable_on_both_sides(name: str) -> None:
    sparse = normalize_company_name(name)
    other = normalize_company_name("KNIT RADIX LTD")
    assert _pair_matches(sparse, other) is False
    assert _pair_matches(other, sparse) is False


# ---------------------------------------------------------- supplier side ----
def test_supplier_side_screen_inserts_one_active_row() -> None:
    cur = _FakeCursor(entries=[_entry_row("FAKIR APPARELS LIMITED")])

    matched = screen_supplier_against_entries(
        cur, supplier_id="s-1", norm=normalize_company_name("Fakir Apparels Ltd")
    )

    assert matched == ["e-1"]
    assert len(cur.screening_rows) == 1
    row = cur.screening_rows[0]
    assert row["supplier_id"] == "s-1"
    assert row["list"] == "ofac_sdn"
    assert row["matched_name"] == "FAKIR APPARELS LIMITED"
    assert row["list_entry_ref"] == "ofac-1"
    assert 0.95 <= row["match_score"] <= 1.0
    assert row["details"] == {
        "sanctions_list_entry_id": "e-1",
        "source_url": "https://sanctions.example/list",
    }


def test_supplier_side_prefilters_on_the_trigram_index_best_first() -> None:
    cur = _FakeCursor(entries=[])

    screen_supplier_against_entries(
        cur, supplier_id="s-1", norm=normalize_company_name("Fakir Apparels Ltd")
    )

    (select,) = cur.statements
    assert "from public.sanctions_list_entries" in select
    assert "entity_name_norm %% %s" in select      # GIN idx_sle_name_trgm
    assert "order by entity_name_norm <-> %s" in select


def test_rescreening_the_same_supplier_yields_exactly_one_row() -> None:
    cur = _FakeCursor(entries=[_entry_row("FAKIR APPARELS LIMITED")])
    norm = normalize_company_name("Fakir Apparels Ltd")

    screen_supplier_against_entries(cur, supplier_id="s-1", norm=norm)
    screen_supplier_against_entries(cur, supplier_id="s-1", norm=norm)

    inserts = [
        s for s in cur.statements if s.startswith("insert into public.sanctions_screening")
    ]
    assert len(inserts) == 2        # both runs attempt the insert ...
    assert len(cur.screening_rows) == 1  # ... and the unique key absorbs the replay


@pytest.mark.parametrize(("entry_name", "supplier_name"), CONFLATION_PAIRS)
def test_supplier_side_rejects_conflation_candidates(entry_name: str, supplier_name: str) -> None:
    cur = _FakeCursor(entries=[_entry_row(entry_name)])

    matched = screen_supplier_against_entries(
        cur, supplier_id="s-1", norm=normalize_company_name(supplier_name)
    )

    assert matched == []
    assert cur.screening_rows == []


def test_supplier_side_short_circuits_before_querying_when_unscreenable() -> None:
    cur = _FakeCursor(entries=[_entry_row("FAKIR APPARELS LIMITED")])

    matched = screen_supplier_against_entries(
        cur, supplier_id="s-1", norm=normalize_company_name("M S D")
    )

    assert matched == []
    assert cur.statements == []


def test_supplier_side_skips_unscreenable_entry_candidates() -> None:
    cur = _FakeCursor(entries=[_entry_row("M S D", entry_id="e-sparse")])

    matched = screen_supplier_against_entries(
        cur, supplier_id="s-1", norm=normalize_company_name("Fakir Apparels Ltd")
    )

    assert matched == []
    assert cur.screening_rows == []


# ------------------------------------------------------------- entry side ----
def test_entry_side_screen_still_inserts_one_active_row() -> None:
    cur = _FakeCursor(suppliers=[_supplier_row("Fakir Apparels Ltd")])
    entry = _entry("FAKIR APPARELS LIMITED")

    matched = _match_and_screen(
        cur,
        entry=entry,
        norm=normalize_company_name(entry.entity_name),
        entry_id="e-1",
    )

    assert matched == ["s-1"]
    assert len(cur.screening_rows) == 1
    row = cur.screening_rows[0]
    assert row["supplier_id"] == "s-1"
    assert row["matched_name"] == "FAKIR APPARELS LIMITED"
    assert row["list_entry_ref"] == "ofac-1"
    assert 0.95 <= row["match_score"] <= 1.0
    assert row["details"] == {
        "sanctions_list_entry_id": "e-1",
        "source_url": "https://sanctions.example/list",
    }


@pytest.mark.parametrize(("entry_name", "supplier_name"), CONFLATION_PAIRS)
def test_entry_side_rejects_conflation_candidates(entry_name: str, supplier_name: str) -> None:
    cur = _FakeCursor(suppliers=[_supplier_row(supplier_name)])
    entry = _entry(entry_name)

    matched = _match_and_screen(
        cur,
        entry=entry,
        norm=normalize_company_name(entry.entity_name),
        entry_id="e-1",
    )

    assert matched == []
    assert cur.screening_rows == []


def test_entry_side_short_circuits_before_querying_when_unscreenable() -> None:
    cur = _FakeCursor(suppliers=[_supplier_row("Fakir Apparels Ltd")])
    entry = _entry("M S D")

    matched = _match_and_screen(
        cur,
        entry=entry,
        norm=normalize_company_name(entry.entity_name),
        entry_id="e-1",
    )

    assert matched == []
    assert cur.statements == []


def test_entry_side_skips_unscreenable_supplier_candidates() -> None:
    cur = _FakeCursor(suppliers=[_supplier_row("M S D", supplier_id="s-sparse")])
    entry = _entry("FAKIR APPARELS LIMITED")

    matched = _match_and_screen(
        cur,
        entry=entry,
        norm=normalize_company_name(entry.entity_name),
        entry_id="e-1",
    )

    assert matched == []
    assert cur.screening_rows == []
