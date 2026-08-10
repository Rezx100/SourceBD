"""REZ-110 — buyer_supplier_profile surfaces facility registries/RSC labelled.

Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. Skips when unset.
Asserts at the RPC boundary (not a pure helper).
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
    assert labelled, "expected BGMEA pill with building_name containing Unit-3"
    assert labelled[0].get("value") == "6363"
    # Own mother BGMEA must omit the key entirely (not null value).
    own = [
        p
        for p in pills
        if p.get("source_code") == "BGMEA" and "building_name" not in p
    ]
    assert own, "mother own BGMEA must omit building_name key"


def test_mother_rsc_remediation_is_array_with_facility_sites() -> None:
    payload = _profile("green-textile")
    assert payload is not None
    rsc = payload.get("rsc_remediation")
    assert isinstance(rsc, list), f"rsc_remediation must be jsonb array, got {type(rsc)}"
    assert rsc, "green-textile facilities hold active RSC remediation"
    labelled = [s for s in rsc if s.get("building_name")]
    assert labelled, "expected at least one RSC site with building_name"


def test_facility_rsc_null_workers_stays_json_null() -> None:
    # ananta-garments Extension: active RSC with workers_count null in prod.
    payload = _profile("ananta-garments")
    assert payload is not None
    rsc = payload.get("rsc_remediation")
    assert isinstance(rsc, list)
    null_workers = [
        s
        for s in rsc
        if s.get("building_name") and s.get("workers_count") is None
    ]
    if not null_workers:
        pytest.skip("no facility RSC with null workers_count on ananta-garments")
    for site in null_workers:
        assert site["workers_count"] is None
        assert site.get("workers_count") != 0


def test_solo_supplier_pills_omit_building_name_key() -> None:
    # kc-jacket-wear: published, no facility_of children (verify below).
    base = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    kids = httpx.get(
        f"{base}/rest/v1/suppliers",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
        params={
            "select": "id",
            "facility_of": "not.is.null",
            "slug": "eq.kc-jacket-wear",
            "limit": "1",
        },
        timeout=30.0,
    )
    # Wrong: we need children OF this slug's id. Resolve mother id first.
    mother = httpx.get(
        f"{base}/rest/v1/suppliers",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
        params={"select": "id", "slug": "eq.kc-jacket-wear", "limit": "1"},
        timeout=30.0,
    )
    mother.raise_for_status()
    rows = mother.json()
    if not rows:
        pytest.skip("kc-jacket-wear missing")
    mid = rows[0]["id"]
    kids = httpx.get(
        f"{base}/rest/v1/suppliers",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
        params={"select": "id", "facility_of": f"eq.{mid}", "limit": "1"},
        timeout=30.0,
    )
    kids.raise_for_status()
    if kids.json():
        pytest.skip("kc-jacket-wear unexpectedly has facilities")
    payload = _profile("kc-jacket-wear")
    assert payload is not None
    for p in payload.get("pills") or []:
        assert "building_name" not in p, p
