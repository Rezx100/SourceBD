"""ops/report_duplicate_suppliers.py — one company filed twice: certain, or a person decides.

The founder's instruction (13 Oct 2026) was to merge the certain duplicates
without asking. So the line this file guards is the one between "merge" and
"ask": a sister concern, a second membership or a real buying house must never
land on the merge list.
"""
from __future__ import annotations

import json

from ops.report_duplicate_suppliers import build, core_tokens, entry_key, page_data

SOURCES = [
    {"id": "s-bgmea", "code": "BGMEA", "tier": "tier2_industry"},
    {"id": "s-bkmea", "code": "BKMEA", "tier": "tier2_industry"},
    {"id": "s-epb", "code": "EPB", "tier": "tier1_gov"},
    {"id": "s-oeko", "code": "OEKO_TEX", "tier": "tier3_cert"},
]


def supplier(sid: str, name: str, **over) -> dict:
    row = {
        "id": sid, "slug": sid, "company_name": name, "entity_type": "factory", "phones": [],
        "email_primary": None, "website": None, "address_raw": None, "city": None, "district": "Gazipur",
        "lat": None, "lng": None, "is_published": True, "claimed_by": None, "created_at": f"2026-01-01T00:00:0{sid[-1]}",
        "employees_total": None, "parent_group_name": None, "facility_of": None, "bgmea_reg_numbers": [],
        "bkmea_reg_number": None, "epb_erc_number": None, "rjsc_reg_number": None,
    }
    return {**row, **over}


def record(sid: str, source: str, ref: str, **fields) -> dict:
    return {"supplier_id": sid, "source_id": source, "source_ref": ref, "status": "active", "fields": fields}


def run(suppliers: list[dict], records: list[dict], edges: list[dict] | None = None) -> dict:
    return build(suppliers, SOURCES, records, edges or [])


def names(rows: list[dict]) -> list[tuple[str, str]]:
    return [(r["keep"]["name"], r["drop"]["name"]) for r in rows]


def test_core_name_folds_what_does_not_tell_companies_apart():
    assert core_tokens("M/S. Oishi Fashions (Pvt.) Ltd.") == core_tokens("OISHI FASHION PVT LTD")
    assert core_tokens("AMS Int'l (Sweaters) Ltd.") == core_tokens("AMS International Sweaters Ltd.")
    # A unit number is part of which company it is.
    assert core_tokens("Shangu Tex-2 Ltd") != core_tokens("Shangu Tex Ltd.")


def test_a_plural_on_the_first_word_is_another_company():
    assert core_tokens("Cosmo Sweaters Ltd.") != core_tokens("Cosmos Sweaters Ltd.")
    area = {"address_raw": "Plot 4, Kalurghat BSCIC, Chandgaon, Chattogram", "district": "Chattogram"}
    out = run(
        [supplier("p1", "Cosmo Sweaters Ltd.", **area), supplier("p2", "Cosmos Sweaters Ltd.", **area)],
        [record("p1", "s-bkmea", "5", bkmea_membership_no="5 - A/2001"), record("p2", "s-epb", "6")],
    )
    assert out["merge"] == []


def test_same_name_in_the_same_locality_is_certain_only_while_the_name_is_unique():
    def rows(extra: list[dict]) -> dict:
        return run(
            [supplier("q1", "IFCO Garments & Textile Ltd.", address_raw="Kalurghat Heavy Estate, Chandgaon"),
             supplier("q2", "IFCO Garments & Textiles Ltd", address_raw="Chandgaon, Kalurghat"), *extra],
            [record("q1", "s-bkmea", "1720", bkmea_membership_no="1720 - A/2001"),
             record("q2", "s-bgmea", "general:4358", bgmea_member_type="general_manufacturer")],
        )
    assert len(rows([])["merge"]) == 1
    assert rows([supplier("q3", "IFCA Garments & Textile Ltd.")])["merge"] == []


def test_a_spelling_apart_needs_more_than_a_group_email_domain():
    def rows(**shared) -> dict:
        return run(
            [supplier("t1", "Tosrifa Industries Ltd.", email_primary="info@ntg.com.bd", **shared),
             supplier("t2", "Tosrifa Indutries Ltd.", email_primary="hr@ntg.com.bd", **shared)],
            [record("t1", "s-epb", "5317"), record("t2", "s-bgmea", "general:4105", bgmea_member_type="general_manufacturer")],
        )
    assert rows()["merge"] == []
    assert len(rows(phones=["029800001"])["merge"]) == 1


def test_bkmea_member_and_detail_page_are_two_number_spaces():
    member = entry_key("BKMEA", "859", {"bkmea_membership_no": "859 - C/2008"})
    page_of_another = entry_key("BKMEA", "859:detail", {"bkmea_membership_no": "866 - C/2008"})
    assert member == "859" and page_of_another == "866"


def test_same_name_and_phone_across_registers_is_certain_and_keeps_the_fuller_row():
    out = run(
        [supplier("a1", "OISHI FASHION (PVT) LTD", phones=["01711-548158"]),
         supplier("a2", "Oishi Fashions (Pvt) Ltd.", phones=["+8801711548158"])],
        [record("a1", "s-epb", "4318"), record("a1", "s-oeko", "oeko-tex-41796:100"),
         record("a2", "s-bgmea", "general:3176", bgmea_member_type="general_manufacturer")],
    )
    assert names(out["merge"]) == [("OISHI FASHION (PVT) LTD", "Oishi Fashions (Pvt) Ltd.")]
    assert out["ask"] == []


def test_sister_concerns_sharing_a_phone_are_neither_merged_nor_asked():
    out = run(
        [supplier("b1", "Ripon Apparels Ltd", phones=["029876543"]),
         supplier("b2", "Ripon Knitwear Ltd.", phones=["029876543"])],
        [record("b1", "s-bkmea", "10", bkmea_membership_no="10 - A/2001"),
         record("b2", "s-bgmea", "general:20", bgmea_member_type="general_manufacturer")],
    )
    assert out["merge"] == [] and out["ask"] == []


def test_two_memberships_under_one_name_go_to_the_founder():
    out = run(
        [supplier("c1", "Abdullah Fashions", phones=["01911000111"]),
         supplier("c2", "Abdullah Fashion", phones=["01911000111"])],
        [record("c1", "s-bgmea", "general:6400", bgmea_member_type="general_manufacturer"),
         record("c2", "s-bgmea", "general:7186", bgmea_member_type="general_manufacturer")],
    )
    assert out["merge"] == []
    assert [(r["section"], r["lean"]) for r in out["ask"]] == [("two-entries", "separate")]


def test_a_real_buying_house_is_never_merged_into_a_factory():
    out = run(
        [supplier("d1", "Sadaf Fashions Limited", phones=["031710000"]),
         supplier("d2", "Sadaf Fashion Limited", phones=["031710000"], entity_type="buying_house")],
        [record("d1", "s-bgmea", "general:2472", bgmea_member_type="general_manufacturer"),
         record("d2", "s-bgmea", "1023", bgmea_member_type="associate_buying_house")],
    )
    assert out["merge"] == []
    assert [(r["section"], r["lean"]) for r in out["ask"]] == [("buying-house", "separate")]


def test_buying_house_as_the_loaders_default_type_does_not_block():
    # A general manufacturer the loader typed "buying_house" is a factory.
    out = run(
        [supplier("e1", "Clifton Fashions Ltd.", phones=["031650000"]),
         supplier("e2", "Clifton Fashion Ltd.", phones=["031650000"], entity_type="buying_house")],
        [record("e1", "s-bkmea", "462", bkmea_membership_no="462 - A/2001"),
         record("e2", "s-bgmea", "general:2406", bgmea_member_type="general_manufacturer")],
    )
    assert len(out["merge"]) == 1


def test_a_third_row_of_the_name_that_conflicts_stops_the_merge():
    # f1 + f2 look certain, but f3 holds a second BGMEA membership: whose entries are f2's?
    out = run(
        [supplier("f1", "That's It Fashion Ltd", phones=["027700001"]),
         supplier("f2", "That's It Fashions Ltd.", phones=["027700001"]),
         supplier("f3", "That's It Fashions Limited")],
        [record("f1", "s-bgmea", "general:100", bgmea_member_type="general_manufacturer"),
         record("f2", "s-epb", "1460"),
         record("f3", "s-bgmea", "general:805", bgmea_member_type="general_manufacturer")],
    )
    assert out["merge"] == []
    assert any("tangled with a third profile" in s for r in out["ask"] for s in r["soft"])


def test_a_ruling_by_a_person_is_not_overridden():
    rows = [supplier("g1", "Crony Fashion Ltd", phones=["027600001"]),
            supplier("g2", "Crony Fashions Ltd.", phones=["027600001"])]
    recs = [record("g1", "s-bkmea", "377", bkmea_membership_no="377 - A/2001"), record("g2", "s-epb", "9")]
    edge = {"supplier_a": "g1", "supplier_b": "g2", "verdict": "different", "superseded_at": None}
    assert len(run(rows, recs)["merge"]) == 1
    assert run(rows, recs, [edge])["merge"] == []


def test_the_page_says_a_phone_matched_and_never_which():
    out = run(
        [supplier("h1", "Raz Fashion Wear", phones=["01711222333"], district="Narayanganj"),
         supplier("h2", "Raz Fashion Wears Ltd.", phones=["01711222333"], district="Chattogram")],
        [record("h1", "s-bkmea", "2599", bkmea_membership_no="2599 - A/2020", bkmea_owner_email="owner@razfashion.com"),
         record("h2", "s-bgmea", "general:2537", bgmea_member_type="general_manufacturer")],
    )
    page = json.dumps(page_data(out["ask"]))
    assert "the same phone number" in page
    assert "1711222333" not in page and "owner@" not in page
