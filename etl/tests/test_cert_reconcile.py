"""ETL freshness S2: certificates a body stops listing (etl/core/cert_reconcile.py),
the list-row gate (etl/core/listgate.py) and the OEKO-TEX keys."""
from __future__ import annotations

import json
from typing import Any

import pytest

from etl.core import cert_reconcile as cr
from etl.core import listgate
from etl.core.scraper import ScrapedRecord
from etl.tests.conftest import FakeConn, FakeDb


class Cur:
    def __init__(self, certs: list[dict], reconciled_before: bool = True,
                 stored: list[dict] | None = None) -> None:
        self.certs = certs
        self.reconciled_before = reconciled_before
        self.stored = stored or []
        self.executed: list[tuple[str, Any]] = []
        self._sql = ""

    def execute(self, sql: str, params: Any = None) -> None:
        self._sql = sql
        self.executed.append((sql, params))

    def fetchall(self) -> list[dict]:
        if "from public.certifications c" in self._sql:
            return list(self.certs)
        if "returning (flipped_by_run_id" in self._sql:
            return []
        if "from public.source_records" in self._sql:
            return list(self.stored)
        return []

    def fetchone(self) -> dict | None:
        if "from public.etl_runs" in self._sql:
            return {"done": self.reconciled_before}
        return None

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def _certs(n: int, listed: bool = True) -> list[dict]:
    return [{"id": f"c{i}", "certificate_no": f"N{i}", "slug": f"s{i}",
             "listing_status": "listed" if listed else "no_longer_listed"} for i in range(n)]


@pytest.fixture
def run(monkeypatch):
    posts: list[str] = []
    monkeypatch.setattr(cr, "slack", posts.append)

    def _run(cur: Cur, seen: set[str], *, complete: bool = True, accept: bool = False):
        monkeypatch.setattr(cr, "db", FakeDb(FakeConn(cur)))
        out = cr.reconcile_certificates(kind="gots", scraper_code="gots", run_id="r1",
                                        seen_cert_nos=seen, read_complete=complete, accept=accept)
        return out, posts
    return _run


def _sqls(cur: Cur, needle: str) -> list[Any]:
    return [p for s, p in cur.executed if needle in s]


def test_one_missing_of_a_hundred_is_marked(run):
    cur = Cur(_certs(100))
    out, _ = run(cur, {f"N{i}" for i in range(99)})
    assert out["action"] == "reconcile" and out["delisted"] == 1
    assert _sqls(cur, "set listing_status = 'no_longer_listed'")[0][1] == ["c99"]


def test_the_first_read_of_a_scheme_is_held_for_the_founder(run):
    cur = Cur(_certs(100), reconciled_before=False)
    out, posts = run(cur, {f"N{i}" for i in range(99)})
    assert out["action"] == "held" and out["first_read"] is True
    assert out["missing_certificates"] == ["s99:N99"]
    assert not _sqls(cur, "set listing_status = 'no_longer_listed'")
    assert _sqls(cur, "set last_seen_at = now()"), "the read itself still counts"
    assert "--accept-delistings" in posts[0]


def test_too_many_missing_is_held(run):
    cur = Cur(_certs(100))
    out, _ = run(cur, {f"N{i}" for i in range(90)})
    assert out["action"] == "held"
    assert not _sqls(cur, "set listing_status = 'no_longer_listed'")


def test_a_read_that_stopped_early_marks_and_stamps_nothing(run):
    cur = Cur(_certs(100))
    out, _ = run(cur, {f"N{i}" for i in range(99)}, complete=False)
    assert out["action"] == "partial"
    assert not _sqls(cur, "set last_seen_at")
    meta = _sqls(cur, "update public.etl_runs")[0]
    assert json.loads(meta[1])["action"] == "partial"


def test_founder_release_marks_a_held_first_read(run):
    cur = Cur(_certs(100), reconciled_before=False)
    out, _ = run(cur, {f"N{i}" for i in range(90)}, accept=True)
    assert out["action"] == "reconcile" and out["delisted"] == 10


def test_listgate_reuses_the_stored_record_only_when_the_row_is_unchanged(monkeypatch):
    h = listgate.list_row_hash({"idx": "1", "name": "A"})
    stored = [{"supplier_id": "s", "fields": {"oeko_list_hash": h, "x": 1}, "raw_hash": "H"}]
    monkeypatch.setattr(listgate, "db", FakeDb(FakeConn(Cur([], stored=stored))))
    monkeypatch.setattr(listgate, "get_source_id", lambda code: "src")
    rec = listgate.unchanged_record(source_code="OEKO_TEX", source_ref="oeko-tex-1:100",
                                    company_name="A", key="oeko_list_hash", list_hash=h)
    assert rec is not None and rec.hash() == "H" and rec.payload["x"] == 1
    assert listgate.unchanged_record(source_code="OEKO_TEX", source_ref="r", company_name="A",
                                     key="oeko_list_hash", list_hash="other") is None
    assert listgate.unchanged_record(source_code="OEKO_TEX", source_ref="r", company_name="A",
                                     key="oeko_list_hash", list_hash=h,
                                     still_good=lambda f: False) is None


def test_known_hash_stands_in_for_the_payload_hash():
    rec = ScrapedRecord(source_code="X", source_ref="r", company_name="A", payload={"a": 1})
    assert rec.hash() != "H"
    assert ScrapedRecord(source_code="X", source_ref="r", company_name="A",
                         payload={"a": 1}, known_hash="H").hash() == "H"


def test_gots_reads_the_detail_near_expiry():
    from datetime import date, timedelta

    from etl.scrapers.gots import _far_from_expiry

    assert _far_from_expiry({"expires_on": (date.today() + timedelta(days=200)).isoformat()})
    assert not _far_from_expiry({"expires_on": (date.today() + timedelta(days=10)).isoformat()})
    assert not _far_from_expiry({"expires_on": None})


def test_sanctions_and_certificates_share_one_reconcile_rule():
    from etl.core import breaker, sanctions

    assert sanctions.plan_reconcile is breaker.plan_reconcile
