import json

import httpx
import pytest

from ops import volza_live_sample as ls


@pytest.fixture(autouse=True)
def _no_wait(monkeypatch):
    monkeypatch.setattr(ls, "MIN_GAP", 0)
    monkeypatch.setattr(ls.time, "sleep", lambda s: None)


def _live(handler, cap=30, spent_before=0.0, start_used=None):
    http = httpx.Client(base_url=ls.BASE, transport=httpx.MockTransport(handler))
    return ls.Live(cap, spent_before, http=http, start_used=start_used)


def _ok(used="0.150", records=1, status=200):
    return lambda req: httpx.Response(
        status, headers={"X-Credit-Used": used},
        json={"api_summary": {"count_of_shipments": 5}, "api_records": [{}] * records})


def test_asks_for_one_record_only_in_the_live_window():
    seen = {}

    def handler(req):
        seen.update(json.loads(req.content))
        return _ok()(req)

    _live(handler, start_used=0.0).exports("Square Fashions")
    assert seen["max_count_per_page"] == 1
    assert (seen["start_date"], seen["end_date"]) == ls.WINDOW


def test_stops_before_a_call_that_could_pass_the_cap():
    v = _live(_ok(), spent_before=29.90)
    with pytest.raises(ls.Stop, match="cap reached"):
        v.exports("Square Fashions")
    assert v.calls == 0


def test_account_counter_counts_toward_the_cap():
    v = _live(_ok(used="29.900"))  # no pre-run reading: measured from zero, so this counts as spent
    v.exports("Square Fashions")
    with pytest.raises(ls.Stop, match="cap reached"):
        v.exports("Square Fashions")


def test_a_call_costing_more_than_the_worst_case_stops_from_the_first_call():
    v = _live(_ok(used="26.000"), start_used=25.20)
    with pytest.raises(ls.Stop, match="one call cost"):
        v.exports("Square Fashions")
    assert v.spent == pytest.approx(0.80)


def test_more_records_than_asked_stops():
    with pytest.raises(ls.Stop, match="records"):
        _live(_ok(records=5), start_used=0.0).exports("Square Fashions")


@pytest.mark.parametrize("handler", [
    _ok(status=502),
    lambda req: (_ for _ in ()).throw(httpx.ReadTimeout("slow", request=req)),
])
def test_server_and_network_errors_count_the_worst_case_and_stop(handler):
    v = _live(handler, start_used=0.0)
    with pytest.raises(ls.Stop):
        v.exports("Square Fashions")
    assert v.spent == pytest.approx(ls.WORST_CALL)


def test_cap_cannot_be_raised_above_approval(monkeypatch):
    monkeypatch.setattr("sys.argv", ["x", "--apply", "--max-spend", "31"])
    with pytest.raises(SystemExit, match="approved"):
        ls.main()
