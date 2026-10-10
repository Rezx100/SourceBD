import httpx
import pytest

from ops import volza_export_dryrun as vz


def test_search_name_drops_legal_suffix_keeps_short_names_whole():
    assert vz.search_name("Square Fashions Ltd.") == "Square Fashions"
    assert vz.search_name("Ha-Meem Denim (Pvt.) Limited") == "Ha-Meem Denim"
    # Volza rejects supplier_name under 4 characters, so the suffix stays on
    assert vz.search_name("DBL Ltd") == "DBL Ltd"
    # live sample misses, 10 Oct 2026: a broken bracket and a glued suffix found nothing
    assert vz.search_name("ASCO FASHIONS LTD. (FOR UD)") == "ASCO FASHIONS"
    assert vz.search_name("Global Profit Garment (Bangladesh) Co., Ltd.") == "Global Profit Garment"
    assert vz.search_name("Blue-Bell Knitting & Processing Inds.Ltd") == "Blue-Bell Knitting & Processing Inds"


def test_classify_flags_names_that_sweep_in_other_exporters():
    assert vz.classify("Epyllion Ltd", "Epyllion Style Ltd", 1538, 3) == "ambiguous"
    assert vz.classify("Square Fashions Ltd", "Square Fashions Limited", 2254, 1) == "exact"
    assert vz.classify("Ha-Meem Group", "Ha-Meem Apparels Ltd.", 8, 1) == "likely"
    assert vz.classify("Nobody Ltd", None, 0, 0) == "none"


@pytest.mark.parametrize("second,status", [({"X-Credit-Used": "1.400"}, 200), ({}, 402)])
def test_any_credit_spent_stops_the_run(monkeypatch, second, status):
    # the header is the account total: 1.250 already spent by a live run is the baseline
    monkeypatch.setenv("VOLZA_SANDBOX_KEY", "test")
    monkeypatch.setattr(vz, "MIN_GAP", 0)
    replies = iter([httpx.Response(200, headers={"X-Credit-Used": "1.250"}, json={}),
                    httpx.Response(status, headers=second, json={})])
    v = vz.Volza()
    v.http = httpx.Client(base_url=vz.BASE, transport=httpx.MockTransport(lambda req: next(replies)))
    v.exports("Square Fashions")
    with pytest.raises(SystemExit, match="credit used"):
        v.exports("Square Fashions")


def test_zero_credit_passes(monkeypatch):
    monkeypatch.setenv("VOLZA_SANDBOX_KEY", "test")
    monkeypatch.setattr(vz, "MIN_GAP", 0)
    v = vz.Volza()
    v.http = httpx.Client(base_url=vz.BASE, transport=httpx.MockTransport(
        lambda req: httpx.Response(200, headers={"X-Credit-Used": "0.000"},
                                   json={"api_summary": {"count_of_shipments": 3}})))
    assert vz.shipments(v.exports("Square Fashions")[1]) == 3
