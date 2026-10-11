"""Tradeline (ops/tradeline.py): what the Volza card says, and the request pace that keeps under Volza's limit."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "ops"))

import volza_live_sample  # noqa: E402
from volza_load_sample import one_country_markets, record_sort, shown_class  # noqa: E402

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


def test_one_country_supplier_gets_its_markets_free():
    r = {"shipments": 277, "fob_usd": 5.0, "buyers": 3, "top": {"destination_country": "Spain"},
         "summary": {"count_of_unique_destination_countries": 1}}
    m = one_country_markets(r)
    assert m["EU"]["shipments"] == 277 and m["United States"]["shipments"] == 0
    assert one_country_markets({**r, "top": {"destination_country": "Japan"}})["EU"]["shipments"] == 0
    assert one_country_markets({**r, "summary": {"count_of_unique_destination_countries": 2}}) is None


def test_run_stops_before_using_the_buyers_daily_share():
    # 11 Oct 2026: batch 2 used Volza's 1,000 requests a day and every buyer's reveal failed
    v = volza_live_sample.Live(100.0, 0.0, http=object())
    v.daily_left = volza_live_sample.DAILY_RESERVE
    try:
        v.search({"supplier_name": ["X"]})
    except volza_live_sample.Stop as e:
        assert "buyers" in str(e)
    else:
        raise AssertionError("searched into the reserve")


def test_pace_never_sends_more_than_40_in_a_minute(monkeypatch):
    clock = [0.0]
    monkeypatch.setattr(volza_live_sample.time, "monotonic", lambda: clock[0])
    monkeypatch.setattr(volza_live_sample.time, "sleep", lambda s: clock.__setitem__(0, clock[0] + s))
    v = volza_live_sample.Live(1.0, 0.0, http=object())
    sent = []
    for _ in range(200):
        v._pace()
        sent.append(clock[0])
    assert max(sum(1 for t in sent if s <= t < s + 60) for s in sent) <= volza_live_sample.PER_MINUTE < 50
