"""ETL freshness S4: stop the waste (spec-etl-freshness §4.8, §5)."""
from __future__ import annotations

from typing import Any

import pytest

from etl.acquire import AcquireRequest
from etl.core import acquiring
from etl.core.acquiring import CreditBudgetExceeded
from etl.jobs import scraper_queue as sq
from etl.scrapers.registry import SCRAPERS


def test_every_firecrawl_source_has_a_per_run_ceiling():
    missing = [code for code, cls in SCRAPERS.items()
               if getattr(cls, "transport", None) == "firecrawl"
               and not getattr(cls, "max_credits_per_run", None)]
    assert missing == []
    assert SCRAPERS["bgmea_web"].max_credits_per_run == 450  # §2 ~300 × 1.5


def test_the_founder_can_raise_one_runs_limit(monkeypatch):
    from typer.testing import CliRunner

    from etl.cli import app

    got: dict[str, Any] = {}

    async def fake_run(self):
        got["cap"] = self.credit_ceiling
        return {}

    monkeypatch.setattr(SCRAPERS["bkmea_detail"], "run", fake_run)
    monkeypatch.setattr(acquiring.settings, "firecrawl_max_credits_per_run", 0)
    result = CliRunner().invoke(app, ["run", "bkmea_detail", "--max-credits", "3000"])
    assert result.exit_code == 0, result.output
    assert got["cap"] == 3000


def _firecrawl_scraper(monkeypatch, month_spent: int):
    cls = SCRAPERS["uflpa"]
    s = cls()
    monkeypatch.setattr(type(s), "active_transport", property(lambda self: "firecrawl"))
    monkeypatch.setattr(acquiring, "_credits_this_month", lambda: month_spent)
    return s


def test_the_monthly_ceiling_stops_a_firecrawl_fetch(monkeypatch):
    posts: list[str] = []
    monkeypatch.setattr("etl.core.notify.slack", posts.append)
    s = _firecrawl_scraper(monkeypatch, 1500)
    with pytest.raises(CreditBudgetExceeded, match="1500 ceiling"):
        s._check_budget([AcquireRequest(url="https://example.org/a")])
    assert posts and "ceiling" in posts[0]


def test_under_the_monthly_ceiling_it_fetches(monkeypatch):
    s = _firecrawl_scraper(monkeypatch, 100)
    s._check_budget([AcquireRequest(url="https://example.org/a")])  # no raise
    assert s._month_spent == 100


@pytest.mark.parametrize(("code", "upserted", "expected"), [
    ("bkmea_web", 3, [("sbi_recompute", 24)]),
    ("rsc", 2, [("rsc_documents", None), ("sbi_recompute", 24)]),
    ("rsc", 0, []),
    ("ofac_sdn", 9, []),            # a sanctions list changes no company row
    ("sbi_recompute", 5, []),       # a job never chains itself
])
def test_follow_ups_only_after_real_changes(code: str, upserted: int, expected: list[Any]):
    assert sq._follow_ups(code, {"upserted": upserted}) == expected


def test_the_verifier_unattended_only_reads_overdue_sources(monkeypatch):
    from etl.evidence import verifier

    seen: list[tuple[str, Any]] = []

    class Cur:
        def execute(self, sql, params=None):
            seen.append((sql, params))

        def fetchall(self):
            return []

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    class Conn(Cur):
        def cursor(self):
            return Cur()

    class Db:
        def conn(self):
            return Conn()

    monkeypatch.setattr(verifier, "db", Db())
    verifier._select_due(50)
    assert "max_age_hours" in seen[-1][0]
    verifier._select_due(50, scraper_code="rsc")
    assert "max_age_hours" not in seen[-1][0], "an operator naming a scraper gets all of it"
    assert verifier.VerifyEvidenceJob().limit == 50
