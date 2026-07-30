"""Detecting a fetch that was answered with the homepage.

Sites retire pages by redirecting to their homepage and answering 200 rather than
404. Nothing in the response is an error, so a scraper parses the homepage, finds
nothing, and reports an empty result — and any citation it stored points at a page
that does not contain the cited fact.
"""
from __future__ import annotations

from etl.acquire.models import AcquiredDoc, Adapter, FetchStatus


def doc(url: str, final_url: str | None) -> AcquiredDoc:
    return AcquiredDoc(
        url=url,
        adapter=Adapter.FIRECRAWL,
        fetch_status=FetchStatus.OK,
        final_url=final_url,
    )


def test_the_real_inditex_redirect_is_detected():
    """Verbatim from the live fetch on 29 Jul 2026."""
    d = doc(
        "https://www.inditex.com/itxcomweb/en/sustainability/our-impact/people-in-our-supply-chain",
        "https://www.inditex.com/itxcomweb/us/en/home",
    )
    assert d.landed_on_site_root is True


def test_a_bare_root_redirect_is_detected():
    assert doc("https://x.com/a/b/c", "https://x.com/").landed_on_site_root is True
    assert doc("https://x.com/a/b/c", "https://x.com").landed_on_site_root is True


def test_a_locale_prefixed_homepage_is_detected():
    """`/us/en/home` is a homepage even though its path is not empty."""
    assert doc("https://x.com/sustainability", "https://x.com/us/en/home").landed_on_site_root is True
    assert doc("https://x.com/sustainability", "https://x.com/en-gb/index").landed_on_site_root is True


def test_an_on_target_fetch_is_not_flagged():
    url = "https://x.com/a/b/c"
    assert doc(url, url).landed_on_site_root is False


def test_a_legitimate_redirect_within_the_site_is_not_flagged():
    """Primark really does move this page, and the new page has the data.

    Flagging this would turn a working source into a failing one.
    """
    d = doc(
        "https://corporate.primark.com/en-gb/modern-slavery-act",
        "https://corporate.primark.com/en-gb/modern-slavery-statement",
    )
    assert d.landed_on_site_root is False


def test_no_redirect_information_is_not_treated_as_a_diversion():
    """Absence of `final_url` is unknown, not suspicious."""
    assert doc("https://x.com/a/b", None).landed_on_site_root is False


def test_requesting_the_homepage_itself_is_never_a_diversion():
    """A source whose target really is the homepage must not self-flag."""
    assert doc("https://x.com/", "https://x.com/").landed_on_site_root is False
    assert doc("https://x.com", "https://x.com/home").landed_on_site_root is False


def test_a_page_merely_named_home_something_is_not_a_homepage():
    """`/homeware/suppliers` contains "home" but is a real page."""
    d = doc("https://x.com/a", "https://x.com/homeware/suppliers")
    assert d.landed_on_site_root is False
