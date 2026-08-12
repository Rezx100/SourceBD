"""RPC-boundary guard for Review-queue release (0102).

Skip when the database URL is unset or migration 0102 is not applied.
Does not mutate: calls admin_queue_release_plan only.
"""
from __future__ import annotations

import os

import httpx
import pytest

pytestmark = pytest.mark.skipif(
    not (os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_SERVICE_ROLE_KEY")),
    reason="SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set",
)

VALUKA_QUEUE = "7025396b-c7e0-4b59-a228-9186d31b9568"
LIZ_MOTHER = "55c13ea8"


def _rpc(name: str, payload: dict) -> httpx.Response:
    base = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return httpx.post(
        f"{base}/rest/v1/rpc/{name}",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=60.0,
    )


def test_release_plan_rpc_exists_or_skip() -> None:
    r = _rpc("admin_queue_release_plan", {"p_queue_id": VALUKA_QUEUE})
    if r.status_code == 404 or "PGRST202" in r.text:
        pytest.skip("0102 admin_queue_release_plan not applied")
    r.raise_for_status()
    plan = r.json()
    assert plan["action"] == "attach_facility"
    assert str(plan["parent_id"]).startswith(LIZ_MOTHER[:8])
