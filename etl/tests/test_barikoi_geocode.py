"""Barikoi geocode: an address already in the cache must never be billed again.

Rupantor costs 2 API calls per address, and the job's whole economic premise is
that each address — including one that cannot be resolved — is paid for exactly
once. That premise rests on the pending scan and the writer agreeing on what the
cache key is. These tests pin that agreement, since when it broke it broke
silently: the duplicate insert was absorbed by `on conflict do nothing` and the
run reported the re-geocode as a success.

`select_pending` is pure so this needs no database.
"""
from __future__ import annotations

from etl.jobs.barikoi_geocode import normalize_key, select_pending

# A district Bangladesh renamed, so the lexicon rewrites it. Any address in this
# file containing it is stored under a key that differs from its raw spelling.
RENAMED = "Plot 7, Industrial Area, Jessore 7400"
NOT_RENAMED = "House 12, Road 5, Banani, Dhaka 1213"


def test_the_lexicon_still_rewrites_the_address_these_tests_are_built_on():
    """Guards the regression test below from passing vacuously.

    If `jessore` were ever dropped from the lexicon, the raw and canonical keys
    would coincide and the test would still pass while testing nothing.
    """
    assert normalize_key(RENAMED) != RENAMED.strip().lower()
    assert "jashore" in normalize_key(RENAMED)


# ---- the regression ----------------------------------------------------

def test_an_address_stored_under_its_canonical_key_is_not_pending_again():
    """The bug: the writer keyed on the lexicon, the scan keyed on raw SQL.

    `_store` writes `normalize_key(address)`, so this is exactly the key that
    exists in the table after one run. Asking for it back has to return nothing,
    or the address is re-geocoded on every run for the life of the system.
    """
    cached = {normalize_key(RENAMED)}
    assert select_pending([RENAMED], cached, None) == []


def test_the_raw_spelling_is_what_makes_this_easy_to_get_wrong():
    """Documents why the old SQL missed: the two keys genuinely differ.

    The previous scan compared against `lower(regexp_replace(trim(address)…))`,
    which is this value — never written to the table by anything.
    """
    raw_key = " ".join(RENAMED.strip().lower().split())
    assert raw_key not in {normalize_key(RENAMED)}
    # And keyed that way, the address looks pending forever.
    assert select_pending([RENAMED], {raw_key}, None) == [RENAMED]


def test_an_address_with_no_rewrite_was_never_affected():
    """Most addresses were fine, which is why the leak went unnoticed."""
    assert select_pending([NOT_RENAMED], {normalize_key(NOT_RENAMED)}, None) == []


# ---- ordinary behaviour that must survive the change -------------------

def test_an_uncached_address_is_still_pending():
    assert select_pending([NOT_RENAMED], set(), None) == [NOT_RENAMED]


def test_candidate_order_is_preserved():
    """The caller sorts longest-first because specific addresses geocode better."""
    longest = "Plot 44, Sector 3, Konabari, Gazipur 1704"
    order = [longest, NOT_RENAMED, "Mirpur 10, Dhaka"]
    assert select_pending(order, set(), None) == order


def test_a_blank_address_is_skipped_rather_than_geocoded():
    assert select_pending(["   ", ""], set(), None) == []


# ---- spelling variants inside a single run -----------------------------

def test_two_spellings_of_one_address_are_geocoded_once():
    """Both map to one cache row, so the second call always paid to be discarded.

    Not the headline bug, but the same root cause: without the lexicon in the
    filter, these look like two distinct addresses.
    """
    variants = [
        "Plot 7, Industrial Area, Jessore 7400",
        "Plot 7, Industrial Area, Jashore 7400",
    ]
    assert select_pending(variants, set(), None) == [variants[0]]


def test_the_first_listed_spelling_wins():
    """Which matters because the caller orders longest-first.

    The retained raw string is what gets stored as `address_raw` and sent to
    Rupantor, so the more specific spelling should be the one that survives.
    """
    # Same address either way: the lexicon expands the `CTG` abbreviation, so
    # these two differ in length but collapse to one key.
    variants = [
        "Plot 9, Baizid Bostami Road, Chattogram 4210",
        "Plot 9, Baizid Bostami Road, CTG 4210",
    ]
    assert normalize_key(variants[0]) == normalize_key(variants[1])
    assert select_pending(variants, set(), None) == [variants[0]]


# ---- quota control -----------------------------------------------------

def test_the_limit_counts_calls_to_be_made_not_rows_examined():
    """`--limit` exists to stay inside plan quota, so it must count real calls.

    Applying it before the cache filter would let a run of mostly-cached
    addresses do almost no work while reporting it had used its budget.
    """
    cached = {normalize_key(NOT_RENAMED)}
    candidates = [NOT_RENAMED, "Mirpur 10, Dhaka 1216", "Uttara Sector 7, Dhaka"]
    assert select_pending(candidates, cached, 2) == candidates[1:]


def test_limit_none_means_everything():
    candidates = [NOT_RENAMED, "Mirpur 10, Dhaka 1216"]
    assert select_pending(candidates, set(), None) == candidates


def test_a_limit_larger_than_the_work_is_harmless():
    assert select_pending([NOT_RENAMED], set(), 50) == [NOT_RENAMED]
