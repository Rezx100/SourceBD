import httpx
import pytest

from ops import volza_live_sample as ls


def _live(cap, spent_before, handler):
    http = httpx.Client(base_url=ls.BASE, transport=httpx.MockTransport(handler))
    v = ls.Live(cap, spent_before, http=http)
    v.last = -1e9
    return v


def _ok(remaining="2999.850", records=1):
    return lambda req: httpx.Response(
        200, headers={"X-Credit-Remaining": remaining},
        json={"api_summary": {"count_of_shipments": 5}, "api_records": [{}] * records})


def test_asks_for_one_record_only(monkeypatch):
    monkeypatch.setattr(ls, "MIN_GAP", 0)
    seen = {}

    def handler(req):
        seen.update(__import__("json").loads(req.content))
        return _ok()(req)

    _live(30, 0, handler).exports("Square Fashions")
    assert seen["max_count_per_page"] == 1
    assert (seen["start_date"], seen["end_date"]) == ls.WINDOW


def test_stops_before_a_call_that_could_pass_the_cap(monkeypatch):
    monkeypatch.setattr(ls, "MIN_GAP", 0)
    v = _live(30, 29.90, _ok())
    with pytest.raises(ls.Stop, match="cap reached"):
        v.exports("Square Fashions")
    assert v.calls == 0


def test_header_spend_counts_toward_the_cap(monkeypatch):
    monkeypatch.setattr(ls, "MIN_GAP", 0)
    v = _live(30, 0, _ok(remaining="2970.00"))  # $30 already gone by Volza's count
    v.exports("Square Fashions")
    with pytest.raises(ls.Stop, match="cap reached"):
        v.exports("Square Fashions")


def test_more_records_than_asked_stops(monkeypatch):
    monkeypatch.setattr(ls, "MIN_GAP", 0)
    with pytest.raises(ls.Stop, match="records"):
        _live(30, 0, _ok(records=5)).exports("Square Fashions")


def test_cap_cannot_be_raised_above_approval(monkeypatch):
    monkeypatch.setattr("sys.argv", ["x", "--apply", "--max-spend", "31"])
    with pytest.raises(SystemExit, match="approved"):
        ls.main()
