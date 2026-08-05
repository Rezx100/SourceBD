"""Pins for the BGMEA name harvest (REZ-102 / REZ-103 precondition)."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[2]))

from ops.harvest_bgmea_names import ref_for_row  # noqa: E402


class TestRefForRow:
    """`ref_for_row` must agree with `bgmea_web._to_record`'s key.

    A harvested key that does not match the stored `source_ref` does not fail
    loudly — it just never matches, so the record stays "unnameable" and the
    identity gap is under-reported. These are the cases that decide it.
    """

    def test_registration_number_is_namespaced(self):
        # THE regression. BGMEA's general and associate registers number
        # independently: associate `35` is DK Textile, `general:35` is someone
        # else. Keying on the bare number read REZ-102's class as 609
        # suppliers instead of 50.
        assert ref_for_row({"member_id": "5276", "bgmea_reg_number": "35"}) == "general:35"

    def test_bare_number_is_never_emitted_for_a_general_member(self):
        ref = ref_for_row({"member_id": "5276", "bgmea_reg_number": "1314"})
        assert not ref.isdigit()
        assert ref.startswith("general:")

    def test_falls_back_to_member_id_when_registration_is_missing(self):
        # `_to_record` does the same. Dropping these would silently shrink the
        # oracle rather than record a member we cannot key by registration.
        assert ref_for_row({"member_id": "5276", "bgmea_reg_number": ""}) == "member:5276"

    def test_absent_registration_key_behaves_as_blank(self):
        assert ref_for_row({"member_id": "42"}) == "member:42"

    def test_surrounding_whitespace_does_not_create_a_second_key(self):
        assert ref_for_row({"member_id": "1", "bgmea_reg_number": "  778 "}) == "general:778"
