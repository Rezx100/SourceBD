"""ETL freshness S6: a brand list read twice in a row is unchanged."""
from __future__ import annotations

from etl.core.hold import record_from_payload, record_payload
from etl.core.scraper import ScrapedRecord
from etl.scrapers.brand_disclosures import _DISCLOSURE_VOLATILE


def _brand(day: str, mirror: str) -> ScrapedRecord:
    return ScrapedRecord(
        source_code="BRAND_MS", source_ref="osh-1", company_name="Acme Ltd",
        payload={"brand": "BRAND_MS", "disclosure_date": day, "fetched_at": day,
                 "mirror_url": mirror, "address": "Plot 1, Gazipur"},
        hash_exclude=_DISCLOSURE_VOLATILE,
    )


def test_todays_date_and_the_mirror_path_are_not_a_change():
    a = _brand("2026-10-06", "https://cdn/brand-disclosures/brand_ms/2026-10-06.json")
    b = _brand("2026-10-07", "https://cdn/brand-disclosures/brand_ms/2026-10-07.json")
    assert a.hash() == b.hash()


def test_a_real_change_still_is():
    a = _brand("2026-10-06", "m")
    b = _brand("2026-10-06", "m")
    b.payload["address"] = "Plot 2, Gazipur"
    assert a.hash() != b.hash()


def test_the_exclusion_survives_a_held_record_replay():
    rec = _brand("2026-10-06", "m")
    assert record_from_payload(record_payload(rec)) == rec
