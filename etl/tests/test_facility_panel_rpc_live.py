"""REZ-109 — RPC boundary via Supabase REST (pooler often unreachable).

Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. Skips when unset.
Executes buyer_supplier_facility_panel against live unpublished facility_of
children — HTTP UI mocks alone do not satisfy the issue test boundary.
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


def _rpc(slug: str) -> dict | None:
    base = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    r = httpx.post(
        f"{base}/rest/v1/rpc/buyer_supplier_facility_panel",
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


def _get(path: str, params: dict) -> list:
    base = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    r = httpx.get(
        f"{base}/rest/v1/{path}",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Prefer": "count=exact",
        },
        params=params,
        timeout=60.0,
    )
    r.raise_for_status()
    return r.json()


def test_unpublished_facility_panel_returns_address_and_pill_pii_stripped() -> None:
    # Known production mother with address+pill on an unpublished Unit-2 (verified).
    mother = "western-dresses"
    panel = _rpc(mother)
    assert panel is not None
    facilities = panel.get("facilities") or []
    assert facilities, "western-dresses must list facilities"
    match = next(
        (
            f
            for f in facilities
            if (f.get("addresses") or []) and (f.get("pills") or [])
        ),
        None,
    )
    assert match is not None, "expected a facility with both addresses and pills"

    # Child must be unpublished + attached in suppliers table.
    kids = _get(
        "suppliers",
        {
            "select": "id,company_name,is_published,facility_of",
            "company_name": f"eq.{match['name']}",
            "limit": "1",
        },
    )
    assert kids and kids[0]["is_published"] is False
    assert kids[0]["facility_of"] is not None

    for a in match["addresses"]:
        assert set(a.keys()) <= {"kind", "address", "source_code"}
        assert a.get("address")
    for p in match["pills"]:
        assert set(p.keys()) <= {
            "source_code",
            "label",
            "value",
            "verified",
            "source_url",
        }
    assert "slug" not in match
    assert "id" not in match
    assert "phone" not in match
    assert "email" not in match


def test_0098_pins_facility_of_or_for_rez74() -> None:
    from pathlib import Path

    text = (
        Path(__file__).resolve().parents[2]
        / "supabase"
        / "migrations"
        / "0098_facility_panel_address_pill_rsc.sql"
    ).read_text(encoding="utf-8")
    assert "facility_of is not null" in text
    assert "parent.is_published = true" in text
    assert "revoke select on public.v_supplier_addresses_direct" in text
    assert "revoke select on public.v_supplier_registry_ids_direct" in text
    assert "order by va.address_kind" in text
