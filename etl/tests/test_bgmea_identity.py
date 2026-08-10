"""Unit tests for BGMEA register+number identity (REZ-115)."""

from __future__ import annotations

from etl.core.bgmea_identity import (
    identity_from_member_type,
    identity_from_source_record,
    is_legacy_bare,
    parse_identity,
    register_plain_label,
    verification_url,
)


def test_general_and_associate_same_digit_are_distinct():
    assert identity_from_member_type("general_manufacturer", "1") == "general:1"
    assert identity_from_member_type("associate_buying_house", "1") == "associate:1"
    assert identity_from_member_type("general_manufacturer", "1") != identity_from_member_type(
        "associate_buying_house", "1"
    )


def test_unknown_member_type_is_unresolved():
    assert identity_from_member_type("something_else", "10") is None
    assert identity_from_member_type(None, "10") is None
    assert identity_from_member_type("general_manufacturer", None) is None


def test_identity_from_source_record_uses_member_type_only():
    general = {
        "source_ref": "general:1007",
        "fields": {
            "bgmea_member_type": "general_manufacturer",
            "bgmea_reg_number": "1007",
        },
    }
    associate = {
        "source_ref": "1007",
        "fields": {
            "bgmea_member_type": "associate_buying_house",
            "bgmea_reg_number": "1007",
        },
    }
    assert identity_from_source_record(general) == "general:1007"
    assert identity_from_source_record(associate) == "associate:1007"


def test_parse_and_labels():
    assert parse_identity("general:10") == ("general", "10")
    assert parse_identity("associate:10") == ("associate", "10")
    assert parse_identity("10") is None
    assert register_plain_label("general") == "General member"
    assert register_plain_label("associate") == "Associate member"


def test_verification_url_never_cross_links_registers():
    assert verification_url("general", "1") == "https://www.bgmea.com.bd/member/1"
    assert verification_url("general", "1", member_id="99") == (
        "https://www.bgmea.com.bd/member/99"
    )
    # Associate must not open the general member page for the same digit.
    assert verification_url("associate", "1") is None
    assert is_legacy_bare("1")
    assert not is_legacy_bare("general:1")
