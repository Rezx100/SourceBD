"""The Volza card says "latest shipment" only when the stored record is the latest one."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "ops"))

from volza_load_sample import record_sort, shown_class  # noqa: E402

LATEST = {"supplier_name": ["X"], "sort_by": "date", "sort_order": "DESC"}


def test_row_fetched_after_founders_yes_holds_latest_shipment():
    # 11 Oct 2026: the nine yeses were loaded as "value" and labelled as the biggest shipment
    r = {"calls": [{"kind": "review:all", "filters": LATEST}, {"kind": "market:UK", "filters": {}}]}
    assert record_sort(r) == "date"


def test_preview_sorted_by_value_stays_value():
    assert record_sort({"calls": [{"kind": "preview", "filters": {"supplier_name": ["X"]}}]}) == "value"


def test_yes_overrides_the_90_percent_rule():
    r = {"class": "exact", "review": "exact", "tried": [["X", 200, 207, 3], ["exact:X", 200, 98, 2]]}
    assert shown_class(r) == "exact"
    assert shown_class({**r, "review": None}) == "ambiguous"
