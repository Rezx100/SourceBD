"""REZ-109 — pin migration 0098 facility panel address/pill/RSC relaxations."""
from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
MIGRATION = REPO / "supabase" / "migrations" / "0098_facility_panel_address_pill_rsc.sql"


def test_0098_relaxes_direct_views_and_enriches_panel() -> None:
    text = MIGRATION.read_text(encoding="utf-8")
    assert MIGRATION.is_file()
    assert "facility_of is not null" in text
    assert "parent.is_published = true" in text
    assert "v_supplier_addresses_direct" in text
    assert "v_supplier_registry_ids_direct" in text
    assert "rsc_remediation" in text
    assert "'addresses'" in text
    assert "'pills'" in text
    assert "'rsc'" in text
    assert "revoke select on public.v_supplier_registry_ids_direct" in text
    # Stay off the abandoned buyer_supplier_profile mega-rewrite.
    assert "create or replace function public.buyer_supplier_profile" not in text
    assert "execute format" not in text.lower()
