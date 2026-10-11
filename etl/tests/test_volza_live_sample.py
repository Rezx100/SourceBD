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


def test_a_rate_limit_that_never_clears_stops_instead_of_returning_an_empty_result():
    v = _live(_ok(used="0.000", status=429), start_used=0.0)
    with pytest.raises(ls.Stop, match="429"):
        v.exports("Square Fashions")
    assert v.spent == 0


def test_the_worst_case_follows_the_records_asked_for():
    v = _live(_ok(records=10), spent_before=29.50, start_used=0.0)
    v.records = 10  # worst case $0.60: $29.50 + $0.60 passes the $30 cap
    with pytest.raises(ls.Stop, match="cap reached"):
        v.search({"supplier_name": ["Square Fashions"]})
    assert v.calls == 0


def test_loader_never_stores_a_failed_search_as_nothing_found():
    from datetime import datetime, timezone

    from ops import volza_load_sample as load

    base = {"shipments": 0, "suppliers": 0, "matched_variant": None, "volza_supplier": None, "class": "none"}
    recs = [{"id": "a", "name": "A", "tried": [["A", 400, 0, 0]], **base},
            {"id": "b", "name": "B", "tried": [["B", 200, 0, 0]], **base}]
    out = load.rows(recs, datetime(2026, 10, 11, tzinfo=timezone.utc))
    assert [r["supplier_id"] for r in out] == ["b"]


def test_filter_check_keeps_everything_volza_sent(tmp_path, monkeypatch):
    from ops import volza_filter_test as ft

    monkeypatch.setattr(ft, "OUT", tmp_path / "out.json")
    body = {"api_request_details": {"x": 1}, "api_summary": {"count_of_shipments": 2},
            "api_records": [{"buyer_name": "B"}], "api_pagination": {"next_cursor": "c"}}
    req = httpx.Request("POST", ls.BASE + "/bangladesh-exports", json={"supplier_name": ["A"]})
    r = httpx.Response(200, json=body, headers={"X-Credit-Used": "35.800"}, request=req)
    out = []
    ft.save(out, "t", {"supplier_name": ["A"]}, r)
    saved = json.loads(ft.OUT.read_text(encoding="utf-8"))[0]
    assert saved["response"] == body and saved["credit"] == {"x-credit-used": "35.800"}
    assert saved["sent"] == {"supplier_name": ["A"]}


def test_launch_narrows_a_swept_name_then_fetches_the_four_markets():
    from ops import volza_launch as vl

    sent = []

    def handler(req):
        body = json.loads(req.content)
        sent.append(body)
        exact = body.get("supplier_name_search_type") == "exact"
        summary = {"count_of_shipments": 9, "count_of_suppliers": 1 if exact else 2,
                   "count_of_unique_destination_countries": 3, "sum_of_trade_value_usd": 100.0, "count_of_buyers": 2,
                   "count_of_units": 1}
        return httpx.Response(200, headers={"X-Credit-Used": "0.000"}, json={
            "api_summary": summary, "api_records": [{"supplier_name": "Utah Fashions Ltd", "unit": "PCS"}]})

    v = _live(handler, start_used=0.0)
    row = {"id": "u", "slug": "utah", "name": "UTAH Fashions Ltd", "variants": ["UTAH Fashions"]}
    rec = vl.new_rec(row)
    vl.fetch(v, row, rec)
    assert rec["class"] == "exact" and not rec["partial"]
    assert [c["kind"] for c in rec["calls"]] == ["preview", "exact", "market:United Kingdom",
                                                 "market:United States", "market:EU", "market:Canada",
                                                 "small:under 1000 pcs"]
    assert sent[6]["quantity"] == {"operator": "lt", "value": 1000} and rec["small_orders"]["of"] == 9
    assert "Utah Fashions Ltd" in sent[1]["supplier_name"] and all(b["remove_duplicate_shipments"] for b in sent)
    assert sent[4]["destination_country_name"] == vl.EU and sent[4]["supplier_name_search_type"] == "exact"
    assert rec["cost"] == pytest.approx(7 * 0.15)


def test_launch_never_records_a_rejected_search_as_nothing_found():
    from ops import volza_launch as vl

    v = _live(lambda req: httpx.Response(400, json={"errors": {}}), start_used=0.0)
    row = {"id": "h", "slug": "h", "name": "H&M Knit", "variants": ["H&M Knit"]}
    rec = vl.new_rec(row)
    with pytest.raises(vl.Rejected):
        vl.fetch(v, row, rec)
    assert rec["partial"] and rec["tried"] == [] and rec["cost"] == 0


def test_launch_settles_a_held_swept_name_without_a_stored_summary():
    from ops import volza_launch as vl

    v = _live(lambda req: httpx.Response(200, headers={"X-Credit-Used": "0.000"}, json={
        "api_summary": {"count_of_shipments": 4568, "count_of_suppliers": 2, "count_of_unique_destination_countries": 1},
        "api_records": [{"supplier_name": "Utah Fashions Ltd"}]}), start_used=0.0)
    held = {"id": "u", "slug": "utah", "name": "UTAH Fashions Ltd", "class": "ambiguous", "shipments": 4568,
            "suppliers": 2, "matched_variant": "UTAH Fashions Ltd", "volza_supplier": "Utah Fashions Ltd",
            "fob_usd": 1.0, "buyers": 71, "top": {"supplier_name": "Utah Fashions Ltd"}}
    row = {"id": "u", "slug": "utah", "name": "UTAH Fashions Ltd", "held": held}
    rec = vl.new_rec(row)
    vl.fetch(v, row, rec)
    assert [c["kind"] for c in rec["calls"]] == ["exact"] and rec["class"] == "exact"


def test_loader_hides_an_exact_search_that_kept_too_little():
    from ops import volza_load_sample as load

    kept = {"class": "exact", "tried": [["Utah Fashions", 200, 4568, 2], ["exact:Utah Fashions", 200, 4568, 2]]}
    lost = {"class": "exact", "tried": [["Columbia Apparels Ltd", 200, 2468, 2], ["exact:Columbia Apparels Ltd", 200, 84, 1]]}
    plain = {"class": "exact", "tried": [["Hamza Clothing", 200, 406, 1]]}
    assert [load.shown_class(r) for r in (kept, lost, plain)] == ["exact", "ambiguous", "exact"]


def test_loader_keeps_markets_only_for_shown_rows_and_waits_for_the_column():
    from datetime import datetime, timezone

    from ops import volza_load_sample as load

    base = {"suppliers": 1, "volza_supplier": "Hamza Clothing Ltd", "fob_usd": 1.0, "buyers": 2, "top": {}}
    shown = {"id": "a", "name": "Hamza Clothing Ltd.", "class": "exact", "shipments": 406, "matched_variant": "Hamza Clothing",
             "tried": [["Hamza Clothing", 200, 406, 1]], "markets": {"EU": {"shipments": 236}},
             "small_orders": {"under_pcs": 1000, "shipments": 26, "of": 406}, **base}
    hidden = {**shown, "id": "b", "tried": [["Columbia Apparels Ltd", 200, 2468, 2], ["exact:Columbia Apparels Ltd", 200, 84, 1]]}
    out = load.rows([shown, hidden], datetime(2026, 10, 11, tzinfo=timezone.utc))
    assert out[0]["markets"] == {"EU": {"shipments": 236}} and out[0]["small_orders"]["shipments"] == 26
    assert out[1]["match_class"] == "ambiguous" and out[1]["markets"] is None

    http = httpx.Client(base_url="http://x", transport=httpx.MockTransport(lambda req: httpx.Response(400)))
    load.drop_missing_columns(http, out)
    assert "markets" not in out[0] and "small_orders" not in out[0]


def test_latest_records_are_marked_and_never_written_without_the_mark():
    from ops import volza_load_sample as load

    old = {"calls": [{"kind": "market:EU", "filters": {"supplier_name": ["X"]}}]}
    new_batch = {"calls": [{"kind": "preview", "filters": {"supplier_name": ["X"], "sort_by": "date"}}]}
    refetched = {**old, "top_is": "latest"}
    assert [load.record_sort(r) for r in (old, new_batch, refetched)] == ["value", "date", "date"]

    http = httpx.Client(base_url="http://x", transport=httpx.MockTransport(lambda req: httpx.Response(400)))
    with pytest.raises(SystemExit, match="0140"):
        load.drop_missing_columns(http, [{"record_sort": "date"}])
    rows = [{"record_sort": "value"}]
    load.drop_missing_columns(http, rows)
    assert rows == [{}]


def test_refetch_asks_for_the_latest_shipment_with_the_defining_search():
    from ops import volza_launch as vl

    sent = []

    def handler(req):
        sent.append(json.loads(req.content))
        return httpx.Response(200, headers={"X-Credit-Used": "0.000"}, json={
            "api_summary": {"count_of_shipments": 4568}, "api_records": [{"shipment_date": "2026-08-30T00:00:00"}]})

    exact = {"supplier_name": ["Utah Fashions Ltd"], "supplier_name_search_type": "exact", "sort_by": "date", "sort_order": "DESC"}
    r = {"name": "UTAH Fashions Ltd", "matched_variant": "UTAH Fashions", "shipments": 4568, "cost": 1.0,
         "calls": [{"kind": "exact", "filters": exact}], "top": {"shipment_date": "2024-12-18"}}
    new = vl.refetch_latest(_live(handler, start_used=0.0), r)
    assert sent[0]["supplier_name_search_type"] == "exact" and sent[0]["sort_by"] == "date"
    assert new["top"]["shipment_date"].startswith("2026-08-30") and new["top_is"] == "latest"
    assert new["calls"][-1]["kind"] == "latest" and new["cost"] == pytest.approx(1.15)
