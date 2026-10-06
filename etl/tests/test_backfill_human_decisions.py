"""ETL freshness C1 — past human decisions written into resolution_edges and
supplier_field_locks (ops/backfill_human_decisions.py)."""
from __future__ import annotations

import httpx

from ops import backfill_human_decisions as bhd

_IDS = {
    "from-row": "11111111-0000-0000-0000-000000000000",
    "to-row": "22222222-0000-0000-0000-000000000000",
    "bh-row": "33333333-0000-0000-0000-000000000000",
}


class FakeRest:
    def __init__(self, suppliers: list[dict], refs: dict[str, list[str]],
                 audit: list[dict] | None = None) -> None:
        self.suppliers = suppliers
        self.refs = refs  # source_ref -> holder ids
        self.audit = audit or []
        self.inserted: list[tuple[str, dict]] = []

    def all_rows(self, path: str, params: dict[str, str]) -> list[dict]:
        if path == "source_records":
            ref = params["source_ref"][3:]
            return [{"supplier_id": i} for i in self.refs.get(ref, [])]
        if path == "admin_audit_log":
            return self.audit
        if path == "sources":
            return [{"id": "src-bgmea"}]
        key, val = next((k, v[3:]) for k, v in params.items() if k in ("id", "slug"))
        return [s for s in self.suppliers if s[key] == val]

    def one(self, path: str, params: dict[str, str]) -> dict | None:
        rows = self.all_rows(path, params)
        return rows[0] if rows else None

    def insert(self, path: str, body: dict) -> dict:
        def key(p: str, b: dict) -> tuple:
            return (p, b.get("supplier_a"), b.get("supplier_b"),
                    b.get("supplier_id"), b.get("column_name"))

        if any(key(p, b) == key(path, body) for p, b in self.inserted):
            raise httpx.HTTPStatusError("dup", request=None, response=httpx.Response(409))  # type: ignore[arg-type]
        self.inserted.append((path, body))
        return body


def _row(slug: str, **extra) -> dict:
    return {"id": _IDS[slug], "slug": slug, "company_name": slug, **extra}


def _patch_plan(monkeypatch, edges=(), locks_from_decisions=False):
    monkeypatch.setattr(bhd, "build_edge_plan", lambda: list(edges))
    if not locks_from_decisions:
        real = bhd.build_lock_plan
        monkeypatch.setattr(bhd, "build_lock_plan", lambda audit: [
            l for l in real(audit) if l.source.startswith("admin_audit_log")
        ])


def test_dry_run_writes_nothing(monkeypatch):
    _patch_plan(monkeypatch, [bhd.EdgePlan("from-row", "to-row", "different", "r", "s")])
    rest = FakeRest([_row("from-row"), _row("to-row")], {})
    counts = bhd.run(rest, apply=False)
    assert rest.inserted == []
    assert counts["would-insert-edge"] == 1


def test_apply_sorts_ids_and_is_rerunnable(monkeypatch):
    _patch_plan(monkeypatch, [bhd.EdgePlan("to-row", "from-row", "different", "r", "s")])
    rest = FakeRest([_row("from-row"), _row("to-row")], {})
    bhd.run(rest, apply=True)
    path, body = rest.inserted[0]
    assert path == "resolution_edges"
    assert body["supplier_a"] < body["supplier_b"]
    assert bhd.run(rest, apply=True)["already-present-edge"] == 1


def test_import_holder_resolves_by_ref_and_ambiguity_is_skipped(monkeypatch):
    _patch_plan(monkeypatch, [
        bhd.EdgePlan("from-row", "ref:BGMEA:953", "different", "r", "s"),
        bhd.EdgePlan("from-row", "ref:BGMEA:528", "different", "r", "s"),
    ])
    rest = FakeRest([_row("from-row"), _row("bh-row")],
                    {"953": [_IDS["bh-row"]], "528": [_IDS["bh-row"], _IDS["from-row"]]})
    counts = bhd.run(rest, apply=True)
    assert counts["inserted-edge"] == 1
    assert counts["missing-side"] == 1  # two holders: never guess


def test_lock_only_when_the_human_value_still_holds(monkeypatch):
    _patch_plan(monkeypatch)
    audit = [
        {"id": "a1", "target_id": _IDS["to-row"], "patch": {"published": True},
         "created_at": "2026-08-21T15:55:08"},
        {"id": "a2", "target_id": _IDS["from-row"], "patch": {"published": True},
         "created_at": "2026-08-21T15:55:08"},
    ]
    rest = FakeRest([_row("to-row", is_published=True),
                     _row("from-row", is_published=False)], {}, audit)
    counts = bhd.run(rest, apply=True)
    assert counts["inserted-lock"] == 1
    assert counts["no-longer-holds"] == 1
    body = rest.inserted[0][1]
    assert body["column_name"] == "is_published" and body["locked_value"] is True


def test_real_plan_covers_every_source_and_has_no_self_pairs():
    plan = bhd.build_edge_plan()
    sources = " ".join(e.source for e in plan)
    for needle in ("seed_resolution_edges", "REZ-116", "REZ-117", "unmerge_bkmea"):
        assert needle in sources
    assert all(e.side_a != e.side_b for e in plan)
    assert not any("noor-a-alia" in (e.side_a + e.side_b) for e in plan)
    locks = bhd.build_lock_plan([])
    assert {l.column for l in locks} == {"entity_type"}
    assert len(locks) == 11  # REZ-117 rows with set_buying_house


def test_matcher_would_merge_fixtures():
    assert bhd.matcher_would_merge("cotton fair", "fair cotton") is False
    assert bhd.matcher_would_merge("anika", "anita") is False
    assert bhd.matcher_would_merge("master cham", "mastercham") is True
