"""Tradeline (ops/tradeline.py): what the Volza card says, and the request pace that keeps under Volza's limit."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "ops"))

import volza_launch  # noqa: E402
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


def test_plan_skips_suppliers_already_in_production(monkeypatch, tmp_path):
    # 22 Oct 2026: the raw files went missing; the plan must not pay again for what production holds
    cands = tmp_path / "candidates.json"
    cands.write_text('[{"id": "a", "slug": "a", "company_name": "Alpha Knit", "epb_6162": true},'
                     ' {"id": "b", "slug": "b", "company_name": "Beta Wear", "epb_6162": true}]')
    monkeypatch.setattr(volza_launch, "RAW", tmp_path)
    monkeypatch.setattr(volza_launch, "CANDIDATES", cands)
    monkeypatch.setattr(volza_launch, "decisions", dict)
    monkeypatch.setattr(volza_launch, "newest", dict)
    monkeypatch.setattr(volza_launch, "checked_in_production", lambda: {"a"})
    assert [r["id"] for r in volza_launch.plan()] == ["b"]


def test_saved_rows_keep_each_paid_supplier_once_and_drop_expired(tmp_path):
    # 22 Oct 2026: what was paid for goes to the server (0156); a resumed run's partial line never does
    import tradeline

    f = tmp_path / "launch_2026-10-22.jsonl"
    f.write_text('{"id": "a", "partial": true, "fetched_at": "2026-10-22T07:44:16+00:00"}\n'
                 '{"id": "a", "shipments": 3, "fetched_at": "2026-10-22T07:45:00+00:00"}\n'
                 '{"id": "b", "partial": true, "fetched_at": "2026-10-22T07:46:00+00:00"}\n'
                 '{"id": "c", "shipments": 0, "fetched_at": "2024-01-01T00:00:00+00:00"}\n')
    rows = tradeline.kept_rows(f)
    assert [(r["supplier_id"], r["record"]["shipments"]) for r in rows] == [("a", 3)]
    assert rows[0]["results_file"] == f.name and rows[0]["expires_at"].startswith("2027-10-22")


def test_run_stops_just_before_the_daily_limit():
    # 23 Oct 2026: the founder dropped the 300 kept for reveals; a few stay so a run ends between suppliers
    assert 0 < volza_live_sample.DAILY_RESERVE <= 10
    v = volza_live_sample.Live(100.0, 0.0, http=object())
    v.daily_left = volza_live_sample.DAILY_RESERVE
    try:
        v.search({"supplier_name": ["X"]})
    except volza_live_sample.Stop as e:
        assert "tomorrow" in str(e)
    else:
        raise AssertionError("searched into the last requests of the day")


def test_paid_lookup_before_the_run_does_not_stop_the_first_search(monkeypatch):
    # 24 Oct 2026: the requests-left lookup cost $0.011 and the first $0.15 search read as $0.161, stopping the run
    class R:
        def __init__(self, used, status=200, body=None):
            self.status_code, self._body = status, body or {}
            self.headers = {"X-Credit-Used": str(used), "X-RateLimit-Remaining-Daily": "990",
                            "content-type": "application/json"}

        def json(self):
            return self._body

    class Http:
        def get(self, *a, **k):
            return R(100.011)

        def post(self, *a, **k):
            return R(100.161, body={"api_records": [{}]})

    monkeypatch.setattr(volza_live_sample.time, "sleep", lambda s: None)
    v = volza_live_sample.Live(10.0, 0.0, http=Http(), start_used=100.0)
    v.read_daily()
    status, _, cost = v.search({"supplier_name": ["X"]})
    assert status == 200 and abs(cost - 0.15) < 1e-9
    assert abs(v.spent - 0.161) < 1e-6  # the lookup still counts as spent


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
