"""extension_base_name — REZ-67 / A7.

Critical negative: ``N. T. APPARELS UNIT-2 LIMITED`` must return None.
``Unit-2`` sits inside the registered company name followed by LIMITED;
stripping it would silently turn a real company into a facility of a
company that does not exist.
"""
from __future__ import annotations

import pytest

from etl.core.normalize import extension_base_name, make_slug, normalize_company_name
from etl.core.scraper import ScrapedRecord
from etl.core.upsert import upsert_supplier_with_source
from etl.tests.conftest import FakeCursor


# ---------------------------------------------------------------------------
# Pure function — production strings
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "raw, expected",
    [
        ("Babylon Garments Limited (Extension)", "Babylon Garments Limited"),
        ("Silken Sewing Ltd - New building", "Silken Sewing Ltd"),
        ("Graphics Textiles Ltd. (Extension 2)", "Graphics Textiles Ltd."),
        ("SAIHAM KNIT COMPOSITE LTD. (Extension area)", "SAIHAM KNIT COMPOSITE LTD."),
        ("Chaity Composite Ltd.- Annex building", "Chaity Composite Ltd."),
        ("Sterling Denims Ltd. Unit-2", "Sterling Denims Ltd."),
        ("Radial International Ltd. (Unit-2) (Extension)", "Radial International Ltd."),
        ("KSS Knit Composite Ltd. (Extension buildings)", "KSS Knit Composite Ltd."),
        (
            "MAS Intimates Bangladesh (Pvt.) Ltd.(Unit-03)",
            "MAS Intimates Bangladesh (Pvt.) Ltd.",
        ),
    ],
)
def test_extension_base_name_returns_mother(raw: str, expected: str) -> None:
    assert extension_base_name(raw) == expected


@pytest.mark.parametrize(
    "raw",
    [
        "N. T. APPARELS UNIT-2 LIMITED",  # critical — Unit-2 inside registered name
        "IFS TEXWEAR (PVT.) LTD.",
        "Babylon Garments Limited",
        "ZA Apparels Ltd (Jacket fty)",
    ],
)
def test_extension_base_name_returns_none_for_companies(raw: str) -> None:
    assert extension_base_name(raw) is None


def test_extension_base_name_never_returns_empty_string() -> None:
    assert extension_base_name("") is None
    assert extension_base_name("   ") is None
    assert extension_base_name("(Extension)") is None


def test_previously_annotation_mirrors_sql_end_anchor() -> None:
    # SQL strips (Previously NAME) only when trailing ($). Alone it is not an
    # extension pattern. When stacked before (Extension), the annotation is
    # not yet at end on the first pass, so it survives on the returned base —
    # same as public.rsc_extension_base_name.
    assert extension_base_name("Foo Textiles Ltd (Previously Bar)") is None
    assert (
        extension_base_name("Foo Textiles Ltd (Previously Bar) (Extension)")
        == "Foo Textiles Ltd (Previously Bar)"
    )
    assert (
        extension_base_name("Foo Textiles Ltd (Extension) (Previously Bar)")
        == "Foo Textiles Ltd"
    )


# ---------------------------------------------------------------------------
# Upsert create-path behaviour
# ---------------------------------------------------------------------------

def _rsc(name: str, ref: str = "ext-1") -> ScrapedRecord:
    return ScrapedRecord(
        source_code="RSC",
        source_ref=ref,
        company_name=name,
        payload={"factory_id": ref},
    )


def _insert_params(cur: FakeCursor) -> tuple[Any, ...]:
    inserts = [(s, p) for s, p in cur.executed if "insert into public.suppliers" in s]
    assert len(inserts) == 1
    return inserts[0][1]


def test_extension_with_matching_parent_sets_facility_of(patched_db) -> None:
    parent = "Babylon Garments Limited"
    ext = "Babylon Garments Limited (Extension)"
    cur = FakeCursor(
        skip_rows=[],
        slug_by_value={make_slug(parent): {"id": "sup-parent"}},
    )
    patched_db(cur)

    assert upsert_supplier_with_source(_rsc(ext)) == "sup-new"

    params = _insert_params(cur)
    assert params[-1] == "sup-parent"  # facility_of
    assert cur.facility_of_inserted == "sup-parent"
    # A2 facility guard (simulated): publish coerce leaves the row unpublished.
    assert cur.is_published is False


def test_extension_with_no_matching_parent_creates_as_today(patched_db) -> None:
    ext = "Babylon Garments Limited (Extension)"
    cur = FakeCursor(skip_rows=[])
    patched_db(cur)

    assert upsert_supplier_with_source(_rsc(ext)) == "sup-new"

    params = _insert_params(cur)
    assert params[-1] is None  # facility_of
    assert cur.is_published is True  # publish path unchanged when no parent


def test_extension_squash_parent_match_sets_facility_of(patched_db) -> None:
    """Pass 1.5 bar: parent found by squashed-norm equality, not slug."""
    parent = "Master Cham Ltd"
    ext = "Master Cham Ltd (Extension)"
    parent_squash = normalize_company_name(parent).replace(" ", "")
    cur = FakeCursor(
        skip_rows=[],
        squash_by_value={parent_squash: {"id": "sup-squash-parent"}},
    )
    patched_db(cur)

    assert upsert_supplier_with_source(_rsc(ext)) == "sup-new"
    assert _insert_params(cur)[-1] == "sup-squash-parent"
    assert cur.is_published is False


def test_fuzzy_only_parent_candidate_treated_as_no_parent(patched_db) -> None:
    """Anti-regression for Anika→ANITA / Bando→BRAND dry-run re-conflations.

    Parent lookup is exact recomputed identity only. A fuzzy-near-miss
    candidate must not become facility_of.
    """
    # Base strips to Anika; ANITA would only match Pass-4 fuzzy — which
    # `_find_facility_parent` never consults. FakeCursor returns nothing on
    # slug/squash, so facility_of stays NULL.
    ext = "Anika Apparels (Pvt) Ltd (Extension)"
    base = extension_base_name(ext)
    assert base == "Anika Apparels (Pvt) Ltd"

    cur = FakeCursor(skip_rows=[])
    patched_db(cur)
    assert upsert_supplier_with_source(_rsc(ext)) == "sup-new"

    assert _insert_params(cur)[-1] is None
    # Parent lookup queried exact bars for the base — never a fuzzy scan
    # keyed on the base name (Pass 4 only runs inside `_find_existing` on
    # the extension name itself, and FakeCursor returns no fuzzy hits).
    base_slug = make_slug(base)
    slug_params = [p[0] for s, p in cur.executed if p and "where slug = %s" in s]
    assert base_slug in slug_params
    fuzzy_sqls = [
        s for s, _ in cur.executed
        if "company_name_norm" in s and "replace(" not in s and "select id" in s
    ]
    # No dedicated fuzzy parent query exists; Pass 4 candidate select (if any)
    # must not have been issued against the base alone as a parent lookup.
    assert not any(base_slug in str(p) for s, p in cur.executed if s in fuzzy_sqls)


# Avoid importing Any at module top for the helper annotation only.
from typing import Any  # noqa: E402
