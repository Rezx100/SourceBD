"""BKMEA pre-fetch gate + source_records split (REZ-36 Spec A).

Two defects made hash-skip impossible and burned ~590 Firecrawl credits per
run: `bkmea_web` and `bkmea_detail` SHARED one source_records row per member
(the raw_hash flip-flopped between list-hash and detail-hash on alternating
runs), and `_load_targets` keyed off `email_primary is null or address_raw is
null` — a predicate BKMEA's email-shy pages never clear, so the whole register
was re-scraped every run.

The detail record now writes its own `{detail_id}:detail` row carrying
`enriched_from_list_hash`, and the gate is a pure function — mocked cursors
never parse SQL, and an untested SQL predicate is how the old one failed.
"""
from __future__ import annotations

from typing import Any

import pytest

from etl.core.upsert import upsert_supplier_with_source
from etl.scrapers.bkmea_detail import (
    _CANDIDATES_SQL,
    _UNCITABLE_FIELDS,
    BkmeaDetailScraper,
    _needs_enrichment,
)
from etl.tests.conftest import FakeCursor

DETAIL_HTML = """
<div class="tbrow"><table class="table"><tbody>
  <tr><td>BKMEA Membership No.</td><td></td><td>2632 - C/2026</td></tr>
  <tr><td>Factory Name</td><td></td><td>ACME KNIT COMPOSITE LTD.</td></tr>
  <tr><td>Factory Address</td><td></td><td>Plot 12, Dhaka</td></tr>
  <tr><td>Owner Details / Owner Name</td><td></td><td>Mr. Rahim Uddin</td></tr>
</tbody></table></div>
"""


def _parse(**kwargs: Any):
    args = dict(
        list_ref="2632",
        fallback_name="Acme Knit Composite Ltd.",
        detail_id="8817",
        url="https://member.bkmea.com/member/details/8817",
        list_hash="list-hash-1",
    )
    args.update(kwargs)
    return BkmeaDetailScraper()._parse_detail(DETAIL_HTML, **args)


# ---------------------------------------------------------------------------
# The gate predicate
# ---------------------------------------------------------------------------


def test_gate_targets_never_enriched_members() -> None:
    assert _needs_enrichment(
        enriched_from_list_hash=None, list_hash="h",
        has_unreviewed_stale_claim=False, full_refresh=False,
    ) is True


def test_gate_targets_members_whose_list_row_changed() -> None:
    assert _needs_enrichment(
        enriched_from_list_hash="old", list_hash="new",
        has_unreviewed_stale_claim=False, full_refresh=False,
    ) is True


def test_gate_skips_members_whose_list_row_is_unchanged() -> None:
    assert _needs_enrichment(
        enriched_from_list_hash="h", list_hash="h",
        has_unreviewed_stale_claim=False, full_refresh=False,
    ) is False


def test_gate_targets_unreviewed_stale_claims() -> None:
    assert _needs_enrichment(
        enriched_from_list_hash="h", list_hash="h",
        has_unreviewed_stale_claim=True, full_refresh=False,
    ) is True


def test_full_refresh_bypasses_the_gate() -> None:
    assert _needs_enrichment(
        enriched_from_list_hash="h", list_hash="h",
        has_unreviewed_stale_claim=False, full_refresh=True,
    ) is True


# ---------------------------------------------------------------------------
# The candidate SQL: gate inputs present, dead predicate gone, detail rows out
# ---------------------------------------------------------------------------


def test_candidates_sql_selects_the_gate_inputs() -> None:
    assert "enriched_from_list_hash" in _CANDIDATES_SQL
    assert "has_unreviewed_stale_claim" in _CANDIDATES_SQL
    assert "sr.raw_hash as list_hash" in _CANDIDATES_SQL


def test_candidates_sql_keeps_the_stale_claim_branch_exactly() -> None:
    assert "ed.scraper_code = 'bkmea_detail'" in _CANDIDATES_SQL
    assert "ec.status = 'stale'" in _CANDIDATES_SQL
    assert "ec.reviewed_at is null" in _CANDIDATES_SQL


def test_candidates_sql_drops_the_null_field_predicate() -> None:
    """The old `email_primary is null or address_raw is null` clause never
    cleared (BKMEA rarely publishes email) and re-scraped the whole register."""
    assert "email_primary is null" not in _CANDIDATES_SQL
    assert "address_raw is null" not in _CANDIDATES_SQL


def test_candidates_sql_excludes_detail_namespace_rows() -> None:
    """Detail rows also carry `bkmea_detail_id` in fields; without the
    exclusion each would re-target its own page on every run."""
    assert "position(':' in sr.source_ref) = 0" in _CANDIDATES_SQL


# ---------------------------------------------------------------------------
# _load_targets: predicate wired over the candidate rows
# ---------------------------------------------------------------------------


class _RowsCursor:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self._rows = rows

    def execute(self, sql: str, params: Any = None) -> None:
        pass

    def fetchall(self) -> list[dict[str, Any]]:
        return list(self._rows)

    def __enter__(self) -> "_RowsCursor":
        return self

    def __exit__(self, *exc: Any) -> bool:
        return False


class _RowsConn:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self._rows = rows

    def cursor(self) -> _RowsCursor:
        return _RowsCursor(self._rows)

    def __enter__(self) -> "_RowsConn":
        return self

    def __exit__(self, *exc: Any) -> bool:
        return False


class _RowsDb:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self._rows = rows

    def conn(self) -> _RowsConn:
        return _RowsConn(self._rows)


def _candidate(**over: Any) -> dict[str, Any]:
    row: dict[str, Any] = {
        "source_ref": "2632",
        "company_name": "Acme Knit Composite Ltd.",
        "detail_id": "8817",
        "list_hash": "h1",
        "enriched_from_list_hash": "h1",
        "has_unreviewed_stale_claim": False,
    }
    row.update(over)
    return row


def _targets(monkeypatch: pytest.MonkeyPatch, rows: list[dict[str, Any]], **kwargs: Any):
    monkeypatch.setattr("etl.scrapers.bkmea_detail.db", _RowsDb(rows))
    return list(BkmeaDetailScraper(**kwargs)._load_targets())


def test_load_targets_skips_unchanged_members(monkeypatch: pytest.MonkeyPatch) -> None:
    assert _targets(monkeypatch, [_candidate()]) == []


def test_load_targets_picks_up_changed_list_hash(monkeypatch: pytest.MonkeyPatch) -> None:
    targets = _targets(monkeypatch, [_candidate(list_hash="h2")])
    assert targets == [("8817", "2632", "Acme Knit Composite Ltd.", "h2")]


def test_load_targets_picks_up_never_enriched_and_stale(monkeypatch: pytest.MonkeyPatch) -> None:
    targets = _targets(
        monkeypatch,
        [
            _candidate(source_ref="1", detail_id="d1", enriched_from_list_hash=None),
            _candidate(source_ref="2", detail_id="d2", has_unreviewed_stale_claim=True),
        ],
    )
    assert [t[0] for t in targets] == ["d1", "d2"]


def test_load_targets_full_refresh_returns_everything(monkeypatch: pytest.MonkeyPatch) -> None:
    targets = _targets(monkeypatch, [_candidate(), _candidate(source_ref="9", detail_id="d9")], full_refresh=True)
    assert [t[0] for t in targets] == ["8817", "d9"]


def test_load_targets_ignores_rows_without_a_detail_id(monkeypatch: pytest.MonkeyPatch) -> None:
    assert _targets(monkeypatch, [_candidate(detail_id=None)]) == []


# ---------------------------------------------------------------------------
# The split record: own row, list ref as alias, gate marker in the payload
# ---------------------------------------------------------------------------


def test_detail_record_is_namespaced_off_the_list_row() -> None:
    rec = _parse()
    assert rec is not None
    assert rec.source_ref == "8817:detail"
    assert rec.source_code == "BKMEA"  # no new source code
    assert rec.alias_refs == ("2632",)
    assert rec.payload["enriched_from_list_hash"] == "list-hash-1"


def test_enriched_from_list_hash_is_never_cited() -> None:
    """The marker is our own plumbing, not a claim about the supplier — it
    must stay out of the evidence writer's field set."""
    assert "enriched_from_list_hash" in _UNCITABLE_FIELDS


def test_running_detail_after_the_split_creates_zero_new_suppliers(patched_db) -> None:
    """The linkage pin. Today the shared ref is what resolves a detail record
    to the supplier the list row created; after the split the list ref rides
    as an alias and Pass 0 must still land on that supplier — never INSERT."""
    rec = _parse()
    assert rec is not None
    cur = FakeCursor(skip_rows=[], pass0_row={"supplier_id": "sup-existing"})
    patched_db(cur)

    result = upsert_supplier_with_source(rec)

    assert result == "sup-existing"
    sqls = [sql for sql, _ in cur.executed]
    assert not any("insert into public.suppliers" in s for s in sqls)
    pass0 = [params for sql, params in cur.executed if "source_ref = any" in sql]
    assert pass0 == [("src-1", ["8817:detail", "2632"], "8817:detail")]


def test_second_detail_run_hash_skips(patched_db) -> None:
    """Steady state: the detail row's stored hash matches, so a forced
    full-refresh re-fetch still costs zero writes — only fetched_at moves."""
    rec = _parse()
    assert rec is not None
    cur = FakeCursor(skip_rows=[{"supplier_id": "sup-existing", "raw_hash": rec.hash()}])
    spies = patched_db(cur)

    assert upsert_supplier_with_source(rec) is None
    freshen = [p for s, p in cur.executed if "set fetched_at = now()" in s]
    assert freshen == [("src-1", "8817:detail")]
    assert spies["conn"].commits == 1


# ---------------------------------------------------------------------------
# The CLI knob
# ---------------------------------------------------------------------------


def test_cli_full_refresh_reaches_the_scraper(monkeypatch: pytest.MonkeyPatch) -> None:
    from typer.testing import CliRunner

    from etl import cli

    captured: dict[str, Any] = {}

    class _Fake:
        def __init__(self, **kwargs: Any) -> None:
            captured.update(kwargs)

        async def run(self) -> dict[str, int]:
            return {}

    monkeypatch.setitem(cli.RUNNABLE, "bkmea_detail", _Fake)
    result = CliRunner().invoke(cli.app, ["run", "bkmea_detail", "--full-refresh"])
    assert result.exit_code == 0
    assert captured == {"full_refresh": True}


def test_cli_full_refresh_is_rejected_for_other_scrapers() -> None:
    from typer.testing import CliRunner

    from etl import cli

    result = CliRunner().invoke(cli.app, ["run", "bkmea_web", "--full-refresh"])
    assert result.exit_code == 1
    assert "only applies to bkmea_detail" in result.output


def test_queue_style_construction_keeps_the_gate_on() -> None:
    """The admin queue instantiates RUNNABLE[code]() with no arguments; the
    founder knob must default off there."""
    assert BkmeaDetailScraper().full_refresh is False
