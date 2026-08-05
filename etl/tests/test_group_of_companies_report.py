"""Pins for the REZ-102 group-of-companies report.

Two of these exist because the first cut of the report got them wrong, and
both errors were invisible in the output — they produced plausible numbers
rather than an exception:

1. **The two BGMEA registers must not share a key space.** Looking a
   ``general:`` ref up by its bare number answers with the associate
   register's entry for that number. It inflated the population-wide
   identity gap from 50 suppliers to 609 before it was caught.
2. **Phone separators are not the same as digits inside a number.** The
   register writes mobiles as ``0171-595204``; treating the hyphen as a
   separator splits one number into two fragments, both below the length
   floor, and a shared switchboard silently disappears.

The rest pin the relationship classifier's three outcomes, which are what
the report is actually asserting about the nine hosts.
"""

from __future__ import annotations

from ops.report_group_of_companies import (
    Anchor,
    Ref,
    area_tokens,
    name_agrees,
    name_in_domain,
    phone_numbers,
    premises_key,
    relate_host,
    same_premises,
    shared_phones,
)


def _ref(name: str, address: str = "", tel: str = "", **links) -> Ref:
    return Ref(
        source_ref=name,
        reg=name,
        name=name,
        name_source="associate-pdf",
        member_type="associate_buying_house",
        address=address,
        tel=tel,
        **links,
    )


class TestPremises:
    def test_house_and_road_identify_the_building(self):
        assert premises_key("House # 30, Road # 28, Block-K, Banani, Dhaka") == "house=30|road=28"

    def test_register_spelling_variants_reach_the_same_key(self):
        # BKMEA writes "HOUSE NO-15", BGMEA writes "House # 15"; the same
        # building must not depend on which register typed it.
        assert premises_key("HOUSE NO-15, ROAD NO-68/A, , DHAKA") == premises_key(
            "House # 15, Road # 68/A,, Gulshan-2, Dhaka"
        )

    def test_the_registers_own_misspellings_are_accepted(self):
        # Both appear verbatim in production BGMEA payloads.
        assert premises_key("Hosue # 5, Road # 6, Nikunjo, Dhaka") == "house=5|road=6"
        assert premises_key("Road # 30, Home # 11/B (3rd Floor), Gulshan-1, Dhaka") == (
            "house=11/b|road=30"
        )

    def test_a_locality_alone_is_not_a_building(self):
        assert premises_key("Barkhain Tallar Dwip, Anwara, Chittagong") == ""
        assert premises_key("BELTOLA, , DHAKA") == ""

    def test_different_buildings_in_one_neighbourhood_do_not_match(self):
        ok, _ = same_premises(
            "House # 325, Road # 5, DOHS, Baridhara DOHS, Dhaka",
            "House # 457, Road # 8, DOHS, Baridhara DOHS, Dhaka",
        )
        assert ok is False

    def test_conflicting_areas_reject_a_matching_pair(self):
        ok, _ = same_premises("House # 1, Road # 2, Banani, Dhaka", "House # 1, Road # 2, Uttara, Dhaka")
        assert ok is False

    def test_an_unstated_area_cannot_contradict_and_says_so(self):
        ok, basis = same_premises("HOUSE NO-15, ROAD NO-68/A, , DHAKA", "House # 15, Road # 68/A, Gulshan-2, Dhaka")
        assert ok is True
        assert "area unstated" in basis

    def test_dhaka_places_nothing(self):
        assert "dhaka" not in area_tokens("House # 1, Road # 2, Banani, Dhaka")


class TestPhones:
    def test_an_internal_hyphen_does_not_split_a_number(self):
        # REZ-102 bug 2: this is J.M. Export Ltd. and Reglisse's shared line.
        assert phone_numbers("0171-595204, 0173-003540") == {"171595204", "173003540"}

    def test_separators_still_separate(self):
        assert phone_numbers("8827134, 8827151") == {"8827134", "8827151"}

    def test_country_code_and_trunk_zero_fold_together(self):
        assert phone_numbers("+8801711548158") == phone_numbers("01711548158")

    def test_extensions_and_room_numbers_are_below_the_floor(self):
        assert phone_numbers("670442") == set()

    def test_trunk_prefix_variants_match_by_suffix(self):
        # BGAPMEA stores 8913263; BGMEA stores 02-8913263. One switchboard.
        assert shared_phones("8913263, 8916198", "02-8913263, 02-8959481") == {"8913263"}

    def test_unrelated_numbers_do_not_match(self):
        assert shared_phones("8410474, 8410475", "01713313253, 8410652") == set()


class TestNameInDomain:
    def test_a_distinctive_word_shared_with_the_mailbox_counts(self):
        assert name_in_domain("Flaxen Fashionwears Limited", "flaxen@flaxengroup.com") == "flaxen"

    def test_industry_vocabulary_never_counts(self):
        assert name_in_domain("Global Fashion", "someone@bdfashion.com") is None
        assert name_in_domain("Global Textile Sourcing Limited", "a@sourcinggroup.com") is None


class TestNameAgrees:
    def test_the_host_matching_no_ref_is_the_rez90_verdict(self):
        assert name_agrees("DK KNIT WEAR LTD", "DK Design Ltd.") is False
        assert name_agrees("NEXT APPARELS", "Next Sourcing Ltd.") is False
        assert name_agrees("R. A. APPARELS LTD", "R.A. Trading Limited") is False

    def test_legal_form_alone_is_not_a_disagreement(self):
        assert name_agrees("Apparel Gallery Ltd.", "Apparel Gallery") is True

    def test_an_unrecovered_name_is_never_agreement(self):
        assert name_agrees("DK KNIT WEAR LTD", None) is False


class TestRelateHost:
    def test_a_link_to_the_hosts_own_register_is_a_corroborated_group(self):
        refs = [_ref("a", linked_to_anchor=["BKMEA:bkmea_rep_mobile: shared phone 1711548158"])]
        assert relate_host(refs, Anchor()) == "group-corroborated"

    def test_refs_evidencing_only_each_other_do_not_evidence_the_host(self):
        refs = [_ref("a", linked_to_siblings={"b": ["shared phone 9862923"]}), _ref("b")]
        assert relate_host(refs, Anchor()) == "refs-cohere-only"

    def test_no_shared_premises_or_switchboard_anywhere(self):
        assert relate_host([_ref("a"), _ref("b")], Anchor()) == "no-link"

    def test_anchor_link_outranks_sibling_link(self):
        refs = [
            _ref("a", linked_to_anchor=["BGAPMEA:bgapmea_phone: shared phone 8913263"]),
            _ref("b", linked_to_siblings={"a": ["shared phone 8913263"]}),
        ]
        assert relate_host(refs, Anchor()) == "group-corroborated"
