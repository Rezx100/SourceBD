"""Certificate bodies re-read after a feed change (10 Oct 2026).

WRAP moved to a new feed and OEKO-TEX re-keyed its rows, so every stored raw
copy differs from a fresh read while nothing a buyer sees has moved. Both 8 Oct
runs stopped themselves at the 5% change limit after 21 and 265 records. A
record whose shown values match the stored copy is a 'refresh'; a real change
still counts.
"""
from __future__ import annotations

from etl.core import breaker as br
from etl.core.scraper import ScrapedRecord
from etl.core.upsert import classify_record
from etl.scrapers.wrap import WRAP_LIST_URL, _bangladesh_facilities, _carry_grade
from etl.tests.conftest import FakeCursor

SHOWN = ("wrap_id", "expires_on", "wrap_products")


def _rec(**payload) -> ScrapedRecord:
    return ScrapedRecord(source_code="WRAP", source_ref="wrap-7865", company_name="Aboni",
                         payload=payload, shown_keys=SHOWN)


def _stored(fields: dict) -> FakeCursor:
    return FakeCursor(skip_rows=[{"supplier_id": "s1", "raw_hash": "old", "fields": fields}])


STORED = {"wrap_id": "7865", "expires_on": "2027-08-25", "wrap_products": "Knitted Garments",
          "wrap_cert_type": "Gold", "wrap_country": "Bangladesh",
          "wrap_profile_url": "https://wrapcompliance.org/certified-facility/7865/"}


def test_format_only_difference_is_a_refresh(monkeypatch):
    monkeypatch.setattr("etl.core.upsert.get_source_id", lambda code: "src")
    rec = _rec(wrap_id="7865", expires_on="2027-08-25", wrap_products=" Knitted Garments ",
               wrap_country="BD", wrap_profile_url=WRAP_LIST_URL)
    assert classify_record(_stored(STORED), rec) == "refresh"


def test_a_shown_change_still_counts(monkeypatch):
    monkeypatch.setattr("etl.core.upsert.get_source_id", lambda code: "src")
    rec = _rec(wrap_id="7865", expires_on="2028-08-25", wrap_products="Knitted Garments")
    assert classify_record(_stored(STORED), rec) == "changed"
    # A record without shown keys keeps the old whole-payload rule.
    bare = ScrapedRecord(source_code="WRAP", source_ref="wrap-7865", company_name="Aboni",
                         payload={"wrap_id": "7865", "expires_on": "2027-08-25",
                                  "wrap_products": "Knitted Garments"})
    assert classify_record(_stored(STORED), bare) == "changed"


def test_refresh_never_trips_the_breaker():
    b = br.Breaker(stored=434)
    assert all(b.admit("refresh") for _ in range(434))
    assert b.tripped is None and b.changed == 0


def test_wrap_grade_kept_for_the_same_certificate_period():
    scope = "Industries: Apparel | Products: Knitted Garments"
    old = "Gold | Industries: Apparel | Products: Knitted Garments"
    assert _carry_grade(scope, old, "2027-08-25", "2027-08-25") == f"Gold | {scope}"
    # Renewed: the old grade is not known to hold, so it is dropped.
    assert _carry_grade(scope, old, "2027-08-25", "2028-08-25") == scope
    # "Apparel" is not a grade; a scope that has one keeps its own.
    assert _carry_grade(scope, "Apparel", "2027-08-25", "2027-08-25") == scope
    assert _carry_grade("Platinum | x", old, "2027-08-25", "2027-08-25") == "Platinum | x"


def test_wrap_link_is_not_the_dead_facility_page():
    assert "certified-facility" not in WRAP_LIST_URL


def test_wrap_reads_only_certified_rows():
    rows = _bangladesh_facilities({"facilities": [
        {"country": "BD", "wrap_id": "1", "certification_status": "certified"},
        {"country": "BD", "wrap_id": "2", "certification_status": "expired"},
        {"country": "BD", "wrap_id": "3"},
    ]})
    assert [r["wrap_id"] for r in rows] == ["1", "3"]


def test_wrap_certificate_write_keeps_the_stored_grade(monkeypatch):
    """The DB path: the grade comes from the stored certificate row."""
    from contextlib import contextmanager
    from datetime import date

    import etl.scrapers.wrap as wrap

    class Cur:
        def __init__(self):
            self.sql, self.writes = "", []
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def execute(self, sql, params=None):
            self.sql = sql
            if "insert into public.certifications" in sql:
                self.writes.append(params)
        def fetchone(self):
            if "from public.certifications" in self.sql:
                return {"scope": "Gold | Industries: Apparel", "expires_on": date(2027, 8, 25)}
            return {"id": "sr1"}

    cur = Cur()

    class Conn:
        def cursor(self): return cur
        def commit(self): pass

    @contextmanager
    def conn():
        yield Conn()

    monkeypatch.setattr(wrap.db, "conn", conn)
    monkeypatch.setattr(wrap, "get_source_id", lambda code: "src")
    rec = _rec(wrap_id="7865", expires_on="2027-08-25", wrap_industries="Apparel",
               wrap_profile_url=WRAP_LIST_URL)
    wrap._write_certification("s1", rec)
    scope, url = cur.writes[0][5], cur.writes[0][7]
    assert scope == "Gold | Industries: Apparel"
    assert url == WRAP_LIST_URL


def test_queue_release_only_from_a_service_key_job():
    from etl.jobs.scraper_queue import _release_flags

    meta = {"accept_changes": True, "accept_delistings": True}
    assert _release_flags({"requested_by": None, "metadata": meta}) == meta
    # The Needs-you button: an admin may release; anyone else may not.
    assert _release_flags({"requested_by": "u1", "requester_role": "admin", "metadata": meta}) == meta
    for role in ("buyer", "supplier", None):
        assert _release_flags({"requested_by": "u1", "requester_role": role, "metadata": meta}) == {
            "accept_changes": False, "accept_delistings": False}
    assert _release_flags({"requested_by": None, "metadata": {"accept_changes": "yes"}}) == {
        "accept_changes": False, "accept_delistings": False}


def test_queued_release_reaches_the_scraper(monkeypatch):
    import etl.jobs.scraper_queue as sq

    seen = {}

    class Fake:
        accept_changes = False
        accept_delistings = False
        progress_callback = None
        last_run_id = None

        async def run(self):
            seen.update(changes=self.accept_changes, delistings=self.accept_delistings)
            return {"upserted": 0}

    monkeypatch.setitem(sq.RUNNABLE, "fake", Fake)
    monkeypatch.setattr(sq, "_mark_success", lambda *a: None)
    sq._run_job({"id": "j1", "scraper_code": "fake", "accept_changes": True,
                 "accept_delistings": True})
    assert seen == {"changes": True, "delistings": True}


def test_long_reads_send_a_heartbeat(monkeypatch):
    """A run with no progress events of its own (OEKO-TEX, GOTS, RSC, brands) was
    reaped as dead after 3 hours while still writing. gated() beats for all."""
    import asyncio
    from contextlib import contextmanager

    import etl.core.scraper as sc
    import etl.core.upsert as up

    class Cur:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def execute(self, *a): pass
        def fetchone(self): return {"n": 1000}

    class Conn:
        def cursor(self): return Cur()
        def rollback(self): pass

    @contextmanager
    def conn():
        yield Conn()

    monkeypatch.setattr(sc.db, "conn", conn)
    monkeypatch.setattr(sc, "get_source_id", lambda code: "src")
    monkeypatch.setattr(up, "classify_record", lambda cur, rec: "unchanged")

    class Fake(sc.BaseScraper):
        code = "fake"

        async def fetch(self):
            for i in range(60):
                yield ScrapedRecord(source_code="WRAP", source_ref=f"r{i}", company_name="A")

    events = []
    s = Fake()
    s.progress_callback = events.append

    async def drain():
        return [r async for r in s.gated()]

    assert len(asyncio.run(drain())) == 60
    assert [e["records_seen"] for e in events] == [25, 50]
    assert all(e["event_type"] == "heartbeat" for e in events)


def test_heartbeat_only_touches_the_heartbeat(monkeypatch):
    from contextlib import contextmanager

    import etl.jobs.scraper_queue as sq

    sqls = []

    class Cur:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def execute(self, sql, params=None): sqls.append(sql)

    class Conn:
        def cursor(self): return Cur()
        def commit(self): pass

    @contextmanager
    def conn():
        yield Conn()

    monkeypatch.setattr(sq.db, "conn", conn)
    sq._record_progress_event("j1", {"event_type": "heartbeat", "message": "Read 25 records so far."})
    assert len(sqls) == 1
    assert "heartbeat_at = now()" in sqls[0] and "progress_seen" not in sqls[0]
