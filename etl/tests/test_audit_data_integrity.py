"""ops/audit_data_integrity.py — where the site contradicts itself or a register.

Fixtures in, findings out. Each test is one contradiction a buyer's compliance
team could find on a company page, built from the smallest rows that show it,
beside the nearest clean case the check must leave alone.
"""
from __future__ import annotations

from datetime import date

from ops.audit_data_integrity import DISTRICTS, Data, contact_shapes, expected_completeness, former_name, run, same_company
from ops.audit_endpoints import OUT, _nil_args, check_dbapi, leaks_in_json, leaks_in_text

TODAY = date(2026, 10, 13)
SOURCES = [
    {"id": "s-bgmea", "code": "BGMEA", "tier": "tier2_industry"},
    {"id": "s-bkmea", "code": "BKMEA", "tier": "tier2_industry"},
    {"id": "s-btma", "code": "BTMA", "tier": "tier2_industry"},
    {"id": "s-rsc", "code": "RSC", "tier": "tier1_gov"},
    {"id": "s-oeko", "code": "OEKO_TEX", "tier": "tier3_cert"},
    {"id": "s-sa", "code": "SA8000", "tier": "tier3_cert"},
]


def supplier(sid: str, name: str, **over) -> dict:
    row = {
        "id": sid, "slug": sid, "company_name": name, "entity_type": "factory", "is_published": True, "facility_of": None,
        "district": "Gazipur", "address_raw": "Plot 5, Gazipur", "source_tags": [], "t13_source_count": 0, "completeness_pct": 9,
        "bgmea_reg_numbers": [], "updated_at": "2026-10-01", "created_at": "2026-01-01",
    }
    return {**row, **over}


def record(rid: str, sid: str, source: str, ref: str, read: str = "2026-10-10", **fields) -> dict:
    return {"id": rid, "supplier_id": sid, "source_id": source, "source_ref": ref, "status": "active", "fields": fields, "fetched_at": read}


def safety_row(sid: str, record_id: str, active: bool, workers: int | None = None) -> dict:
    return {"supplier_id": sid, "source_record_id": record_id, "active": active, "workers_count": workers, "progress_pct": 50}


def found(tables: dict, only: str) -> dict[str, dict]:
    tables = {"sources": SOURCES, **tables}
    return {f["id"]: f for f in run(tables, {only}, today=TODAY)}


def test_ineligible_factory_whose_page_says_no_record() -> None:
    """The page shows only safety rows marked active, so an Ineligible factory reads "no RSC record"."""
    out = found({
        "suppliers": [supplier("bad", "Minar Textile"), supplier("good", "Lumbini Ltd")],
        "records": [record("r1", "bad", "s-rsc", "23490", rsc_status_name="Ineligible", rsc_factory_name="Minar Textile"),
                    record("r2", "good", "s-rsc", "100", rsc_status_name="active", rsc_factory_name="Lumbini Ltd")],
        "rsc": [safety_row("bad", "r1", False), safety_row("good", "r2", True)],
    }, "RSC")
    assert out["S1a"]["examples"] == ["bad"]
    assert "1 of these pages say" in out["S1a"]["detail"]
    assert out["S1d"]["count"] == 1 and out["S1c"]["count"] == 0 and out["S1b"]["count"] == 0


def test_two_buildings_one_safety_row() -> None:
    """Two register entries, one row kept. Keeping the inactive one hides a good record; keeping
    the active one hides the other building's status."""
    def two(sid: str) -> list[dict]:
        return [record(f"{sid}-a", sid, "s-rsc", "1", rsc_status_name="Ineligible"),
                record(f"{sid}-b", sid, "s-rsc", "2", rsc_status_name="active")]

    out = found({
        "suppliers": [supplier("hides-good", "Civic Apparels"), supplier("hides-bad", "Eurotex Fashion")],
        "records": two("hides-good") + two("hides-bad"),
        "rsc": [safety_row("hides-good", "hides-good-a", False), safety_row("hides-bad", "hides-bad-b", True)],
    }, "RSC")
    assert out["S1c"]["examples"] == ["hides-good"]
    assert out["S1b"]["examples"] == ["hides-bad"]
    assert out["S1e"]["count"] == 2


def test_a_buildings_status_is_judged_on_its_companys_page() -> None:
    """A building has no page of its own: its Ineligible entry is a finding on the company that owns it."""
    out = found({
        "suppliers": [supplier("mother", "Apex Knit"), supplier("shed", "Apex Knit (Unit 2)", is_published=False, facility_of="mother")],
        "records": [record("r1", "mother", "s-rsc", "1", rsc_status_name="active"),
                    record("r2", "shed", "s-rsc", "2", rsc_status_name="Ineligible")],
        "rsc": [safety_row("mother", "r1", True), safety_row("shed", "r2", False)],
    }, "RSC")
    assert out["S1a"]["examples"] == ["mother"]
    assert "0 of these pages say" in out["S1a"]["detail"]  # the mother's own record is on the page
    assert out["S1b"]["examples"] == ["mother"]


def test_suspended_mill_shown_as_a_member() -> None:
    out = found({
        "suppliers": [supplier("mill", "N M Spinning"), supplier("fine", "Quality Spinning")],
        "records": [record("r1", "mill", "s-btma", "spinning-mills-under-suspension-52", btma_status="suspended", btma_sl_no="52"),
                    record("r2", "fine", "s-btma", "spinning-general-member-7", btma_sl_no="7")],
    }, "M")
    assert out["M1"]["examples"] == ["mill"]
    assert "1 of them are published on that entry alone" in out["M1"]["detail"]


def test_one_membership_number_on_two_companies() -> None:
    """BKMEA files each member twice (the number, and `N:detail`); that is one entry, not a shared one.
    A building beside its own company holds the number once."""
    out = found({
        "suppliers": [supplier("a", "Euphoria Textile"), supplier("b", "Euphoria Apparels Ltd"), supplier("solo", "Knit Garden"),
                      supplier("mother", "Apex Knit"), supplier("shed", "Apex Knit Unit 2", is_published=False, facility_of="mother")],
        "records": [record("r1", "a", "s-bkmea", "2129", bkmea_membership_no="2129 - A/2010"),
                    record("r2", "b", "s-bkmea", "900:detail", bkmea_membership_no="2129 - A/2010"),
                    record("r3", "solo", "s-bkmea", "511", bkmea_membership_no="511 - B/2001"),
                    record("r4", "solo", "s-bkmea", "640:detail", bkmea_membership_no="511 - B/2001"),
                    record("r5", "mother", "s-bkmea", "77", bkmea_membership_no="77 - A/1999"),
                    record("r6", "shed", "s-bkmea", "78:detail", bkmea_membership_no="77 - A/1999")],
    }, "F")
    assert out["F1"]["examples"] == ["a", "b"]
    assert out["F1"]["detail"] == "BKMEA 1 numbers"
    assert out["F1b"]["count"] == 0


def test_safety_entry_under_another_companys_name() -> None:
    """A sister concern's entry is a finding; the register's own "(Previously ...)" is the same company renamed."""
    out = found({
        "suppliers": [supplier("chorka", "CHORKA TEXTILE LTD"), supplier("hamid", "Hamid Sweaters Ltd."), supplier("same", "Sung Kwang Apparels Ltd")],
        "records": [record("r1", "chorka", "s-rsc", "1", rsc_factory_name="Chorka Apparels Ltd", rsc_status_name="active"),
                    record("r2", "hamid", "s-rsc", "2", rsc_factory_name="Ever Knit Ltd. (Previously Hamid Sweaters Ltd.)", rsc_status_name="active"),
                    record("r3", "same", "s-rsc", "3", rsc_factory_name="SungKwang Apparels Ltd", rsc_status_name="active")],
    }, "F")
    assert out["F3"]["examples"] == ["chorka"]
    assert out["F3b"]["examples"] == ["hamid"]


def test_former_name_and_same_company() -> None:
    assert former_name("Ever Knit Ltd. (Previously Hamid Sweaters Ltd.)") == ("Ever Knit Ltd.", "Hamid Sweaters Ltd")
    assert former_name("Natural Indigo Ltd. [(Previously Natural Denim Ltd (new building)]")[0] == "Natural Indigo Ltd."
    assert same_company("Hamid Sweaters Ltd.", "Ever Knit Ltd. (Previously Hamid Sweaters Ltd.)")
    assert not same_company("Fakir Fashion", "FAKIR APPARELS LTD")


def test_flag_and_tag_with_no_entry() -> None:
    """A BKMEA member carrying BGMEA's flag and tag: the mark on the search card has no receipt."""
    out = found({
        "suppliers": [supplier("ghost", "3S Textile", bgmea_verified=True, bkmea_verified=True, source_tags=["BKMEA", "BGMEA"]),
                      supplier("real", "Real Knit", bgmea_verified=True, source_tags=["BGMEA"])],
        "records": [record("r1", "ghost", "s-bkmea", "5", bkmea_reg_number="5 - A/2001"),
                    record("r2", "real", "s-bgmea", "general:9", bgmea_member_type="general_manufacturer", bgmea_reg_number="9")],
    }, "C")
    assert out["C1"]["examples"] == ["ghost"] and out["C1"]["detail"] == "BGMEA 1"
    assert out["C6"]["examples"] == ["ghost"]
    assert out["C2"]["count"] == 0


def test_bkmea_number_the_entries_do_not_carry() -> None:
    out = found({
        "suppliers": [supplier("off", "Shatabdi Apparels", bkmea_reg_number="12 - A/2005"), supplier("on", "Knit Line", bkmea_reg_number="7 - B/2010")],
        "records": [record("r1", "off", "s-bkmea", "13", bkmea_reg_number="13 - A/2005"), record("r2", "on", "s-bkmea", "7", bkmea_reg_number="7  -  B/2010")],
    }, "C")
    assert out["C3"]["examples"] == ["off"]


def test_completeness_is_the_live_formula() -> None:
    row = {"company_name": "X", "bgmea_verified": True, "bkmea_verified": False, "email_primary": "a", "phones": ["1"], "address_raw": "y"}
    assert expected_completeness(row, None, 0) == 5 + 10 + 8 + 5 + 4
    assert expected_completeness(row, {"progress_pct": 100}, 2) == 32 + 18 + 12
    assert expected_completeness(row, {"progress_pct": 99.5}, 0) == 32


def test_two_worker_figures() -> None:
    """Search prints the filed total; the page prints safety-register headcounts across the buildings."""
    out = found({
        "suppliers": [supplier("split", "SM Knitwear", employees_total=300),
                      supplier("shed", "SM Knitwear Unit 2", is_published=False, facility_of="split", employees_total=None),
                      supplier("agree", "Lumbini", employees_total=500), supplier("plain", "No Safety Row", employees_total=80)],
        "records": [],
        "rsc": [safety_row("shed", "x", True, workers=907), safety_row("agree", "y", True, workers=500)],
    }, "W")
    assert out["W1"]["examples"] == ["split"]
    assert "On 1 the page figure leaves the company's own row out" in out["W1"]["detail"]


def test_workers_arithmetic() -> None:
    out = found({"suppliers": [supplier("off", "A", employees_total=100, employees_male=40, employees_female=50),
                               supplier("ok", "B", employees_total=90, employees_male=40, employees_female=50)], "records": []}, "W")
    assert out["C9"]["examples"] == ["off"]


def test_certificates() -> None:
    def cert(cid: str, sid: str, rid: str, no: str, **over) -> dict:
        return {"id": cid, "supplier_id": sid, "source_record_id": rid, "kind": "oeko_tex", "certificate_no": no,
                "expires_on": None, "listing_status": "listed", "rejected_at": None, **over}

    out = found({
        "suppliers": [supplier("a", "Fakir Fashion"), supplier("b", "Fakir Apparels"), supplier("c", "Lenny Fashions"), supplier("d", "No Row Ltd")],
        "records": [record("r1", "a", "s-oeko", "oeko-tex-1:100"), record("r2", "b", "s-oeko", "oeko-tex-1:100"),
                    record("r3", "c", "s-sa", "sa-1", sa8000_status="Withdrawn/cancelled", expires_on="2023-01-13"),
                    record("r4", "d", "s-oeko", "oeko-tex-9:100")],
        "certifications": [cert("c1", "a", "r1", "19206-100"), cert("c2", "b", "r2", "19206-100"),
                           cert("c3", "c", "r3", "SA-1", kind="sa8000", expires_on="2023-01-13")],
    }, "CERT")
    assert out["F2"]["examples"] == ["a", "b"]
    assert out["E1"]["examples"] == ["c"]
    assert out["E2"]["examples"] == ["c"]
    assert out["C12"]["examples"] == ["d"]
    assert out["C13"]["count"] == 0


def test_a_building_of_a_building_is_lost() -> None:
    out = found({
        "suppliers": [supplier("top", "Knit Asia"), supplier("mid", "Knit Asia Extension", is_published=False, facility_of="top"),
                      supplier("low", "Knit Asia Ratanpur", is_published=False, facility_of="mid")],
        "records": [],
    }, "G")
    assert out["G3"]["examples"] == ["low"]
    assert out["G2"]["count"] == 0 and out["G1"]["count"] == 0


def test_districts_and_names() -> None:
    out = found({
        "suppliers": [supplier("old", "ABONI KNITWEAR LTD", district="Comilla"), supplier("new", "Aboni Knitwear Ltd", district="Cumilla"),
                      supplier("cox", "Sea Knit", district="Cox's Bazar"), supplier("half", "Mega Couture Ltd.)", district="Savar"),
                      supplier("none", "No Place", district=None, address_raw=None)],
        "records": [],
    }, "I")
    assert out["I1"]["count"] == 2 and "Comilla 1" in out["I1"]["detail"] and "Savar 1" in out["I1"]["detail"]
    assert out["I2"]["examples"] == ["old"]
    assert out["I3"]["examples"] == ["half"]
    assert out["I11"]["examples"] == ["none"] and out["I12"]["examples"] == ["none"]


def test_stale_entries_say_how_old() -> None:
    out = found({
        "suppliers": [supplier("old", "Old Read"), supplier("new", "New Read")],
        "records": [record("r1", "old", "s-btma", "x-1", read="2026-05-21"), record("r2", "new", "s-bgmea", "general:1", read="2026-10-10")],
    }, "E")
    assert out["E4"]["examples"] == ["old"]
    assert "BTMA: oldest 145d" in out["E4"]["detail"]


def test_a_match_switched_off_with_no_reason() -> None:
    out = found({
        "suppliers": [supplier("quiet", "MSD International"), supplier("said", "Other Ltd", sanctions_cleared=True, sanctions_cleared_reason="a namesake in Panama"),
                      supplier("live", "Listed Ltd")],
        "records": [],
        "screening": [{"supplier_id": "quiet", "list": "ofac_sdn", "active": False}, {"supplier_id": "said", "list": "ofac_sdn", "active": False},
                      {"supplier_id": "live", "list": "ofac_sdn", "active": True}],
        "list_entries": [{"list": "ofac_sdn", "listing_status": "listed", "last_seen_at": "2026-10-08"}],
    }, "J")
    assert out["J3"]["examples"] == ["quiet"]
    assert out["J1"]["examples"] == ["live"]
    assert out["J5"]["count"] == 0


def test_a_list_never_seen_is_not_fresh() -> None:
    out = found({"suppliers": [], "records": [],
                 "list_entries": [{"list": "uflpa", "listing_status": "listed", "last_seen_at": None, "fetched_at": None},
                                  {"list": "ofac_sdn", "listing_status": "listed", "last_seen_at": "2026-10-01"},
                                  {"list": "uk_ofsi", "listing_status": "listed", "last_seen_at": "2026-10-10"}]}, "J")
    assert out["J5"]["count"] == 2  # never seen, and seen twelve days ago


def test_district_list_is_the_64() -> None:
    assert len(DISTRICTS) == 64
    assert "Cox's Bazar" in DISTRICTS and "Bazar" not in DISTRICTS and "Comilla" not in DISTRICTS


class _Answer:
    def __init__(self, status: int, data) -> None:
        self.status_code, self._data, self.content, self.headers = status, data, b"x" * 20, {"content-range": "0-0/1"}

    def json(self):
        return self._data


class _FakeApi:
    """The database API as the script sees it: one guarded function, one that reaches a write, one that leaks."""

    def __init__(self) -> None:
        self.calls: list[tuple[str, str]] = []

    def description(self) -> dict:
        fn = lambda **props: {"post": {"parameters": [{"in": "body", "schema": {"properties": props}}]}}  # noqa: E731
        return {"definitions": {"profiles": {}}, "paths": {
            "/rpc/admin_supplier_update": fn(p_id={"type": "string", "format": "uuid"}, p_patch={"type": "object", "format": "jsonb"}),
            "/rpc/unguarded_writer": fn(), "/rpc/_messages_key": fn(), "/rpc/rfq_create": fn(p_input={"format": "jsonb"})}}

    def call(self, method: str, path: str, **kw):
        self.calls.append((method, path))
        if path == "rpc/admin_supplier_update":
            return _Answer(401, {"message": "admin only"})
        if path == "rpc/unguarded_writer":
            return _Answer(405, {"message": "cannot execute INSERT in a read-only transaction"})
        if path == "rpc/_messages_key":
            return _Answer(200, "k" * 64)
        if path.startswith("suppliers") and "select" in kw.get("params", {}) and "," in kw["params"]["select"]:
            return _Answer(401, {"message": "permission denied"})
        return _Answer(200, [])


def test_the_database_api_check_never_writes() -> None:
    """GET only. A function that reaches a write is a finding, and is never tried again with POST;
    a function that creates rows is not called at all."""
    OUT.clear()
    api = _FakeApi()
    check_dbapi(api, Data({"sources": SOURCES, "suppliers": [], "records": []}))
    assert {method for method, _ in api.calls} == {"GET"}
    assert ("GET", "rpc/rfq_create") not in api.calls
    verdict = {o["where"]: (o["verdict"], o["note"]) for o in OUT}
    assert verdict["fn admin_supplier_update"][0] == "ok" and "admin only" in verdict["fn admin_supplier_update"][1]
    assert verdict["fn unguarded_writer"][0] == "FAIL" and "reached a write" in verdict["fn unguarded_writer"][1]
    assert verdict["fn _messages_key"][0] == "FAIL" and "k" * 8 not in verdict["fn _messages_key"][1]  # the value is never printed
    assert verdict["fn rfq_create"][0] == "skip"


def test_nil_arguments_cannot_name_a_real_row() -> None:
    args = _nil_args({"p_id": {"type": "string", "format": "uuid"}, "p_ids": {"type": "array"}, "p_n": {"type": "integer"},
                      "p_patch": {"format": "jsonb"}, "p_since": {"type": "string", "format": "timestamp with time zone"}, "p_q": {"type": "string"}})
    assert args == {"p_id": "00000000-0000-0000-0000-000000000000", "p_ids": [], "p_n": 0, "p_patch": {}, "p_since": None, "p_q": ""}


def test_contact_details_are_named_never_quoted() -> None:
    """The report says which kind of detail sits where. It must not be able to print the detail."""
    text = "House 5, Road 2, Dhaka. Tel: 02-9876543, 01712-345678, info@factory.example.bd"
    kinds = contact_shapes(text)
    assert {"an email address", "a mobile number", "a labelled phone"} <= set(kinds)
    assert not any("9876543" in k or "@" in k for k in kinds)
    assert contact_shapes("Plot 12-14, Block C, Tongi I/A, Gazipur-1710") == []
    out = found({"suppliers": [supplier("leaky", "Ayaan Clothing", address_raw=text), supplier("clean", "Clean Ltd")], "records": []}, "K")
    assert out["K1"]["examples"] == ["leaky"]
    assert "345678" not in str(out) and "factory.example" not in str(out)


def test_response_scan_names_the_place_not_the_value() -> None:
    payload = {"supplier": {"company_name": "X", "address_raw": "Mob: 01712345678", "contact_name": None},
               "rows": [{"sbi_total": 71}, {"notes_admin": ""}]}
    hits = leaks_in_json(payload)
    assert "a mobile number at supplier.address_raw" in hits
    assert "private field at rows[].sbi_total" in hits
    assert not any("contact_name" in h or "notes_admin" in h for h in hits)  # present but empty: nothing reached the reader
    assert not any("01712345678" in h for h in hits)
    assert leaks_in_text("Questions? hello@sourcebd.net. No scores.") == []
    assert "an internal field name" in leaks_in_text("pillar2 42")
