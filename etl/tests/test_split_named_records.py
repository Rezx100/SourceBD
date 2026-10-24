"""ops/split_named_records.py: a split takes the other company's own values off the old profile (24 Oct 2026)."""

from __future__ import annotations

from typing import Any

from ops.split_named_records import unproject

CODES = {"src-bgmea": "BGMEA", "src-bkmea": "BKMEA"}


class FakeRest:
    def __init__(self, records: list[dict], profile: dict) -> None:
        self.records, self.profile, self.patches = records, profile, []

    def all_rows(self, path: str, params: dict[str, str]) -> list[dict]:
        return self.records if path == "source_records" else []

    def one(self, path: str, params: dict[str, str]) -> dict[str, Any] | None:
        return self.profile if path == "suppliers" else None

    def patch(self, path: str, params: dict[str, str], body: dict) -> list[dict]:
        self.patches.append(body)
        return [body]


def test_moved_records_values_leave_the_old_profile_and_shared_ones_stay():
    sunny = {"id": "r-sunny", "source_id": "src-bgmea", "fields": {
        "established_date": "2018-06-06", "factory_phone": "01727306438",
        "factory_types": [{"Type": "Sweater"}, {"Type": "Knit"}], "principal_products": ["Sweater"]}}
    funny = {"id": "r-funny", "source_id": "src-bkmea", "fields": {"bkmea_products": ""}}
    rest = FakeRest([sunny, funny], {
        "factory_types": ["Knit", "Sweater"], "principal_products": ["Sweater"], "established_date": "2018-06-06",
        "address_raw": "Siddhirganj", "email_primary": "funnysweater@gmail.com",
        "phones": ["+8801720051685", "+8801727306438"]})
    unproject(rest, "host", [("BGMEA", sunny)], CODES, apply=True)
    body = rest.patches[0]
    assert body["factory_types"] == ["Knit"]  # Funny's own BKMEA record still says Knit
    assert body["principal_products"] == [] and body["established_date"] is None
    assert body["phones"] == ["+8801720051685"]
    assert "address_raw" not in body and "email_primary" not in body  # never came from the moved record
