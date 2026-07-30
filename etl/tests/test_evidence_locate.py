"""Unit tests for the evidence locator/excerpt helpers.

These functions decide whether a citation is still valid, so their failure
modes matter more than usual: a false "still there" silently launders a stale
fact, and a false "gone" floods the admin worklist with noise.
"""
from __future__ import annotations

from etl.acquire.models import AcquiredDoc, Adapter, FetchStatus, classify_firecrawl_error
from etl.evidence.locate import (
    api_locator,
    document_text,
    excerpt_contains,
    iter_claimable,
    json_locator,
    looks_like_html,
    make_excerpt,
    normalise_for_match,
    pdf_locator,
    row_locator,
    strip_tags,
    value_hash,
    value_variants,
)

HTML = """
<table class="members">
  <tr><td>13</td><td>Acme Apparels Ltd.</td><td>Employees: 1,240</td></tr>
  <tr><td>14</td><td>Beta Knitwear Ltd.</td><td>Employees: 860</td></tr>
</table>
"""


# ---- make_excerpt -------------------------------------------------------

def test_excerpt_captures_value_in_context():
    ex = make_excerpt(HTML, "Beta Knitwear Ltd.")
    assert ex is not None
    assert "Beta Knitwear Ltd." in ex
    # Surrounding context is what makes it verifiable later.
    assert "860" in ex or "14" in ex


def test_excerpt_is_none_when_value_absent():
    assert make_excerpt(HTML, "Gamma Textiles Ltd.") is None


def test_excerpt_none_for_empty_value():
    assert make_excerpt(HTML, "") is None
    assert make_excerpt(HTML, None) is None


def test_excerpt_none_for_missing_haystack():
    assert make_excerpt(None, "Acme") is None


def test_excerpt_is_length_capped():
    long_doc = "x" * 5000 + "TARGET" + "y" * 5000
    ex = make_excerpt(long_doc, "TARGET")
    assert ex is not None
    assert len(ex) <= 320


def test_excerpt_matches_case_insensitively():
    ex = make_excerpt("Company: ACME APPARELS LTD", "Acme Apparels Ltd")
    assert ex is not None


def test_excerpt_collapses_whitespace_in_source():
    ex = make_excerpt("name:\n\n   Acme   Apparels\t Ltd", "Acme Apparels Ltd")
    assert ex is not None


# ---- excerpt_contains ---------------------------------------------------

def test_contains_exact_match():
    ex = make_excerpt(HTML, "Beta Knitwear Ltd.")
    assert excerpt_contains(ex, HTML) is True


def test_contains_survives_markup_reflow():
    # Same facts, different markup. This must NOT be reported as drift.
    reflowed = HTML.replace("<td>", "<td class='c'>\n  ").replace("</td>", "\n</td>")
    ex = make_excerpt(HTML, "Beta Knitwear Ltd.")
    assert excerpt_contains(ex, reflowed) is True


def test_contains_detects_changed_value():
    ex = make_excerpt(HTML, "Employees: 860")
    changed = HTML.replace("Employees: 860", "Employees: 25")
    assert excerpt_contains(ex, changed) is False


def test_contains_detects_changed_value_even_with_value_anchor():
    # The value anchor must never rescue a claim whose value is gone.
    ex = make_excerpt(HTML, "Employees: 860")
    changed = HTML.replace("Employees: 860", "Employees: 25")
    assert excerpt_contains(ex, changed, value="Employees: 860") is False


def test_value_anchor_tolerates_neighbouring_row_change():
    # Our row is untouched; the row above it changed. Still a valid citation.
    ex = make_excerpt(HTML, "Employees: 860")
    neighbour_changed = HTML.replace("Acme Apparels Ltd.", "Acme Apparels PLC (renamed)")
    assert excerpt_contains(ex, neighbour_changed, value="Employees: 860") is True


def test_value_anchor_requires_context_not_just_the_number():
    # "860" alone appearing in unrelated content must not confirm the claim.
    ex = make_excerpt(HTML, "Employees: 860")
    unrelated = "<p>Order reference 860 shipped.</p>"
    assert excerpt_contains(ex, unrelated, value="860") is False


def test_value_anchor_returns_false_when_excerpt_and_value_disagree():
    assert excerpt_contains("…some other text…", HTML, value="Employees: 860") is False


def test_contains_detects_removed_row():
    ex = make_excerpt(HTML, "Beta Knitwear Ltd.")
    removed = HTML.replace(
        "<tr><td>14</td><td>Beta Knitwear Ltd.</td><td>Employees: 860</td></tr>", ""
    )
    assert excerpt_contains(ex, removed) is False


def test_contains_false_for_empty_inputs():
    assert excerpt_contains(None, HTML) is False
    assert excerpt_contains("", HTML) is False
    assert excerpt_contains("anything", None) is False
    assert excerpt_contains("anything", "") is False


def test_contains_ignores_ellipsis_markers():
    ex = "…Beta Knitwear Ltd.…"
    assert excerpt_contains(ex, HTML) is True


# ---- normalise / strip --------------------------------------------------

def test_normalise_collapses_and_folds():
    assert normalise_for_match("  Acme   APPAREL\n Ltd ") == "acme apparel ltd"


def test_normalise_keeps_digits_so_numeric_drift_is_caught():
    assert "860" in normalise_for_match("Employees: 860")


def test_strip_tags_removes_markup_only():
    assert "Acme Apparels Ltd." in strip_tags("<td><b>Acme Apparels Ltd.</b></td>")
    assert "<" not in strip_tags(HTML)


def test_strip_tags_drops_script_and_style_bodies():
    html = "<style>.a{color:red}</style><p>Acme</p><script>var x=1;</script>"
    out = strip_tags(html)
    assert "Acme" in out
    assert "color:red" not in out
    assert "var x" not in out


def test_excerpt_contains_no_markup():
    ex = make_excerpt(HTML, "Beta Knitwear Ltd.")
    assert ex is not None
    assert "<td>" not in ex and "</tr>" not in ex


def test_document_text_passes_through_plain_text():
    assert document_text("Employees: 860") == "Employees: 860"


def test_looks_like_html_detection():
    assert looks_like_html("<div>hi</div>") is True
    assert looks_like_html("a < b and c > d") is False


# ---- locators -----------------------------------------------------------

def test_row_locator_shape():
    assert row_locator("table.members", 14, 3) == "table.members row=14 col=3"
    assert row_locator("table.members", 14) == "table.members row=14"


def test_pdf_locator_shape():
    assert pdf_locator(7) == "pdf:page=7"
    assert pdf_locator(7, "Acme").startswith("pdf:page=7 near=Acme")


def test_json_locator_normalises_leading_slash():
    assert json_locator("items/3/name") == "json:/items/3/name"
    assert json_locator("/items/3/name") == "json:/items/3/name"


def test_api_locator_converts_dots():
    assert api_locator("data.items.0.name") == "json:/data/items/0/name"


# ---- claim flattening ---------------------------------------------------

def test_iter_claimable_keeps_scalars_and_drops_empties():
    pairs = dict(
        iter_claimable(
            {
                "company_name": "Acme",
                "employees": 1240,
                "verified": True,
                "empty": "",
                "missing": None,
                "nothing": [],
            }
        )
    )
    assert pairs == {"company_name": "Acme", "employees": 1240, "verified": True}


def test_iter_claimable_expands_one_dict_level():
    pairs = dict(iter_claimable({"contact": {"email": "a@b.com", "phone": None}}))
    assert pairs == {"contact.email": "a@b.com"}


def test_iter_claimable_skips_requested_keys():
    pairs = dict(iter_claimable({"a": 1, "raw": "big blob"}, skip={"raw"}))
    assert pairs == {"a": 1}


def test_iter_claimable_ignores_lists():
    pairs = dict(iter_claimable({"products": ["tee", "polo"], "name": "Acme"}))
    assert pairs == {"name": "Acme"}


def test_value_hash_is_stable_and_distinguishing():
    assert value_hash("Acme") == value_hash("Acme")
    assert value_hash("Acme") != value_hash("Acme ")


# ---- normalised-value renderings ---------------------------------------

def test_variants_cover_thousands_separator_for_ints():
    assert value_variants(1240) == ["1240", "1,240"]


def test_variants_cover_bare_form_for_separated_strings():
    assert "1240" in value_variants("1,240")


def test_variants_cover_booleans_as_published():
    assert value_variants(True) == ["True", "yes", "true"]


def test_variants_leave_plain_strings_alone():
    assert value_variants("Acme Apparels Ltd.") == ["Acme Apparels Ltd."]


def test_parsed_int_is_locatable_in_separated_source():
    # The parser stores 1240; the page prints "1,240". Without variant matching
    # this claim would be permanently unverifiable.
    ex = make_excerpt("<td>No of Machines</td><td>1,240</td>", 1240)
    assert ex is not None
    assert "1,240" in ex


def test_parsed_int_reverifies_against_separated_source():
    src = "<td>No of Machines</td><td>1,240</td>"
    ex = make_excerpt(src, 1240)
    assert excerpt_contains(ex, src, value=1240) is True


def test_parsed_int_drift_still_detected():
    src = "<td>No of Machines</td><td>1,240</td>"
    ex = make_excerpt(src, 1240)
    changed = "<td>No of Machines</td><td>310</td>"
    assert excerpt_contains(ex, changed, value=1240) is False


# ---- AcquiredDoc semantics ---------------------------------------------

def test_doc_hash_is_stable_for_same_content():
    a = AcquiredDoc(url="u", adapter=Adapter.FIRECRAWL, fetch_status=FetchStatus.OK, raw_html="<p>x</p>")
    b = AcquiredDoc(url="u", adapter=Adapter.FIRECRAWL, fetch_status=FetchStatus.OK, raw_html="<p>x</p>")
    assert a.content_sha256 == b.content_sha256


def test_doc_hash_changes_with_content():
    a = AcquiredDoc(url="u", adapter=Adapter.DIRECT, fetch_status=FetchStatus.OK, raw_html="<p>x</p>")
    b = AcquiredDoc(url="u", adapter=Adapter.DIRECT, fetch_status=FetchStatus.OK, raw_html="<p>y</p>")
    assert a.content_sha256 != b.content_sha256


def test_citable_url_prefers_final_url():
    doc = AcquiredDoc(
        url="http://a.test/x",
        final_url="https://a.test/x/",
        adapter=Adapter.FIRECRAWL,
        fetch_status=FetchStatus.OK,
    )
    assert doc.citable_url == "https://a.test/x/"


def test_citable_url_falls_back_to_requested_url():
    doc = AcquiredDoc(url="http://a.test/x", adapter=Adapter.DIRECT, fetch_status=FetchStatus.OK)
    assert doc.citable_url == "http://a.test/x"


def test_transient_failures_are_distinguished_from_not_found():
    # This distinction is the whole REZ-30 lesson: a dropped request must not
    # be recorded as an established absence.
    timeout = AcquiredDoc(url="u", adapter=Adapter.FIRECRAWL, fetch_status=FetchStatus.TIMEOUT)
    gone = AcquiredDoc(url="u", adapter=Adapter.FIRECRAWL, fetch_status=FetchStatus.NOT_FOUND)
    assert timeout.transient_failure is True
    assert gone.transient_failure is False
    assert timeout.ok is False and gone.ok is False


def test_firecrawl_timeout_classifies_as_timeout_not_error():
    assert classify_firecrawl_error("SCRAPE_TIMEOUT", None) is FetchStatus.TIMEOUT


def test_firecrawl_404_classifies_as_not_found():
    assert classify_firecrawl_error(None, 404) is FetchStatus.NOT_FOUND


def test_firecrawl_403_classifies_as_blocked():
    assert classify_firecrawl_error(None, 403) is FetchStatus.BLOCKED


def test_firecrawl_5xx_is_error_not_not_found():
    assert classify_firecrawl_error(None, 503) is FetchStatus.ERROR
