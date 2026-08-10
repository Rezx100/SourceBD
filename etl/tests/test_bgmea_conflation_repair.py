"""Pins for the BGMEA conflation repair + widened daily detector (4 Aug 2026).

Every pair here is real production data from the 24 Jul 2026 conflation
population: 808 BGMEA general-member records were merged into sister
companies' suppliers by the pre-31-Jul contact-overlap passes, and the first
repair dry run showed the Pass-4 fuzzy bar would have re-conflated some of
them into near-miss names (Anika->ANITA, Bando->BRAND, Zuma->Muma). These
tests keep both edges honest: stowaways must be detected, and a repaired
record may only JOIN a supplier on exact identity.

REZ-89 (5 Aug 2026) adds the profile-projection half: the numeric merge is the
A8 rule (highest `source_tier`, then most recent `fetched_at`, then lower
record id) rather than max-merge, and every `suppliers` PATCH skips columns an
admin has locked (A6).
"""

from __future__ import annotations

from typing import Any

from ops.repair_bgmea_conflations import (
    _CAPS,
    _bgmea_production_workers,
    _compatible,
    _guard_matches,
    _merge_into_profile,
    _recompute_parent,
    numeric_winners,
)

SOURCE_CODES = {"src-bgmea": "BGMEA", "src-bkmea": "BKMEA"}


def _pool(*names: str) -> list[dict]:
    return [{"id": f"sup-{i}", "company_name": n} for i, n in enumerate(names)]


def _bgmea_record(
    record_id: str,
    *,
    tier: str = "tier2_industry",
    fetched: str | None = "2026-07-24T00:00:00+00:00",
    ref: str = "general:12345",
    **fields: Any,
) -> dict[str, Any]:
    return {
        "id": record_id,
        "source_id": "src-bgmea",
        "source_ref": ref,
        "source_tier": tier,
        "fetched_at": fetched,
        "fields": fields,
    }


def _bkmea_record(
    record_id: str,
    *,
    tier: str = "tier2_industry",
    fetched: str | None = "2026-07-24T00:00:00+00:00",
    **fields: Any,
) -> dict[str, Any]:
    return {
        "id": record_id,
        "source_id": "src-bkmea",
        "source_ref": "member:1",
        "source_tier": tier,
        "fetched_at": fetched,
        "fields": fields,
    }


class FakeRest:
    """Stand-in for the REST client. CI has no database.

    Serves one supplier row, one set of active source records and one set of
    live field locks, and records every PATCH body for assertion.
    """

    def __init__(
        self,
        *,
        supplier: dict[str, Any],
        records: list[dict[str, Any]] | None = None,
        locks: tuple[str, ...] = (),
    ) -> None:
        self.supplier = supplier
        self.records = records or []
        self.locks = locks
        self.patches: list[tuple[str, dict[str, str], dict[str, Any]]] = []

    def all_rows(self, path: str, params: dict[str, str]) -> list[dict]:
        if path == "suppliers":
            return [self.supplier]
        if path == "source_records":
            return list(self.records)
        if path == "supplier_field_locks":
            assert params.get("released_at") == "is.null", "released locks must not block"
            return [{"column_name": c} for c in self.locks]
        raise AssertionError(f"unexpected read from {path!r}")

    def one(self, path: str, params: dict[str, str]) -> dict | None:
        rows = self.all_rows(path, params)
        return rows[0] if rows else None

    def patch(self, path: str, params: dict[str, str], body: dict) -> list[dict]:
        self.patches.append((path, params, body))
        return [body]

    @property
    def supplier_body(self) -> dict[str, Any]:
        bodies = [b for p, _, b in self.patches if p == "suppliers"]
        assert len(bodies) == 1, f"expected exactly one suppliers PATCH, got {len(bodies)}"
        return bodies[0]


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


class TestNumericProjectionIsA8:
    """REZ-89 — the repair projects numerics by trust and recency, not by max.

    Before REZ-89 every one of these resolved to the larger value, so a rerun
    of the repair after A8's apply would have pushed the corrected figures
    back up to their high-water mark.
    """

    def test_higher_tier_wins_even_when_its_value_is_smaller(self):
        """Issue test #1. `source_tier` is a per-record column, so a record
        re-tiered by its source is representable and must be honoured."""
        winners = numeric_winners(
            [
                _bkmea_record("rec-b", tier="tier2_industry", bkmea_machines_sewing="150"),
                _bgmea_record("rec-a", tier="tier1_gov", num_machines="36"),
            ],
            SOURCE_CODES,
        )
        assert winners["machines_sewing"] == 36

    def test_same_tier_newer_fetch_wins_even_when_smaller(self):
        """Issue test #2 — the KNIT GUARD shape: 150 corrected down to 36."""
        winners = numeric_winners(
            [
                _bkmea_record(
                    "rec-old",
                    fetched="2026-08-02T03:18:00+00:00",
                    bkmea_machines_sewing="150",
                ),
                _bkmea_record(
                    "rec-new",
                    fetched="2026-08-02T04:46:00+00:00",
                    bkmea_machines_sewing="36",
                ),
            ],
            SOURCE_CODES,
        )
        assert winners["machines_sewing"] == 36

    def test_same_tier_same_fetch_lower_record_id_wins(self):
        """Deterministic tiebreak, matching the canonical `order by ... sr.id`."""
        ts = "2026-08-02T04:46:00+00:00"
        winners = numeric_winners(
            [
                _bkmea_record("bbbb", fetched=ts, bkmea_employees_total="150"),
                _bkmea_record("aaaa", fetched=ts, bkmea_employees_total="36"),
            ],
            SOURCE_CODES,
        )
        assert winners["employees_total"] == 36

    def test_record_without_fetched_at_sorts_last_within_its_tier(self):
        winners = numeric_winners(
            [
                _bkmea_record("rec-null", fetched=None, bkmea_employees_total="9000"),
                _bkmea_record(
                    "rec-dated",
                    fetched="2026-07-01T00:00:00+00:00",
                    bkmea_employees_total="1200",
                ),
            ],
            SOURCE_CODES,
        )
        assert winners["employees_total"] == 1200

    def test_zero_reporting_record_never_wins(self):
        """Issue test #3 — a published 0 must not blank a real figure.

        The zero-reporting record is both the newest and the same tier, so
        under a plain recency rule it would win.
        """
        winners = numeric_winners(
            [
                _bkmea_record(
                    "rec-real",
                    fetched="2026-07-01T00:00:00+00:00",
                    bkmea_employees_total="4200",
                ),
                _bkmea_record(
                    "rec-zero",
                    fetched="2026-08-04T00:00:00+00:00",
                    bkmea_employees_total="0",
                ),
            ],
            SOURCE_CODES,
        )
        assert winners["employees_total"] == 4200
        # A record whose only figure is 0 contributes no candidate at all.
        assert numeric_winners(
            [_bkmea_record("rec-zero", bkmea_employees_total="0")], SOURCE_CODES
        ) == {}

    def test_sanity_caps_still_reject_out_of_range_values(self):
        """Issue test #4 — `_CAPS` survives the max→A8 rewrite."""
        assert _CAPS["machines_sewing"] == 20_000
        assert _CAPS["employees_total"] == 200_000

        # Out-of-range candidate is dropped, so the in-range record wins even
        # though it is older and would lose on recency.
        winners = numeric_winners(
            [
                _bgmea_record(
                    "rec-absurd",
                    fetched="2026-08-04T00:00:00+00:00",
                    num_machines="25000",
                ),
                _bkmea_record(
                    "rec-sane",
                    fetched="2026-07-01T00:00:00+00:00",
                    bkmea_machines_sewing="450",
                ),
            ],
            SOURCE_CODES,
        )
        assert winners["machines_sewing"] == 450

        # Caps apply per column: the 300k sum is rejected while each cohort,
        # which is inside its own cap, still projects.
        capped = numeric_winners(
            [
                _bgmea_record(
                    "rec-absurd",
                    employees={"Employee Male": "150000", "Employee Female": "150000"},
                )
            ],
            SOURCE_CODES,
        )
        assert "employees_total" not in capped
        assert capped["employees_male"] == 150_000

    def test_employees_total_is_male_plus_female_not_the_max_cohort(self):
        """REZ-95 parity — the repair must not republish `Management`.

        The old projection max()'d every value in the `employees` payload into
        `employees_total`, so the COAST TO COAST shape published 2,450 (the
        largest cohort) and the 227-record band published the management
        figure under the "Production workers" label.
        """
        winners = numeric_winners(
            [
                _bgmea_record(
                    "rec-1",
                    employees={
                        "Management": "850",
                        "Employee Male": "2450",
                        "Employee Female": "1000",
                    },
                )
            ],
            SOURCE_CODES,
        )
        assert winners["employees_total"] == 3450
        assert winners["employees_male"] == 2450
        assert winners["employees_female"] == 1000

    def test_management_only_payload_yields_no_worker_total(self):
        assert _bgmea_production_workers({"employees": {"Management": "550"}}) is None
        assert numeric_winners(
            [_bgmea_record("rec-1", employees={"Management": "550"})], SOURCE_CODES
        ) == {}

    def test_two_records_compete_and_are_never_summed(self):
        winners = numeric_winners(
            [
                _bgmea_record(
                    "rec-new",
                    fetched="2026-08-02T00:00:00+00:00",
                    employees={"Employee Male": "2450", "Employee Female": "1000"},
                ),
                _bgmea_record(
                    "rec-old",
                    fetched="2026-08-01T00:00:00+00:00",
                    employees={"Employee Male": "500", "Employee Female": "300"},
                ),
            ],
            SOURCE_CODES,
        )
        assert winners["employees_total"] == 3450
        assert winners["employees_total"] != 3450 + 800


class TestFieldLocksHoldAgainstTheRepair:
    """Issue test #5 — a locked column reaches neither `rest.patch` body."""

    MOVED = {
        "employees": {"Employee Male": "600", "Employee Female": "400"},
        "factory_types": [{"Type": "Knit"}],
        "principal_products": ["T-Shirt"],
        "bgmea_member_type": "general_manufacturer",
        "bgmea_reg_number": "12345",
    }

    def _dest(self) -> dict:
        return {
            "id": "dest-1",
            "employees_total": 999,
            "employees_male": None,
            "employees_female": None,
            "production_capacity_pcs_day": None,
            "production_capacity_dozen_yearly": None,
            "machines_sewing": None,
            "established_date": None,
            "factory_types": [],
            "principal_products": [],
            "address_raw": None,
            "email_primary": None,
            "phones": None,
            "bgmea_reg_numbers": ["general:111"],
            "bgmea_verified": False,
            "source_tags": [],
        }

    def test_merge_into_profile_writes_both_columns_when_unlocked(self):
        rest = FakeRest(
            supplier=self._dest(),
            records=[_bgmea_record("rec-moved", **self.MOVED)],
        )
        _merge_into_profile(rest, "dest-1", self.MOVED, "BGMEA", "12345", SOURCE_CODES)
        body = rest.supplier_body
        assert body["employees_total"] == 1000
        assert body["bgmea_reg_numbers"] == ["general:12345"]

    def test_merge_into_profile_skips_locked_columns(self):
        rest = FakeRest(
            supplier=self._dest(),
            records=[_bgmea_record("rec-moved", **self.MOVED)],
            locks=("employees_total", "bgmea_reg_numbers"),
        )
        _merge_into_profile(rest, "dest-1", self.MOVED, "BGMEA", "12345", SOURCE_CODES)
        body = rest.supplier_body
        assert "employees_total" not in body
        # REZ-98 put bgmea_reg_numbers in this body; it is lock-checked like
        # any other column, not special-cased out.
        assert "bgmea_reg_numbers" not in body
        # Unlocked columns still land.
        assert body["factory_types"] == ["Knit"]
        assert body["principal_products"] == ["T-Shirt"]
        assert body["bgmea_verified"] is True

    def _parent(self) -> dict:
        return {"id": "parent-1", "bgmea_reg_numbers": ["999"]}

    def test_recompute_parent_writes_both_columns_when_unlocked(self):
        rest = FakeRest(
            supplier=self._parent(),
            records=[_bkmea_record("rec-kept", bkmea_employees_total="700")],
        )
        _recompute_parent(rest, "parent-1", SOURCE_CODES)
        body = rest.supplier_body
        assert body["employees_total"] == 700
        # No remaining BGMEA record backs 999, so REZ-98 drops it.
        assert body["bgmea_reg_numbers"] == []

    def test_recompute_parent_skips_locked_columns(self):
        rest = FakeRest(
            supplier=self._parent(),
            records=[_bkmea_record("rec-kept", bkmea_employees_total="700")],
            locks=("employees_total", "bgmea_reg_numbers"),
        )
        _recompute_parent(rest, "parent-1", SOURCE_CODES)
        body = rest.supplier_body
        assert "employees_total" not in body
        assert "bgmea_reg_numbers" not in body
        # The recompute still clears the columns the stowaway contributed.
        assert body["employees_male"] is None
        assert body["machines_sewing"] is None

    def test_fully_locked_supplier_is_not_patched_at_all(self):
        """The lock filter must not degrade into an empty PATCH body."""
        rest = FakeRest(
            supplier=self._parent(),
            records=[_bkmea_record("rec-kept", bkmea_employees_total="700")],
            locks=(
                "employees_total",
                "employees_male",
                "employees_female",
                "production_capacity_pcs_day",
                "production_capacity_dozen_yearly",
                "machines_sewing",
                "bgmea_reg_numbers",
            ),
        )
        _recompute_parent(rest, "parent-1", SOURCE_CODES)
        assert rest.patches == []


class TestNonGoalsUnchanged:
    """Arrays still union and scalars still fill-only (REZ-89 non-goals)."""

    def test_arrays_union_and_scalars_fill_only(self):
        supplier = {
            "id": "dest-1",
            "employees_total": None,
            "employees_male": None,
            "employees_female": None,
            "production_capacity_pcs_day": None,
            "production_capacity_dozen_yearly": None,
            "machines_sewing": None,
            "established_date": "1998",
            "factory_types": ["Woven"],
            "principal_products": ["Trouser"],
            "address_raw": "Existing address",
            "email_primary": None,
            "phones": None,
            "bgmea_reg_numbers": [],
            "bgmea_verified": True,
            "source_tags": ["BGMEA"],
        }
        fields = {
            "factory_types": [{"Type": "Knit"}],
            "principal_products": ["T-Shirt"],
            "established_date": "2004",
            "factory_address": "New address",
            "factory_email": "hello@example.com",
        }
        rest = FakeRest(supplier=supplier, records=[_bgmea_record("rec-moved", **fields)])
        _merge_into_profile(rest, "dest-1", fields, "BGMEA", None, SOURCE_CODES)
        body = rest.supplier_body
        # Union, not replace.
        assert body["factory_types"] == ["Knit", "Woven"]
        assert body["principal_products"] == ["T-Shirt", "Trouser"]
        # Fill-only: populated scalars are left alone, empty ones are filled.
        assert "established_date" not in body
        assert "address_raw" not in body
        assert body["email_primary"] == "hello@example.com"
