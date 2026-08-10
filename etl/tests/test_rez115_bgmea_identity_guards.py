"""Unit pins for REZ-115 identity rules in the conflation detector."""

from __future__ import annotations

from pathlib import Path

from ops.check_supplier_conflations import (
    BGMEA_DISPLAY_COLLISION_SQL,
    BGMEA_IDENTITY_SQL,
)


def test_identity_sql_flags_bare_and_colliding_stored_identities():
    assert "bgmea_reg_numbers" in BGMEA_IDENTITY_SQL
    assert "general|associate" in BGMEA_IDENTITY_SQL
    assert "is_published = true" in BGMEA_IDENTITY_SQL


def test_display_collision_sql_uses_register_labels():
    assert "BGMEA General member #" in BGMEA_DISPLAY_COLLISION_SQL
    assert "BGMEA Associate member #" in BGMEA_DISPLAY_COLLISION_SQL
    assert "v_supplier_registry_ids_direct" in BGMEA_DISPLAY_COLLISION_SQL


def test_backfill_script_exists():
    path = Path(__file__).resolve().parents[2] / "ops" / "backfill_bgmea_reg_identities.py"
    assert path.is_file()
    text = path.read_text(encoding="utf-8")
    assert "identity_from_member_type" in text
    assert "--apply" in text
