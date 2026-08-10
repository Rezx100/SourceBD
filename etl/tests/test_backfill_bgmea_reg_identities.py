"""Behavioural pins for the REZ-115 identity backfill planner."""

from __future__ import annotations

from etl.core.bgmea_identity import identity_from_member_type, is_legacy_bare


def test_plan_logic_never_writes_bare_digits():
    after = {
        identity_from_member_type("general_manufacturer", "1"),
        identity_from_member_type("associate_buying_house", "1"),
    }
    assert after == {"general:1", "associate:1"}
    assert not any(is_legacy_bare(x) for x in after if x)


def test_unresolved_member_type_is_not_invented():
    assert identity_from_member_type(None, "10") is None
    assert identity_from_member_type("other", "10") is None
