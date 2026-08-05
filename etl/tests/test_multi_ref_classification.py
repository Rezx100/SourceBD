"""Pins for the REZ-90 multi-member-ref classification rules.

The REZ-88 detector is correct and untouched; only the classification of the
230 excess refs was rejected. Three rules are pinned here, each against the
exact production strings that broke the rejected plan:

1. Merge is decided by root tokens, never by a similarity score. Every false
   merge scored 89-96, higher than several correct ones.
2. The keeper is the ref bearing the host's own ``company_name``.
3. A building can be on either side of the pair.

The 50 / 4 / 6 split of the rejected plan's own 60 merges is the arithmetic
check that the rule is implemented as specified.
"""

from __future__ import annotations

import pytest

from ops.plan_multi_member_refs import (
    REJECTED_PLAN_PATH,
    RefInfo,
    classify_excess,
    load_rejected_merges,
    merge_rule_bands,
    pick_keeper,
    rez98_unbacked_suppliers,
    root_form,
    roots_mergeable,
)


def _ref(source_ref: str, live_name: str | None) -> RefInfo:
    return RefInfo(
        source_ref=source_ref,
        record_id=f"rec-{source_ref}",
        member_id=None,
        reg=source_ref.split(":", 1)[1] if source_ref.startswith("general:") else source_ref,
        live_name=live_name,
        name_source="member-page" if live_name else "unresolved",
    )


class TestRootForm:
    def test_legal_form_and_geography_are_not_identity(self):
        assert root_form("Apparel Gallery Ltd.") == root_form("Apparel Gallery")
        assert root_form("Khan Sourcing (BD) Ltd.") == "khan sourcing"
        assert root_form("Etam Int'l Sourcing (Shanghai) Co. Ltd.") == "etam sourcing shanghai"

    def test_a_one_letter_root_difference_survives_normalisation(self):
        assert root_form("Azim Garments Ltd.") != root_form("Aziz Garments Ltd.")
        assert root_form("Europtex Fashion Limited") != root_form("Eurotex Fashion")


class TestRootTokenMergeRule:
    """REZ-90 tests 1-4. Score is never consulted; only where names differ."""

    @pytest.mark.parametrize(
        "keeper,excess",
        [
            ("Azim Garments Ltd.", "Aziz Garments Ltd."),
            ("Eastern Dresses Ltd.", "Western Dresses Ltd."),
            ("Alpha Product Development Company (BD) Ltd.", "Gaya Product Development Company (BD) Ltd."),
            ("Dressmen Ltd.", "Dressen Corporation"),
            ("New Wave Group AB", "New Wave Group SA"),
            ("Europtex Fashion Limited", "Eurotex Fashion"),
        ],
    )
    def test_root_token_difference_never_merges(self, keeper: str, excess: str):
        mergeable, band = roots_mergeable(excess, keeper)
        assert not mergeable
        assert band == "root-differs"

    @pytest.mark.parametrize(
        "keeper,excess",
        [
            ("Apparel Gallery Ltd.", "Apparel Gallery"),
            ("Asrotex Ltd.", "Asrotex"),
            ("Boston Sportswear Mfg. Ltd.", "Boston Sportswear MFG."),
        ],
    )
    def test_formatting_variants_merge(self, keeper: str, excess: str):
        mergeable, band = roots_mergeable(excess, keeper)
        assert mergeable
        assert band == "identical"

    @pytest.mark.parametrize(
        "keeper,excess",
        [
            ("Naba Apparels Ltd.", "Naba Apparel Inc."),
            ("Culture Clothing Inc.", "Culture Clothings ltd"),
            ("Far East Textiles & Clothing", "Far East Textile & Clothing Ltd."),
            ("RR Apparels", "R.R. Apparels Ltd."),
        ],
    )
    def test_pluralisation_and_initial_spacing_merge(self, keeper: str, excess: str):
        mergeable, band = roots_mergeable(excess, keeper)
        assert mergeable
        assert band == "plural"

    def test_rejected_plan_merge_set_splits_50_4_6(self):
        """The arithmetic check REZ-90 asks for, over the rejected plan itself."""
        pairs = load_rejected_merges(REJECTED_PLAN_PATH)
        assert len(pairs) == 60
        assert merge_rule_bands(pairs) == {
            "identical": 50,
            "plural": 4,
            "root-differs": 6,
        }


class TestClassifyExcess:
    def test_root_difference_goes_to_review_not_merge(self):
        keeper = _ref("general:1179", "Western Dresses Ltd.")
        excess = _ref("general:2001", "Eastern Dresses Ltd.")
        assert classify_excess("Western Dresses Ltd", keeper, excess) == "review"

    def test_formatting_variant_merges(self):
        keeper = _ref("general:4577", "Apparel Gallery Ltd.")
        excess = _ref("1036", "Apparel Gallery")
        assert classify_excess("Apparel Gallery Ltd.", keeper, excess) == "merge"

    def test_unit_suffix_is_a_facility_not_a_split(self):
        """REZ-90 test 5 — the class REZ-87 unblocked."""
        keeper = _ref("general:3231", "Anzir Apparels Ltd.")
        excess = _ref("general:3843", "Anzir Apparels Ltd. (U-2)")
        assert classify_excess("Anzir Apparels Ltd.", keeper, excess) == "attach-as-facility"

    @pytest.mark.parametrize(
        "host,keeper_name,excess_name",
        [
            (
                "Intramex Knit Wear Ltd. (Unit-2)",
                "Intramex Knit Wear Ltd. (Unit-2)",
                "Intramex Knitwear Ltd.",
            ),
            (
                "Mark Fashion Wear (Pvt.) Ltd. (U-2)",
                "Mark Fashion Wear (Pvt.) Ltd. (U-2)",
                "Mark Fashion Wear (Pvt). Ltd.",
            ),
        ],
    )
    def test_host_is_the_unit_and_the_excess_is_the_parent(
        self, host: str, keeper_name: str, excess_name: str
    ):
        """REZ-90 test 6 — the attach runs in the opposite direction."""
        keeper = _ref("general:5904", keeper_name)
        excess = _ref("general:4210", excess_name)
        assert classify_excess(host, keeper, excess) == "attach-host-as-facility"

    def test_distinct_company_splits(self):
        keeper = _ref("general:4121", "4A Yarn Dyeing Ltd.")
        excess = _ref("general:3778", "South End Sweater Co. Ltd.")
        assert classify_excess("4A Yarn Dyeing Ltd.", keeper, excess) == "split"

    def test_unnamed_ref_is_unresolved(self):
        keeper = _ref("632", "ABC International")
        assert classify_excess("ABC International", keeper, _ref("1697", None)) == "unresolved"


class TestKeeperSelection:
    """REZ-90 test 7 — keep the company the row says it is."""

    def test_prefers_the_ref_matching_the_hosts_company_name(self):
        intruder = _ref("general:2001", "Eastern Dresses Ltd.")
        real = _ref("general:1179", "Western Dresses Ltd.")
        keeper, matched = pick_keeper("Western Dresses Ltd", [intruder, real])
        assert keeper.source_ref == "general:1179"
        assert matched

    def test_general_prefix_does_not_outrank_the_hosts_own_name(self):
        """`dressen` is named Dressen Corporation; the general: ref is Dressmen."""
        general = _ref("general:117", "Dressmen Ltd.")
        associate = _ref("131", "Dressen Corporation")
        keeper, _ = pick_keeper("Dressen Corporation", [general, associate])
        assert keeper.source_ref == "131"

    def test_exact_name_outranks_a_shared_root(self):
        """Root form drops `International`, so exact name must break the tie."""
        exact = _ref("927", "Axon Fashion International")
        rooted = _ref("general:6881", "Axon Fashion Limited")
        keeper, _ = pick_keeper("Axon Fashion International", [rooted, exact])
        assert keeper.source_ref == "927"

    def test_general_still_breaks_a_genuine_tie(self):
        left = _ref("544", "A Plus Industries.")
        right = _ref("general:4221", "A Plus Industries Ltd.")
        keeper, _ = pick_keeper("A Plus Industries Ltd.", [left, right])
        assert keeper.source_ref == "general:4221"

    def test_host_matching_no_ref_is_reported_not_resolved(self):
        """`jm-knitwear` is J. M. KNITWEAR LTD and holds neither company."""
        keeper, matched = pick_keeper(
            "J. M. KNITWEAR LTD.",
            [_ref("422", "Reglisse"), _ref("423", "J.M. Export Ltd.")],
        )
        assert not matched
        assert keeper.source_ref  # still deterministic, just not trusted


class TestRez98ValidationSet:
    def test_a_supplier_with_a_backed_number_is_not_in_the_class(self):
        suppliers = {
            "s1": {
                "id": "s1",
                "slug": "backed",
                "is_published": True,
                "bgmea_reg_numbers": ["6631"],
            }
        }
        assert rez98_unbacked_suppliers(suppliers, {"s1": {"6631"}}) == []

    def test_a_supplier_whose_every_number_is_unbacked_is_flagged(self):
        suppliers = {
            "s1": {
                "id": "s1",
                "slug": "stripped",
                "is_published": True,
                "bgmea_reg_numbers": ["5729", "1162"],
            }
        }
        flagged = rez98_unbacked_suppliers(suppliers, {"s1": set()})
        assert [s["slug"] for s in flagged] == ["stripped"]

    def test_unpublished_rows_are_out_of_scope(self):
        suppliers = {
            "s1": {
                "id": "s1",
                "slug": "hidden",
                "is_published": False,
                "bgmea_reg_numbers": ["5729"],
            }
        }
        assert rez98_unbacked_suppliers(suppliers, {"s1": set()}) == []
