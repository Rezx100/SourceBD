"""Pins for the BGMEA conflation repair + widened daily detector (4 Aug 2026).

Every pair here is real production data from the 24 Jul 2026 conflation
population: 808 BGMEA general-member records were merged into sister
companies' suppliers by the pre-31-Jul contact-overlap passes, and the first
repair dry run showed the Pass-4 fuzzy bar would have re-conflated some of
them into near-miss names (Anika->ANITA, Bando->BRAND, Zuma->Muma). These
tests keep both edges honest: stowaways must be detected, and a repaired
record may only JOIN a supplier on exact identity.
"""

from __future__ import annotations

from ops.repair_bgmea_conflations import _compatible, _guard_matches


def _pool(*names: str) -> list[dict]:
    return [{"id": f"sup-{i}", "company_name": n} for i, n in enumerate(names)]


class TestStowawayDetection:
    def test_real_conflations_are_flagged(self):
        # host supplier name, BGMEA member name — all four founder cases.
        for host, member in [
            ("3S TEXTILE LTD", "3S International Ltd."),
            ("AKH Apparels Ltd", "AKH Knitwear Ltd."),
            ("Aman Knittings Limited", "Aman Sweaters Ltd."),
            ("ABM Fashions Ltd.", "Ananta Sportswear Ltd."),
        ]:
            assert not _compatible(host, member), (host, member)

    def test_same_company_spellings_are_not_flagged(self):
        for host, member in [
            ("CRONY APPARELS LTD", "Crony Apparels Ltd."),
            ("Epic Garments manufacturing Co Ltd", "Epic Garments Manf. Co. Ltd."),
            ("BABYLON DRESSES LIMITED", "Babylon Dresses Ltd."),
        ]:
            assert _compatible(host, member), (host, member)

    def test_extension_host_is_the_unit_class_not_a_conflation(self):
        assert _compatible(
            "AKH KNITTING & DYEING LTD. (Extension)", "AKH Knitting & Dyeing Ltd."
        )

    def test_direction_a_short_base_is_compatible(self):
        # REZ-87: old _MIN_PREFIX_LEN rejected "big boss" (len 8).
        assert _compatible(
            "Big Boss Corporation Limited (Extension)",
            "Big Boss Corporation Limited",
        )
        assert _compatible("Asrotex (Extension)", "Asrotex")
        assert _compatible("G.A.B. Limited (Extension)", "G.A.B. Limited")

    def test_u2_building_is_compatible_with_parent(self):
        assert _compatible("Anzir Apparels Ltd. (U-2)", "Anzir Apparels Ltd.")

    def test_unnamed_record_is_not_flagged(self):
        # Nothing to compare — flagging would be a guess.
        assert _compatible("Any Host Ltd.", "")
        assert _compatible("", "Any Member Ltd.")


class TestJoinGuard:
    """A record may only join an existing supplier on exact identity."""

    def test_slug_and_squash_equality_are_exact(self):
        exact, fuzzy = _guard_matches(
            "Cherry Knit Wear Ltd.", _pool("CHERRY KNITWEAR LTD."), "parent"
        )
        assert len(exact) == 1 and not fuzzy

        exact, fuzzy = _guard_matches(
            "Crony Apparels Ltd.", _pool("CRONY APPARELS LTD"), "parent"
        )
        assert len(exact) == 1 and not fuzzy

    def test_near_miss_names_are_fuzzy_never_exact(self):
        # Each of these was a single "matcher guard" hit on the first dry run
        # and would have re-conflated two different companies if joined.
        for member, candidate in [
            ("Anika Apparels (Pvt) Ltd", "ANITA APPARELS LTD."),
            ("Bando Apparels Ltd.", "BRAND APPARELS"),
            ("Zuma Fashions Ltd.", "Muma Fashions Ltd."),
            ("Eden Apparels Ltd.", "KEEN APPARELS LTD."),
        ]:
            exact, fuzzy = _guard_matches(member, _pool(candidate), "parent")
            assert not exact, (member, candidate)

    def test_parent_is_never_a_destination(self):
        pool = [{"id": "parent", "company_name": "AKH Knitwear Ltd."}]
        exact, fuzzy = _guard_matches("AKH Knitwear Ltd.", pool, "parent")
        assert not exact and not fuzzy
