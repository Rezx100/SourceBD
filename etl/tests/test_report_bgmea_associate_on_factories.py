"""Whose buying-house entry is it? The suggestions on the founder's page.

The first cut called "Otto Connection Ltd." the own name of Cotton Connection
Ltd. and "Fashion Tex International" the own name of Fashion Tex Ltd.; only an
identical name is the company's own.
"""
from __future__ import annotations

from ops.report_bgmea_associate_on_factories import build, page_data, same_name

SOURCES = [{"id": "s-bgmea", "code": "BGMEA"}, {"id": "s-bkmea", "code": "BKMEA"}, {"id": "s-rsc", "code": "RSC"}]


def _supplier(sid: str, name: str, **kw) -> dict:
    return {"id": sid, "slug": sid, "company_name": name, "is_published": True, "district": "Dhaka",
            "employees_total": None, "machines_sewing": None, **kw}


def _entry(sid: str, ref: str, **fields) -> dict:
    return {"supplier_id": sid, "source_id": "s-bgmea", "source_ref": ref, "status": "active",
            "fields": {"bgmea_member_type": "associate_buying_house", **fields}}


def _other(sid: str, source: str, ref: str, **fields) -> dict:
    return {"supplier_id": sid, "source_id": source, "source_ref": ref, "status": "active", "fields": fields}


def _names(**by_ref: str) -> dict:
    return {ref.lstrip("r"): {"name": name, "register": "associate", "email": None} for ref, name in by_ref.items()}


def test_only_an_identical_name_is_the_companys_own():
    assert same_name("MGB METRO GROUP BUYING HK LTD.", "MGB Metro Group Buying HK Ltd.")
    assert not same_name("COTTON CONNECTION LTD.", "Otto Connection Ltd.")
    assert not same_name("FASHION TEX LTD.", "Fashion Tex International")
    assert not same_name("Ags Apparels Ltd", None)


def test_suggestions():
    pull = {
        "sources": SOURCES,
        "namesakes": [{"slug": "al-baraka-trading", "company_name": "Al-Baraka Trading", "is_published": True}],
        "suppliers": [
            _supplier("office", "Tekstil Fashion", employees_total=9),
            _supplier("maker", "Hams Washing & Dyeing Ltd", employees_total=460),
            _supplier("inspected", "Shanta Washworks Limited"),
            _supplier("foreign", "Al-Baraka Apparels", machines_sewing=76),
            _supplier("arm", "Color City Ltd."),
            _supplier("close", "Fashion Tex Ltd."),
        ],
        "records": [
            _entry("office", "845"),
            _entry("maker", "646"),
            _entry("inspected", "1615"), _other("inspected", "s-rsc", "9"),
            _entry("foreign", "504", raw_address="Baridhara, Dhaka"),
            _entry("arm", "687", raw_tel="9887766"), _other("arm", "s-bkmea", "1", bkmea_owner_mobile="02-9887766"),
            _entry("close", "699"),
        ],
    }
    names = _names(r845="Tekstil Fashion", r646="Hams Washing & Dyeing Ltd.", r1615="Shanta Washworks Limited",
                   r504="Al-Baraka Trading", r687="Atelier Sourcing Ltd.", r699="Fashion Tex International")
    rows = {r["slug"]: r for r in build(pull, names)}

    assert rows["office"]["suggest"] == "tag"          # its own entry, nothing says it makes garments
    assert rows["maker"]["suggest"] == "leave"         # its own entry, 460 workers
    assert rows["inspected"]["suggest"] == "leave"     # its own entry, a safety register behind it
    assert rows["foreign"]["suggest"] == "move"        # another company, nothing ties it here
    assert rows["foreign"]["home"] == {"slug": "al-baraka-trading", "name": "Al-Baraka Trading"}
    assert rows["arm"]["suggest"] == "leave"           # another name, but BKMEA's phone ties it
    assert rows["arm"]["ties"]
    assert rows["close"]["suggest"] == "leave" and rows["close"]["near_name"] and not rows["close"]["same_name"]

    page = page_data(list(rows.values()))
    assert [len(g["items"]) for g in page] == [3, 3]   # another name (incl. close), then own name
    assert sorted(it["n"] for g in page for it in g["items"]) == [1, 2, 3, 4, 5, 6]
