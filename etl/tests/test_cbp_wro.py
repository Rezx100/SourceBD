"""CBP Withhold Release Order listing: usability gate and empty-list refusal.

This is a forced-labor watchlist, so the failure that matters is not an error but
silence. If the page yields nothing and nothing objects, every supplier screens
clean and the absence looks identical to a genuinely empty list.
"""
from __future__ import annotations

import asyncio

import pytest
from bs4 import BeautifulSoup

from etl.scrapers.cbp_wro import CbpWroScraper, _is_data_table

# Shape of the real listing: row 0 country banner, row 1 column header, then data.
REAL_LISTING = """
<table>
  <tr><td>China</td></tr>
  <tr><th>#</th><th>Date</th><th>Merchandise</th><th>Entities</th><th>Status</th></tr>
  <tr><td>1.</td><td>01/01/2021</td><td>Cotton</td><td>Some Mill Co</td><td>Active</td></tr>
</table>
"""

# What Firecrawl actually receives now: CBP redirects the listing URL to a
# Tableau dashboard, still on cbp.gov, carrying tables that hold no entities.
TABLEAU_DASHBOARD = """
<table>
  <tr><td>Loading</td></tr>
  <tr><th>Tableau</th><th>Viz</th></tr>
  <tr><td>spinner</td><td>—</td></tr>
</table>
<table><tr><td>nav</td></tr><tr><th>a</th></tr><tr><td>b</td></tr></table>
"""


def tables(html: str) -> list:
    return BeautifulSoup(html, "lxml").find_all("table")


def test_the_real_listing_is_recognised_as_data():
    assert [_is_data_table(t) for t in tables(REAL_LISTING)] == [True]


def test_the_tableau_dashboard_is_not_mistaken_for_data():
    """The regression: the gate asked only whether `<table>` appeared anywhere.

    The dashboard has tables, so Firecrawl passed the gate, every table was then
    skipped by the parser, and the run reported zero Withhold Release Orders
    without raising.
    """
    assert "<table" in TABLEAU_DASHBOARD
    assert any(tables(TABLEAU_DASHBOARD)), "fixture must contain tables to be a real test"
    assert not any(_is_data_table(t) for t in tables(TABLEAU_DASHBOARD))


def test_a_table_too_short_to_hold_data_is_refused():
    assert not any(_is_data_table(t) for t in tables("<table><tr><td>x</td></tr></table>"))


def test_a_listing_missing_the_entities_column_is_refused():
    html = """
    <table>
      <tr><td>China</td></tr>
      <tr><th>#</th><th>Date</th><th>Merchandise</th></tr>
      <tr><td>1.</td><td>01/01/2021</td><td>Cotton</td></tr>
    </table>
    """
    assert not any(_is_data_table(t) for t in tables(html))


def test_a_readable_page_that_parses_to_nothing_is_refused(monkeypatch):
    """The guard that makes the silence audible.

    An unreadable page was already refused; a page that fetches fine and parses
    to zero rows was not, which is the same empty watchlist with no signal.
    """
    scraper = CbpWroScraper.__new__(CbpWroScraper)

    class Doc:
        citable_url = "https://www.cbp.gov/newsroom/stats/trade/wro-findings-dashboard"

        def text(self) -> str:
            return TABLEAU_DASHBOARD

    async def fake_fetch(self):
        return Doc()

    monkeypatch.setattr(CbpWroScraper, "_fetch_with_fallback", fake_fetch)

    async def run():
        return [e async for e in scraper.fetch()]

    with pytest.raises(RuntimeError, match="Refusing to report an empty"):
        asyncio.run(run())
