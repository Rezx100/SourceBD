"""Same-scraper supersede classification (2 Aug 2026 defect fix).

`supersede_claims` used url_hash as the proxy for "a different source
disagrees": different URL + different value -> `contradicted`. But BKMEA
re-lists members on NEW detail-page URLs, so one source updating its own data
across a page move was classified as a genuine disagreement — the 2 Aug
bkmea_detail run alone put 396 contradicted claims across 65 suppliers on the
/admin/evidence worklist, none of them real.

The rule is now: same scraper replacing its own claim is always `superseded`
(bookkeeping), whatever the URL; `contradicted` is reserved for cross-scraper
disagreement. Mocked cursors never parse SQL (the REZ-34 lesson), so these
tests pin the DECISION STRUCTURE of the statement — branch presence and
ordering — plus the function's plumbing.
"""
from __future__ import annotations

from typing import Any

import pytest

from etl.evidence import writer


class _Cursor:
    def __init__(self) -> None:
        self.executed: list[tuple[str, Any]] = []
        self.rowcount = 0

    def execute(self, sql: str, params: Any = None) -> None:
        self.executed.append((sql, params))
        self.rowcount = 3

    def __enter__(self) -> "_Cursor":
        return self

    def __exit__(self, *exc: Any) -> bool:
        return False


class _Conn:
    def __init__(self, cursor: _Cursor) -> None:
        self._cursor = cursor
        self.commits = 0

    def cursor(self) -> _Cursor:
        return self._cursor

    def commit(self) -> None:
        self.commits += 1

    def __enter__(self) -> "_Conn":
        return self

    def __exit__(self, *exc: Any) -> bool:
        return False


class _Db:
    def __init__(self, conn: _Conn) -> None:
        self._conn = conn

    def conn(self) -> _Conn:
        return self._conn


@pytest.fixture
def captured(monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    cur = _Cursor()
    conn = _Conn(cur)
    monkeypatch.setattr(writer, "db", _Db(conn))
    return {"cur": cur, "conn": conn}


def _run(captured: dict[str, Any]) -> str:
    count = writer.supersede_claims(
        "source_records", "sr-1", "ev-new", ["phone_primary"], subject_key=None
    )
    assert count == 3
    assert captured["conn"].commits == 1
    return captured["cur"].executed[0][0]


def test_same_scraper_replacement_is_superseded_not_contradicted(captured) -> None:
    sql = _run(captured)
    # The new branch: the retiring claim's document scraper compared against
    # the keeping document's scraper.
    assert "d.scraper_code" in sql
    assert "doc_scraper_code" in sql
    same_scraper = sql.index("is not distinct from n.doc_scraper_code")
    contradicted = sql.index("else 'contradicted'")
    assert same_scraper < contradicted, (
        "the same-scraper branch must precede else 'contradicted', "
        "or re-listings keep minting review items"
    )


def test_bookkeeping_branches_stay_first(captured) -> None:
    sql = _run(captured)
    same_url = sql.index("n.doc_url_hash")
    same_value = sql.index("c.field_value is not distinct from n.field_value")
    same_scraper = sql.index("is not distinct from n.doc_scraper_code")
    assert same_url < same_value < same_scraper


def test_contradicted_survives_for_cross_scraper_disagreement(captured) -> None:
    sql = _run(captured)
    assert "else 'contradicted'" in sql


def test_keeping_document_carries_its_scraper_code(captured) -> None:
    sql = _run(captured)
    assert "d.scraper_code as doc_scraper_code" in sql


def test_params_unchanged(captured) -> None:
    writer.supersede_claims(
        "source_records", "sr-1", "ev-new", ["phone_primary", "email_primary"],
        subject_key="k",
    )
    _, params = captured["cur"].executed[0]
    assert params == (
        "ev-new",
        "source_records", "sr-1", "k",
        ["phone_primary", "email_primary"], "ev-new",
    )


def test_no_fields_no_db(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(writer, "db", None)  # any touch raises AttributeError
    assert writer.supersede_claims("source_records", "sr-1", "ev-new", []) == 0
