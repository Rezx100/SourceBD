"""A BGMEA record's register decides factory or buying house, never the source code.

BGMEA keeps two registers: general members make garments, associate members
are buying houses. The loader once stamped "buying_house" on any row BGMEA
touched, and 519 manufacturers were shown as buying houses on production
(ops/plans/bgmea-entity-type.md).
"""
from __future__ import annotations

import pytest

from etl.core.scraper import ScrapedRecord
from etl.core.upsert import _apply_source_specific, _entity_type_for, upsert_supplier_with_source
from etl.tests.conftest import FakeCursor
from ops.report_bgmea_entity_type import bgmea_standing, build

GENERAL, ASSOCIATE = "general_manufacturer", "associate_buying_house"


def _bgmea(member_type: str | None, **kw) -> ScrapedRecord:
    payload = {"bgmea_reg_number": "5729"}
    if member_type:
        payload["bgmea_member_type"] = member_type
    ref = "5729" if member_type == ASSOCIATE else "general:5729"
    return ScrapedRecord(source_code="BGMEA", source_ref=ref, company_name="Arbella Fashion Ltd.",
                         payload=payload, **kw)


# ------------------------------------------------------------------ loader ----
@pytest.mark.parametrize(
    ("member_type", "want"),
    [(GENERAL, "factory"), (ASSOCIATE, "buying_house"), (None, "unknown"), ("something_new", "unknown")],
)
def test_the_register_decides_the_default(member_type, want):
    assert _entity_type_for(_bgmea(member_type)) == want


def test_other_registers_keep_their_default():
    assert _entity_type_for(ScrapedRecord(source_code="BKMEA", source_ref="1", company_name="A")) == "factory"
    assert _entity_type_for(ScrapedRecord(source_code="GOTS", source_ref="1", company_name="A")) == "unknown"


@pytest.mark.parametrize(("member_type", "want"), [(GENERAL, "factory"), (ASSOCIATE, "buying_house")])
def test_a_new_supplier_takes_its_type_from_the_register(patched_db, member_type, want):
    """The row the loader inserts, for a record that names no type itself."""
    cur = FakeCursor()
    patched_db(cur)
    upsert_supplier_with_source(_bgmea(member_type))
    inserts = [p for s, p in cur.executed if "insert into public.suppliers" in s]
    assert len(inserts) == 1
    assert inserts[0][3] == want  # entity_type is the fourth column of the insert


def test_a_record_naming_its_type_still_wins(patched_db):
    cur = FakeCursor()
    patched_db(cur)
    upsert_supplier_with_source(_bgmea(ASSOCIATE, entity_type="factory"))
    assert next(p for s, p in cur.executed if "insert into public.suppliers" in s)[3] == "factory"


@pytest.mark.parametrize(("member_type", "want"), [(GENERAL, "factory"), (ASSOCIATE, "buying_house")])
def test_a_row_with_no_type_is_upgraded_by_the_register(monkeypatch, member_type, want):
    """The 3 Aug 2026 path: a row created with no type, then re-scraped."""
    monkeypatch.setattr("etl.core.upsert.get_source_id", lambda code: "src-bgmea")
    cur = FakeCursor()
    _apply_source_specific(cur, supplier_id="sup-1", rec=_bgmea(member_type))
    updates = [s for s, _ in cur.executed if "update public.suppliers" in s]
    assert len(updates) == 1
    assert f"entity_type = case when entity_type = 'unknown' then '{want}' else entity_type end" in updates[0]


def test_a_general_record_never_writes_buying_house(monkeypatch):
    monkeypatch.setattr("etl.core.upsert.get_source_id", lambda code: "src-bgmea")
    cur = FakeCursor()
    _apply_source_specific(cur, supplier_id="sup-1", rec=_bgmea(GENERAL))
    assert not any("'buying_house'" in s for s, _ in cur.executed)


# ------------------------------------------------------------------ report ----
def _supplier(sid: str, entity_type: str = "buying_house", **kw) -> dict:
    return {"id": sid, "slug": sid, "company_name": sid.title(), "entity_type": entity_type,
            "is_published": True, "claimed_by": None, "facility_of": None, "bgmea_reg_numbers": [], **kw}


def _entry(sid: str, ref: str, member_type: str | None, status: str = "active") -> dict:
    return {"supplier_id": sid, "source_ref": ref, "status": status, "member_type": member_type}


def test_standing_reads_the_registers():
    assert bgmea_standing([_entry("a", "general:1", GENERAL)], []) == "general only"
    assert bgmea_standing([_entry("a", "7", ASSOCIATE)], []) == "associate only"
    assert bgmea_standing([_entry("a", "general:1", GENERAL), _entry("a", "7", ASSOCIATE)], []) == "both"
    assert bgmea_standing([], []) == "no BGMEA entry"
    assert bgmea_standing([_entry("a", "member:1", None)], []) == "no register named"
    assert bgmea_standing([_entry("a", "general:1", GENERAL, status="superseded")], []) == "no BGMEA entry"


def test_any_sign_of_the_associate_register_keeps_a_buying_house():
    general = _entry("a", "general:1", GENERAL)
    # A retired associate entry, an associate number or an old bare number on the row.
    assert bgmea_standing([general, _entry("a", "7", ASSOCIATE, status="superseded")], []) == "both"
    assert bgmea_standing([general], ["associate:7"]) == "both"
    assert bgmea_standing([general], ["7"]) == "both"
    assert bgmea_standing([general], ["general:1"]) == "general only"


def test_only_a_manufacturer_entry_alone_is_fixed():
    suppliers = [
        _supplier("wrong"),                             # the defect
        _supplier("real"),                              # holds the associate entry
        _supplier("mixed"),                             # holds both: a buying house that also makes
        _supplier("locked"),                            # a person set the type
        _supplier("claimed", claimed_by="user-1"),      # the company speaks for itself
        _supplier("factory", entity_type="factory"),    # already right
        _supplier("trader"),                            # buying house from another source
    ]
    records = [
        _entry("wrong", "general:1", GENERAL),
        _entry("real", "7", ASSOCIATE),
        _entry("mixed", "general:2", GENERAL), _entry("mixed", "8", ASSOCIATE),
        _entry("locked", "general:3", GENERAL),
        _entry("claimed", "general:4", GENERAL),
        _entry("factory", "general:5", GENERAL),
    ]
    out = build(suppliers, records, locks=[{"supplier_id": "locked"}])
    assert [r["id"] for r in out["fix"]] == ["wrong"]
    assert {r["id"]: r["why"] for r in out["ask"]} == {
        "locked": "type locked by a person", "claimed": "claimed by the company"}
    assert out["stays"] == 2
    assert [r["id"] for r in out["buying_house_without_a_register"]] == ["trader"]
    assert sum(row["suppliers"] for row in out["table"]) == len(suppliers)
