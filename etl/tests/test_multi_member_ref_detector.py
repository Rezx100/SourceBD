"""Pins for the structural multi-member-ref detector (REZ-88).

A BGMEA or BKMEA member ref identifies exactly one legal entity. Two distinct
active member refs from the same register on one supplier is a conflation with
no name comparison required. The critical negative — two rows sharing the same
source_ref — is an ordinary re-scrape and must stay silent.
"""

from __future__ import annotations

from ops.check_supplier_conflations import find_multi_member_refs, is_member_ref


def _row(
    supplier_id: str,
    source_code: str,
    source_ref: str,
    *,
    status: str = "active",
    company_name: str = "Host Co Ltd",
    slug: str = "host-co",
) -> dict:
    return {
        "supplier_id": supplier_id,
        "source_code": source_code,
        "source_ref": source_ref,
        "status": status,
        "company_name": company_name,
        "slug": slug,
    }


class TestIsMemberRef:
    def test_bgmea_general_and_bare_are_members(self):
        assert is_member_ref("BGMEA", "general:6257")
        assert is_member_ref("BGMEA", "231")

    def test_bkmea_detail_enrichment_is_not_a_member_ref(self):
        assert is_member_ref("BKMEA", "1449")
        assert not is_member_ref("BKMEA", "2824:detail")
        assert not is_member_ref("BKMEA", None)
        assert not is_member_ref("BKMEA", "")


class TestStructuralMultiMemberRef:
    def test_two_distinct_same_register_refs_are_flagged_without_names(self):
        # Real ananta-apparels shape: three general: refs, no scraped_company_name.
        rows = [
            _row("sup-a", "BGMEA", "general:6257", company_name="Ananta Apparels Limited"),
            _row("sup-a", "BGMEA", "general:1181", company_name="Ananta Apparels Limited"),
            _row("sup-a", "BGMEA", "general:4564", company_name="Ananta Apparels Limited"),
        ]
        findings = find_multi_member_refs(rows)
        assert len(findings) == 1
        assert findings[0].excess == 2
        assert findings[0].source_refs == ("general:1181", "general:4564", "general:6257")

    def test_same_source_ref_rescrape_is_not_flagged(self):
        # Critical negative — common, and worthless output if this fires.
        rows = [
            _row("sup-a", "BGMEA", "general:6257"),
            _row("sup-a", "BGMEA", "general:6257"),
        ]
        assert find_multi_member_refs(rows) == []

    def test_one_bgmea_and_one_bkmea_is_not_flagged_by_this_pass(self):
        rows = [
            _row("sup-a", "BGMEA", "general:6257"),
            _row("sup-a", "BKMEA", "1449"),
        ]
        assert find_multi_member_refs(rows) == []

    def test_superseded_records_are_ignored(self):
        rows = [
            _row("sup-a", "BGMEA", "general:6257", status="active"),
            _row("sup-a", "BGMEA", "general:1181", status="superseded"),
        ]
        assert find_multi_member_refs(rows) == []

    def test_bkmea_list_plus_detail_is_not_flagged(self):
        # REZ-36 split: list membership + detail enrichment share one company.
        rows = [
            _row("sup-a", "BKMEA", "2622"),
            _row("sup-a", "BKMEA", "2824:detail"),
        ]
        assert find_multi_member_refs(rows) == []

    def test_bkmea_two_membership_numbers_are_flagged(self):
        rows = [
            _row("sup-a", "BKMEA", "1449"),
            _row("sup-a", "BKMEA", "489"),
        ]
        findings = find_multi_member_refs(rows)
        assert len(findings) == 1
        assert findings[0].excess == 1
        assert findings[0].source_code == "BKMEA"
