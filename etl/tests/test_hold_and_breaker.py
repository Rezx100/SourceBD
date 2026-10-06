"""ETL freshness C2 (hold near-matches) and C4 (circuit breaker).

Fixtures from spec-etl-freshness §8.3 C5: Kainzanul/Kainjanul and
Gazipur/Gajipur are held, never silently minted; Sreepur ≠ Sripur; Anika ≠
ANITA and COTTON FAIR ≠ FAIR COTTON are never joined; a never-same pair is
never merged. The locked-field case is pinned in test_field_locks.py.
"""
from __future__ import annotations

from typing import Any

import pytest

from etl.core import breaker as br
from etl.core import hold
from etl.core.normalize import make_slug, normalize_company_name
from etl.core.resolution_edges import pair_key
from etl.core.scraper import ScrapedRecord
from etl.core.upsert import _find_existing, upsert_supplier_with_source
from etl.lib.bd_place_lexicon import apply_place_lexicon
from etl.tests.conftest import FakeCursor


def _rec(name: str, **kw: Any) -> ScrapedRecord:
    return ScrapedRecord(source_code="BKMEA", source_ref=kw.pop("ref", "r-1"),
                         company_name=name, payload=kw.pop("payload", {"n": name}), **kw)


class HoldCursor(FakeCursor):
    """FakeCursor plus the hold path's queries."""

    def __init__(self, *, trigram: list[dict] | None = None,
                 district_rows: list[dict] | None = None,
                 hold_row: dict | None = None,
                 edges: list[dict] | None = None, **kw: Any) -> None:
        super().__init__(**kw)
        self.trigram = trigram or []
        self.district_rows = district_rows or []
        self.hold_row = hold_row
        self.edges = edges or []

    def fetchall(self) -> list[dict[str, Any]]:
        sql = self._last_sql
        if "company_name_norm %% %s" in sql:
            return list(self.trigram)
        if "lower(district) = lower(%s)" in sql:
            return list(self.district_rows)
        if "from public.resolution_edges" in sql:
            return list(self.edges)
        return super().fetchall()

    def fetchone(self) -> dict[str, Any] | None:
        if "from public.verification_queue" in self._last_sql:
            return self.hold_row
        return super().fetchone()


def _cand(sid: str, name: str, address: str | None = None) -> dict:
    return {"id": sid, "company_name": name,
            "company_name_norm": normalize_company_name(name), "address_raw": address}


def _near(cur, rec: ScrapedRecord):
    return hold.near_match(cur, rec, norm=normalize_company_name(rec.company_name),
                           email=None, phones=[])


# --- C2: what is held -------------------------------------------------------

def test_spelling_variant_is_held_not_minted():
    cur = HoldCursor(trigram=[_cand("k1", "KAINZANUL FASHIONS LTD")])
    near = _near(cur, _rec("KAINJANUL FASHIONS LTD"))
    assert near is not None and near.supplier_id == "k1"
    assert near.reason.startswith("name ")


def test_gazipur_gajipur_same_plot_is_held():
    cur = HoldCursor(district_rows=[_cand("g1", "SUNRISE KNIT", "Plot # 12, Konabari, Gazipur")])
    rec = _rec("SKYLINE KNIT WEAR", address_raw="PLOT NO-12, Konabari, Gajipur",
               district="Gazipur")
    near = _near(cur, rec)
    assert near is not None and "same plot 12" in near.reason


def test_sreepur_is_not_sripur():
    # Different places stay different; the lexicon never folds them.
    assert apply_place_lexicon("sreepur") != apply_place_lexicon("sripur")


@pytest.mark.parametrize(("incoming", "existing"), [
    ("ANIKA FASHIONS LTD", "ANITA FASHIONS LTD"),
    ("COTTON FAIR (PVT) LTD", "FAIR COTTON (PVT) LTD"),
])
def test_never_joined_but_held_for_a_human(incoming, existing):
    cur = HoldCursor(trigram=[_cand("x1", existing)])
    norm = normalize_company_name(incoming)
    assert _find_existing(cur, slug=make_slug(incoming), norm=norm, email=None, phones=[]) is None
    near = _near(cur, _rec(incoming))
    assert near is not None and near.supplier_id == "x1"


def test_clearly_new_company_is_not_held():
    cur = HoldCursor(trigram=[_cand("x1", "OCEAN BLUE GARMENTS")])
    assert _near(cur, _rec("ZENITH SWEATERS LTD")) is None


def test_typed_bgmea_identity_only():
    bare = _rec("X", payload={"bgmea_reg_number": "100"})
    typed = _rec("X", payload={"bgmea_reg_number": "100",
                               "bgmea_member_type": "associate_buying_house"})
    assert hold._registration_ids(bare) == []
    assert hold._registration_ids(typed)[0][1] == "associate:100"
    bk = _rec("X", payload={"bkmea_reg_number": "2622 - C/2026"})
    assert hold._registration_ids(bk)[0][1] == "2622"


@pytest.mark.parametrize(("address", "ids"), [
    ("66, NAYAMATI, , NARAYANGANJ", {"66"}),
    ("Plot # 9, BSCIC", {"9"}),
    ("PLOT NO- B-336, Mirpur", {"b336"}),
    ("Holding-213/1, Tongi", {"213/1"}),
    ("Kewa, Sreepur, Gazipur", set()),
])
def test_plot_ids(address, ids):
    assert hold.plot_ids(address) == ids


# --- C2: never-same pairs ---------------------------------------------------

def test_two_confident_candidates_ruled_different_are_not_guessed():
    a, b = "aaaa", "bbbb"
    lo, hi = pair_key(a, b)
    cur = HoldCursor(
        trigram=[_cand(a, "MAXIM INTERNATIONAL"), _cand(b, "MAXIM INTERNATIONALS")],
        edges=[{"supplier_a": lo, "supplier_b": hi, "verdict": "different",
                "rationale": "r", "a_published": True, "b_published": True}],
    )
    norm = normalize_company_name("MAXIM INTERNATIONAL LTD")
    assert _find_existing(cur, slug="x", norm=norm, email=None, phones=[]) is None


def test_a_ruled_neighbour_that_could_never_match_does_not_block():
    a, b = "aaaa", "bbbb"
    lo, hi = pair_key(a, b)
    cur = HoldCursor(
        trigram=[_cand(a, "MAXIM INTERNATIONAL"), _cand(b, "MAXIMO INTERNATIONAL")],
        edges=[{"supplier_a": lo, "supplier_b": hi, "verdict": "different",
                "rationale": "r", "a_published": True, "b_published": True}],
    )
    norm = normalize_company_name("MAXIM INTERNATIONAL LTD")
    assert _find_existing(cur, slug="x", norm=norm, email=None, phones=[]) == a


def test_without_a_ruling_the_best_candidate_still_wins():
    cur = HoldCursor(trigram=[_cand("aaaa", "MAXIM INTERNATIONAL"),
                              _cand("bbbb", "MAXIMS INTERNATIONAL")])
    norm = normalize_company_name("MAXIM INTERNATIONAL LTD")
    assert _find_existing(cur, slug="x", norm=norm, email=None, phones=[]) == "aaaa"


# --- C2: the write path ------------------------------------------------------

def test_held_record_writes_a_queue_row_and_no_company(patched_db):
    cur = HoldCursor(trigram=[_cand("k1", "KAINZANUL FASHIONS LTD")])
    patched_db(cur)
    assert upsert_supplier_with_source(_rec("KAINJANUL FASHIONS LTD")) is None
    sqls = [s for s, _ in cur.executed]
    assert any("insert into public.verification_queue" in s for s in sqls)
    assert not any("insert into public.suppliers" in s for s in sqls)
    assert not any("into public.source_records" in s for s in sqls)


def test_open_hold_is_not_asked_twice(patched_db):
    cur = HoldCursor(trigram=[_cand("k1", "KAINZANUL FASHIONS LTD")],
                     hold_row={"action": None, "reviewed_at": None, "supplier_id": "k1"})
    patched_db(cur)
    assert upsert_supplier_with_source(_rec("KAINJANUL FASHIONS LTD")) is None
    assert not any("insert into public.verification_queue" in s for s, _ in cur.executed)


def test_reviewer_said_same_attaches(patched_db):
    cur = HoldCursor(hold_row={"action": "approve", "reviewed_at": "t", "supplier_id": "k1"})
    patched_db(cur)
    assert upsert_supplier_with_source(_rec("KAINJANUL FASHIONS LTD")) == "k1"
    assert not any("insert into public.suppliers" in s for s, _ in cur.executed)


def test_reviewer_said_different_creates_and_rules_it(patched_db):
    cur = HoldCursor(trigram=[_cand("k1", "KAINZANUL FASHIONS LTD")],
                     hold_row={"action": "reject", "reviewed_at": "t", "supplier_id": "k1"})
    patched_db(cur)
    assert upsert_supplier_with_source(_rec("KAINJANUL FASHIONS LTD")) == "sup-new"
    edge = [p for s, p in cur.executed if "insert into public.resolution_edges" in s]
    assert edge and edge[0][2] == "different" and set(edge[0][:2]) == {"k1", "sup-new"}


def test_record_payload_round_trips():
    rec = _rec("A", alias_refs=("p-1",), address_raw="Plot 1")
    back = hold.record_from_payload(hold.record_payload(rec))
    assert back == rec


# --- C4: circuit breaker -----------------------------------------------------

def test_breaker_stops_at_the_change_limit():
    b = br.Breaker(stored=1000)  # limit 50
    assert all(b.admit("changed") for _ in range(50))
    assert b.admit("changed") is False
    assert "50 of 1000" in b.tripped
    assert b.admit("unchanged") is False  # once tripped, nothing more


def test_breaker_floor_for_small_sources():
    b = br.Breaker(stored=20)
    assert all(b.admit("attach") for _ in range(5))
    assert b.admit("changed") is False


def test_breaker_new_companies_and_holds():
    b = br.Breaker(stored=5000)
    assert all(b.admit("create") for _ in range(20))
    assert all(b.admit("hold") for _ in range(100))  # held records change nothing
    assert b.admit("create") is False


def test_breaker_accept_releases():
    b = br.Breaker(stored=0, accept=True)
    assert all(b.admit("create") for _ in range(500))
    assert b.summary()["tripped"] is None


def test_removal_limit():
    assert br.over_removal_limit(removed=3, listed_before=100) is False
    assert br.over_removal_limit(removed=4, listed_before=100) is True
    assert br.over_removal_limit(removed=20, listed_before=1000) is False
    assert br.over_removal_limit(removed=21, listed_before=1000) is True
