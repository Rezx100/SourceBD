"""RPC-boundary guard for Review-queue release (0102).

Skip when the database URL is unset. If credentials are set, a missing 0102
is a failure when SOURCEBD_REQUIRE_QUEUE_RPC=1; otherwise skip.
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
MARK_FASHION_QUEUE = "a5c7886c-ce38-4bfc-b749-4ccd02ddafa2"
HURRICANE_QUEUE = "ae1935ab-2672-4928-8188-28afc04c7eff"
HURRICANE_CHILD = "ed35695c"
HURRICANE_MOTHER = "766d04d7"
SHAFPUR_QUEUE = "aefbd03e-17e7-4876-a3db-d6b035722bd5"


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


def _plan(queue_id: str) -> dict:
    r = _rpc("admin_queue_release_plan", {"p_queue_id": queue_id})
    missing = r.status_code == 404 or "PGRST202" in r.text
    if missing:
        if os.environ.get("SOURCEBD_REQUIRE_QUEUE_RPC") == "1":
            pytest.fail("0102 admin_queue_release_plan missing on the configured database")
        pytest.skip("0102 admin_queue_release_plan not applied")
    r.raise_for_status()
    return r.json()


def test_release_plan_rpc_exists_or_skip() -> None:
    plan = _plan(VALUKA_QUEUE)
    assert plan["action"] == "attach_facility"
    assert str(plan["parent_id"]).startswith(LIZ_MOTHER[:8])


def test_mark_fashion_u2_is_not_keep_separate() -> None:
    plan = _plan(MARK_FASHION_QUEUE)
    assert plan["action"] == "needs_human"


def test_hurricane_member_ids_exclude_mother() -> None:
    plan = _plan(HURRICANE_QUEUE)
    assert plan["action"] == "attach_facility"
    members = [str(x) for x in (plan.get("member_ids") or [])]
    assert any(m.startswith(HURRICANE_CHILD) for m in members)
    assert not any(m.startswith(HURRICANE_MOTHER) for m in members)


def test_shafipur_brand_attaches_to_liz() -> None:
    plan = _plan(SHAFPUR_QUEUE)
    assert plan["action"] == "attach_facility"
    assert str(plan["parent_id"]).startswith(LIZ_MOTHER[:8])
