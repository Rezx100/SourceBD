"""REZ-64 / A4 — resolution_edges load-bearing in matcher + ops paths.

Six acceptance cases from the Linear issue. Case 1 is the most important:
with an empty edge table the matcher is a provable no-op — the existing
dedup guard suite (`test_supplier_dedup_guards.py`) must stay green and
unchanged in behaviour.
"""
from __future__ import annotations

from datetime import date
from typing import Any

from etl.core import resolution_edges as re_mod
from etl.core.normalize import make_slug, normalize_company_name
from etl.core.resolution_edges import (
    LIVE_EDGES_SQL,
    LiveEdge,
    apply_same_edge_canonical,
    clear_live_same_edge_cache,
    different_rationale,
    pair_key,
)
from etl.core.upsert import _find_existing
from etl.tests.conftest import FakeCursor
from ops.audit_cross_register_coverage import Member, certain_merge_groups, discover_clusters
from ops.check_supplier_splits import _certain_groups


# ---------------------------------------------------------------------------
# 1. Empty edges → matcher unchanged (re-pins the critical _find_existing
#    behaviours from test_supplier_dedup_guards; full suite is the CI signal)
# ---------------------------------------------------------------------------


def test_no_edges_find_existing_behaviours_unchanged() -> None:
    """With no live edges, Pass 1 / 1.5 / miss behave exactly as before."""
    assert (
        _find_existing(
            FakeCursor(squash_row={"id": "sup-existing"}),
            slug="mastercham",
            norm="mastercham",
            email=None,
            phones=[],
        )
        == "sup-existing"
    )
    assert (
        _find_existing(
            FakeCursor(slug_row={"id": "sup-slug"}, squash_row={"id": "sup-squash"}),
            slug="master-cham",
            norm="master cham",
            email=None,
            phones=[],
        )
        == "sup-slug"
    )
    assert _find_existing(FakeCursor(), slug="x", norm="x y", email=None, phones=[]) is None


def test_live_edges_sql_only_loads_non_superseded() -> None:
    """Superseded rulings must never enter the live map (cases 2/3 hinge on this)."""
    assert "superseded_at is null" in LIVE_EDGES_SQL.lower()


# ---------------------------------------------------------------------------
# 2 + 3. Merge path: live different → SKIP; superseded → not in live map
# ---------------------------------------------------------------------------


def test_live_different_edge_skips_merge_pair() -> None:
    a, b = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
    different = {pair_key(a, b): "founder: sarada-knitwear ≠ sarada-fashions"}
    assert different_rationale(different, a, b) == (
        "founder: sarada-knitwear ≠ sarada-fashions"
    )
    assert different_rationale(different, b, a) == (
        "founder: sarada-knitwear ≠ sarada-fashions"
    )


def test_superseded_different_edge_does_not_skip_merge() -> None:
    """A superseded row is filtered by LIVE_EDGES_SQL, so it never lands in
    the different_pairs map the merge script consults — skip is a no-op."""
    a, b = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
    assert different_rationale({}, a, b) is None


# ---------------------------------------------------------------------------
# 4. Audit: live different removes the pair from certain-merge output
# ---------------------------------------------------------------------------


def _slug_member(mid: str, name: str) -> Member:
    m = Member(
        id=mid,
        name=name,
        stored_norm=normalize_company_name(name),
        stored_slug=make_slug(name),
        created_at=date(2026, 1, 1),
        source_tags=["BGMEA"],
        ext_base=None,
    )
    m.rec_norm = m.stored_norm
    m.rec_slug = m.stored_slug
    m.records = [{"code": "BGMEA", "tier": "tier2_industry", "source_ref": "1"}]
    return m


def test_live_different_removes_pair_from_audit_certain_merge() -> None:
    """Two slug-equal members would be a certain merge group; a live
    `different` edge excludes them from every signal class."""
    a_id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    b_id = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
    members = {
        a_id: _slug_member(a_id, "Four H Apparels Ltd"),
        b_id: _slug_member(b_id, "FOUR H APPARELS LTD."),
    }
    assert members[a_id].rec_slug == members[b_id].rec_slug

    # Sanity: without the ruling, certain_merge_groups links them via signal A.
    bare_signals = {pair_key(a_id, b_id): {"A"}}
    assert len(certain_merge_groups(list(members.values()), bare_signals)) == 1

    clusters, pair_signals, ruled = discover_clusters(
        members,
        {},
        FakeCursor(),
        different_pairs={pair_key(a_id, b_id): "founder: distinct sister companies"},
    )
    assert pair_signals == {}
    assert clusters == []
    assert ruled == {pair_key(a_id, b_id): "founder: distinct sister companies"}
    assert certain_merge_groups(list(members.values()), pair_signals) == []


# ---------------------------------------------------------------------------
# 5. Split detector: live different → no certain-group failure
# ---------------------------------------------------------------------------


def test_check_supplier_splits_ignores_live_different_pair() -> None:
    a_id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    b_id = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
    members = {
        a_id: _slug_member(a_id, "Four H Apparels Ltd"),
        b_id: _slug_member(b_id, "FOUR H APPARELS LTD."),
    }
    # Without the ruling, slug equality would be a certain split.
    groups_fail, _, _ = _certain_groups(members, {}, FakeCursor(), different_pairs={})
    assert len(groups_fail) == 1

    groups_ok, signals, _ = _certain_groups(
        members,
        {},
        FakeCursor(),
        different_pairs={pair_key(a_id, b_id): "founder: settled"},
    )
    assert groups_ok == []
    assert signals == {}


# ---------------------------------------------------------------------------
# 6. Same edge, both published → log error, do not rewrite
# ---------------------------------------------------------------------------


def test_same_edge_both_published_logs_error_and_keeps_pass_result(
    monkeypatch: Any,
) -> None:
    a_id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    b_id = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
    edge = LiveEdge(
        supplier_a=a_id,
        supplier_b=b_id,
        verdict="same",
        rationale="founder: seeded merge pending",
        a_published=True,
        b_published=True,
    )
    clear_live_same_edge_cache()
    re_mod._SAME_EDGE_INDEX = {a_id: [edge], b_id: [edge]}

    errors: list[tuple[str, dict]] = []

    def _capture(event: str, **kwargs: Any) -> None:
        errors.append((event, kwargs))

    monkeypatch.setattr(re_mod.log, "error", _capture)

    # Pass 1 would return a_id; the both-published same edge must not rewrite.
    found = _find_existing(
        FakeCursor(slug_row={"id": a_id}),
        slug="four-h-apparels",
        norm="four h apparels",
        email=None,
        phones=[],
    )
    assert found == a_id
    assert any(e == "resolution.same_edge_both_published" for e, _ in errors)

    # Direct helper: same contract when called on the pass result.
    assert apply_same_edge_canonical(FakeCursor(), a_id) == a_id
