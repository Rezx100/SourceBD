"""Brand disclosure link discovery.

These scrapers find a file link on a landing page they do not control. Brands
rename and re-file those documents without notice, and the failure mode is not an
error: the wrong link parses cleanly and publishes the wrong supplier list.
"""
from __future__ import annotations

from etl.core.normalize import canonical_url
from etl.scrapers.brand_disclosures import (
    _is_next_tier1,
    _next_header_map,
    _next_t1_year,
    _url_filename,
)

NEXT = "https://www.nextplc.co.uk"

# Verbatim from the live page on 29 Jul 2026. The folder name is the trap: it
# contains "Tier 1", so every file below looks like a tier 1 list to any test
# that reads the whole URL instead of the filename.
FOLDER = "/~/media/Files/N/next-plc-v4/Tier 1 -2 - 3 lists"
TIER1_2026 = f"{NEXT}{FOLDER}/PLC LIST FEB 2026 - TIER1.pdf"
TIER2_2026 = f"{NEXT}{FOLDER}/PLC LIST FEB 2026 - TIER 2.pdf"
TIER3_2026 = f"{NEXT}{FOLDER}/2026 01 30 Tier 3 - Jan 25 to Dec 25.pdf"
TIER1_2024 = f"{NEXT}/~/media/Files/N/Next-PLC-V2/TIER 1 PLC LIST AUGUST 2024.pdf"
TIER1_OLD = f"{NEXT}/~/media/Files/N/Next-PLC-V2/T1 - CO SEC - AW23 - SS24.pdf"
GENDER_PAY = f"{NEXT}/~/media/Files/N/next-plc-v4/documents/2026/NEXT-Gender-Pay-Gap-Report-2025.pdf"


# ---- tier selection -----------------------------------------------------

def test_the_current_tier1_list_is_recognised():
    """Regression: the pattern required `T1 2026.pdf` and Next now ships
    `PLC LIST FEB 2026 - TIER1.pdf`, so tier 1 stopped being found at all."""
    assert _is_next_tier1(TIER1_2026) is True


def test_older_tier1_namings_still_match():
    """Next has used at least three conventions; none should silently drop."""
    assert _is_next_tier1(TIER1_2024) is True
    assert _is_next_tier1(TIER1_OLD) is True
    assert _is_next_tier1(f"{NEXT}/T1 2025.pdf") is True


def test_tier2_and_tier3_are_refused():
    """The important negative. T2/T3 are downstream subcontractors; publishing
    them as tier 1 would assert a direct manufacturing relationship that does
    not exist, on every factory in the file."""
    assert _is_next_tier1(TIER2_2026) is False
    assert _is_next_tier1(TIER3_2026) is False


def test_the_folder_name_does_not_make_every_file_tier1():
    """`Tier 1 -2 - 3 lists` is a directory, not a claim about the file."""
    assert FOLDER.count("Tier 1") == 1, "fixture no longer covers the trap"
    assert _is_next_tier1(TIER2_2026) is False


def test_unrelated_pdfs_on_the_page_are_refused():
    assert _is_next_tier1(GENDER_PAY) is False


def test_the_newest_tier1_list_sorts_first():
    urls = [TIER1_OLD, TIER1_2024, TIER1_2026]
    assert max(urls, key=_next_t1_year) == TIER1_2026


def test_a_filename_without_a_year_sorts_last_rather_than_raising():
    assert _next_t1_year(TIER1_OLD) == 0


# ---- URL encoding parity ------------------------------------------------

def test_tier_detection_survives_percent_encoding():
    """Both transports must agree on which file is tier 1.

    Read directly the space in these filenames arrives literally; canonicalised
    it arrives as `%20`, which ends in a digit and so breaks a word-boundary
    test at exactly the point where the tier is named.
    """
    assert _is_next_tier1(canonical_url(TIER1_2026)) is True
    assert _is_next_tier1(canonical_url(TIER2_2026)) is False


def test_the_year_is_not_read_out_of_the_encoding():
    """`%202026` contains the digits 2020, so an undecoded search finds a year
    that is not in the filename and would pick the wrong list as newest."""
    assert _next_t1_year(canonical_url(TIER1_2026)) == 2026


def test_url_filename_decodes_and_takes_only_the_last_segment():
    assert _url_filename(canonical_url(TIER1_2026)) == "PLC LIST FEB 2026 - TIER1.pdf"


# ---- Next PDF column layout ---------------------------------------------

# Verbatim from the Feb 2026 PDF, including the clipped committee title and the
# trailing padding cells pdfplumber emits.
HEADER_2026 = [
    "", "Site Id", "Country", "SUPPLIER NAME", "MANUFACTURING SITE NAME",
    "ADDRESS", "PRODUCT TYPE", "FEMALE EMPLOYEES", "MALE EMPLOYEES",
    "TRADE UNION IN FACTORY", "FREELY ELECTED WORKERS COM",
    "", "", "", "", "", "", "", "", "", "", "", "", "", "",
]

# The older layout: no Country column, and everything two places to the left.
HEADER_LEGACY = [
    "SUPPLIER NAME", "MANUFACTURING SITE NAME", "ADDRESS", "PRODUCT TYPE",
    "FEMALE EMPLOYEES", "MALE EMPLOYEES", "TRADE UNION IN FACTORY",
    "FREELY ELECTED WORKERS COMMITTEE",
]

DATA_ROW_2026 = [
    "", "17134", "Bangladesh", "Affiliated Apparel Ltd", "Aptech Caswier Ltd",
    "Aptech Industrial Park Holding 30", "APPAREL", "1,604", "1,310", "No", "Yes",
]

TITLE_ROW = ["", "", "", "TIER 1 MANUFACTURING SITES", None, None, None]


def test_the_2026_header_is_mapped_by_name_not_position():
    """Regression: columns were read positionally and Next shifted them all.

    The new file inserts Site Id and Country ahead of SUPPLIER NAME, so the old
    offsets read the site id as the supplier and found no country anywhere. The
    result was zero rows rather than an error.
    """
    cols = _next_header_map(HEADER_2026)
    assert cols is not None
    assert cols["supplier_vendor"] == 3
    assert cols["factory_name"] == 4
    assert cols["country"] == 2
    assert cols["address"] == 5


def test_the_clipped_committee_column_is_still_matched():
    """PDF column widths truncate the title to "FREELY ELECTED WORKERS COM"."""
    cols = _next_header_map(HEADER_2026)
    assert cols is not None and cols["workers_committee"] == 10


def test_the_legacy_header_still_maps():
    """Older files remain in circulation and must not regress."""
    cols = _next_header_map(HEADER_LEGACY)
    assert cols is not None
    assert cols["supplier_vendor"] == 0
    assert cols["factory_name"] == 1
    assert "country" not in cols, "the old layout has no country column"


def test_a_data_row_is_not_mistaken_for_a_header():
    assert _next_header_map(DATA_ROW_2026) is None


def test_the_title_row_is_not_mistaken_for_a_header():
    assert _next_header_map(TITLE_ROW) is None


def test_an_empty_row_is_not_a_header():
    assert _next_header_map(["", "", None, ""]) is None


# ---- canonical_url ------------------------------------------------------

def test_a_literal_space_is_encoded():
    """H&M publishes `...May-2026 .xlsx`, with the space really in the name.
    Direct returns it raw and Firecrawl returns it encoded, so the citation we
    store depended on the transport until both were canonicalised."""
    assert canonical_url("https://h.co/a/List-May-2026 .xlsx") == (
        "https://h.co/a/List-May-2026%20.xlsx"
    )


def test_an_already_encoded_url_is_left_alone():
    """Double-encoding would turn a working %20 into a broken %2520."""
    url = "https://h.co/a/List-May-2026%20.xlsx"
    assert canonical_url(url) == url


def test_canonicalising_is_idempotent():
    once = canonical_url("https://h.co/a/List-May-2026 .xlsx")
    assert canonical_url(once) == once


def test_both_transport_spellings_converge_on_one_citation():
    """The actual parity failure: same file, two source_urls."""
    direct = "https://hmgroup.com/wp-content/uploads/spur/HM-Group-Supplier-List-May-2026 .xlsx"
    firecrawl = "https://hmgroup.com/wp-content/uploads/spur/HM-Group-Supplier-List-May-2026%20.xlsx"
    assert canonical_url(direct) == canonical_url(firecrawl)


def test_query_and_fragment_are_preserved():
    url = "https://h.co/f.pdf?v=2&t=1#page3"
    assert canonical_url(url) == url
