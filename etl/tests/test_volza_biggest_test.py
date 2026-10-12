from ops import volza_biggest_test as bt


def _rec(date, buyer, product, value, country="Uruguay", kg=10.0):
    return {"shipment_date": f"{date}T00:00:00", "buyer_name": buyer, "destination_country": country,
            "product_description": product, "trade_value_usd": value, "gross_weight_kg": kg}


def test_consignments_of_one_order_become_one_line():
    lines = bt.merge([
        _rec("2026-08-31", "H M Hennes Mauritz Uruguay S A", "BOYS WOVEN TROUSER= 124 PACK", 1137.0),
        _rec("2026-08-31", "H M HENNES MAURITZ URUGUAY S A", "Boys  woven trouser", 113.0),
        _rec("2026-08-31", "H M Hennes Mauritz Uruguay S A", "BABIES BOYS WOVEN TROUSER", 646.0),
    ])
    assert [(x["consignments"], x["trade_value_usd"]) for x in lines] == [(2, 1250.0), (1, 646.0)]
    assert lines[0]["gross_weight_kg"] == 20.0


def test_another_day_buyer_or_destination_is_another_order():
    lines = bt.merge([
        _rec("2026-08-31", "Zara", "T-SHIRT", 500.0),
        _rec("2026-08-30", "Zara", "T-SHIRT", 400.0),
        _rec("2026-08-31", "Next", "T-SHIRT", 300.0),
        _rec("2026-08-31", "Zara", "T-SHIRT", 200.0, country="Spain"),
    ])
    assert [x["trade_value_usd"] for x in lines] == [500.0, 400.0, 300.0, 200.0]


def test_asks_for_the_biggest_of_the_last_six_months_by_the_suppliers_own_search():
    exact = {"supplier_name": ["Utah Fashions Ltd"], "supplier_name_search_type": "exact", "sort_by": "date",
             "sort_order": "DESC"}
    f = bt.filters({"calls": [{"kind": "preview", "filters": {}}, {"kind": "exact", "filters": exact}],
                    "matched_variant": "Utah"})
    assert f["supplier_name"] == ["Utah Fashions Ltd"] and f["supplier_name_search_type"] == "exact"
    assert (f["sort_by"], f["sort_order"]) == ("trade_value_usd", "DESC")
    assert (f["start_date"], f["end_date"]) == (bt.SINCE, bt.WINDOW[1])
    assert f["remove_duplicate_shipments"] is True
    assert bt.filters({"calls": [], "matched_variant": "Aboni"})["supplier_name"] == ["Aboni"]
