"""REZ-65 / A5 — seed resolution_edges from founder rulings.

Four acceptance cases from the Linear issue:
1. Dry-run writes nothing.
2. Id sorting is applied so the CHECK never fires.
3. A pair where one slug does not resolve is reported, not crashed on.
4. Re-running after apply reports "already present" and exits 0.
"""
from __future__ import annotations

from typing import Any

import httpx
import pytest

from ops.seed_resolution_edges import (
    FounderRuling,
    seed_all,
    seed_one,
    sorted_pair_ids,
)


# UUIDs chosen so lexicographic order is known: AAA... < BBB...
_ID_LOW = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
_ID_HIGH = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"


class FakeRest:
    """In-memory Rest stand-in for the seed script."""

    def __init__(
        self,
        suppliers: dict[str, dict[str, Any]] | None = None,
        *,
        conflict_on_insert: bool = False,
    ) -> None:
        self.suppliers = suppliers or {}
        self.inserts: list[dict[str, Any]] = []
        self.conflict_on_insert = conflict_on_insert

    def one(self, path: str, params: dict[str, str]) -> dict | None:
        assert path == "suppliers"
        slug_eq = params.get("slug", "")
        assert slug_eq.startswith("eq.")
        slug = slug_eq[3:]
        return self.suppliers.get(slug)

    def insert(self, path: str, body: dict) -> dict:
        assert path == "resolution_edges"
        if self.conflict_on_insert:
            request = httpx.Request("POST", "https://example.test/rest/v1/resolution_edges")
            response = httpx.Response(409, request=request, text='{"code":"23505"}')
            raise httpx.HTTPStatusError("conflict", request=request, response=response)
        self.inserts.append(dict(body))
        return {"id": "edge-1", **body}


def _sup(slug: str, sid: str, name: str = "X") -> dict[str, Any]:
    return {"id": sid, "slug": slug, "company_name": name, "is_published": True}


def test_sorted_pair_ids_canonical_order() -> None:
    """Id sorting is applied so the supplier_a < supplier_b CHECK never fires."""
    assert sorted_pair_ids(_ID_HIGH, _ID_LOW) == (_ID_LOW, _ID_HIGH)
    assert sorted_pair_ids(_ID_LOW, _ID_HIGH) == (_ID_LOW, _ID_HIGH)
    with pytest.raises(ValueError):
        sorted_pair_ids(_ID_LOW, _ID_LOW)


def test_dry_run_writes_nothing() -> None:
    rest = FakeRest(
        {
            "sarada-knitwear": _sup("sarada-knitwear", _ID_LOW, "Sarada Knit Wear Ltd."),
            "sarada-fashions": _sup("sarada-fashions", _ID_HIGH, "SARADA FASHIONS LTD."),
        }
    )
    ruling = FounderRuling(
        slug_a="sarada-knitwear",
        slug_b="sarada-fashions",
        verdict="different",
        rationale="test",
    )
    status = seed_one(rest, ruling, apply=False)
    assert status == "would-insert"
    assert rest.inserts == []


def test_apply_sorts_ids_before_insert() -> None:
    """Regardless of slug argument order, insert body has supplier_a < supplier_b."""
    rest = FakeRest(
        {
            "alpha": _sup("alpha", _ID_HIGH),
            "beta": _sup("beta", _ID_LOW),
        }
    )
    # Pass high-id slug first so unsorted insert would violate the CHECK.
    ruling = FounderRuling(
        slug_a="alpha",
        slug_b="beta",
        verdict="different",
        rationale="test",
    )
    status = seed_one(rest, ruling, apply=True)
    assert status == "inserted"
    assert len(rest.inserts) == 1
    body = rest.inserts[0]
    assert body["supplier_a"] == _ID_LOW
    assert body["supplier_b"] == _ID_HIGH
    assert body["supplier_a"] < body["supplier_b"]
    assert body["decided_by"] == "founder"
    assert body["verdict"] == "different"


def test_missing_slug_is_reported_not_crashed() -> None:
    rest = FakeRest(
        {"sarada-knitwear": _sup("sarada-knitwear", _ID_LOW, "Sarada Knit Wear Ltd.")}
    )
    # same + missing loser → structurally satisfied (completed merge).
    same_ruling = FounderRuling(
        slug_a="sarada-knitwear",
        slug_b="sarda-knitwear",
        verdict="same",
        rationale="merged",
    )
    assert seed_one(rest, same_ruling, apply=True) == "structurally-satisfied"
    assert rest.inserts == []

    # different + missing side → missing-side, no crash.
    diff_ruling = FounderRuling(
        slug_a="sarada-knitwear",
        slug_b="ghost-slug",
        verdict="different",
        rationale="test",
    )
    assert seed_one(rest, diff_ruling, apply=True) == "missing-side"
    assert rest.inserts == []


def test_rerun_after_apply_reports_already_present_exit_0() -> None:
    rest = FakeRest(
        {
            "corny-fashion": _sup("corny-fashion", _ID_LOW, "CORNY FASHION LTD"),
            "crony-fashion": _sup("crony-fashion", _ID_HIGH, "CRONY FASHION LTD"),
        },
        conflict_on_insert=True,
    )
    ruling = FounderRuling(
        slug_a="corny-fashion",
        slug_b="crony-fashion",
        verdict="different",
        rationale="test",
    )
    assert seed_one(rest, ruling, apply=True) == "already-present"
    # seed_all must exit 0 even when every live pair is already present.
    code = seed_all(rest, (ruling,), apply=True)
    assert code == 0
