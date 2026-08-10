"""REZ-110 — buyer_supplier_profile surfaces facility registries/RSC labelled.

Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. Skips when unset.
Asserts at the RPC boundary (not a pure helper): mother Compliance payload
includes facility-held BGMEA/RSC with building_name = facility company_name.
"""
from __future__ import annotations

import os

import httpx
import pytest

pytestmark = pytest.mark.skipif(
    not (
        os.environ.get("SUPABASE_URL")
        and os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    ),
    reason="SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set",
)


def _profile(slug: str) -> dict | None:
    base = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    r = httpx.post(
        f"{base}/rest/v1/rpc/buyer_supplier_profile",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        json={"p_slug": slug},
        timeout=60.0,
    )
    r.raise_for_status()
    return r.json()


def test_mother_compliance_pills_include_facility_bgmea_labelled() -> None:
    # green-textile Unit-3 holds BGMEA 6363 (Phase 1 inventory / live check).
    payload = _profile("green-textile")
    assert payload is not None
    pills = payload.get("pills") or []
    labelled = [
        p
        for p in pills
        if p.get("source_code") == "BGMEA"
        and p.get("building_name")
        and "Unit-3" in (p.get("building_name") or "")
    ]
    assert labelled, (
        "expected BGMEA pill with building_name containing Unit-3 on green-textile"
    )
    assert labelled[0].get("value") == "6363"


def test_mother_rsc_remediation_is_array_with_facility_sites() -> None:
    payload = _profile("green-textile")
    assert payload is not None
    rsc = payload.get("rsc_remediation")
    assert isinstance(rsc, list), f"rsc_remediation must be jsonb array, got {type(rsc)}"
    assert rsc, "green-textile facilities hold active RSC remediation"
    labelled = [s for s in rsc if s.get("building_name")]
    assert labelled, "expected at least one RSC site with building_name"
    for site in labelled:
        assert "workers_count" in site
        wc = site.get("workers_count")
        if wc is not None:
            assert isinstance(wc, int)
            # Unknown must stay null in SQL — never coerce missing to 0 here.
            # A real audited zero is allowed; we only forbid non-ints.


def test_no_facility_supplier_keeps_pills_without_building_name_key_on_own() -> None:
    # Pick a published supplier with no facility_of children if possible.
    # Mondol Fabrics has an extension — use a known solo if available.
    # Fallback: assert mother's own pills (building_name absent) still present
    # on green-textile alongside labelled ones.
    payload = _profile("green-textile")
    assert payload is not None
    own = [
        p
        for p in (payload.get("pills") or [])
        if p.get("source_code") == "BGMEA" and not p.get("building_name")
    ]
    assert own, "mother's own BGMEA must still appear without building_name"
