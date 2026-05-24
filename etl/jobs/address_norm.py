"""F5a — Bangladesh address normalisation: derive city + district from
existing scraped payload data only. No external geocoding.

Source priority for `district`:
  1. EPB `epb_factory_district` / `epb_office_district` (Tier 1, authoritative).
  2. GOTS `gots_state` (e.g. "Dhaka, BD-C") — Tier 3.
  3. Regex match against the official 64-district list (with common alias
     spellings) over `address_raw`, then `city`, then `company_name`.

Source priority for `city`:
  1. Existing `suppliers.city` if already populated.
  2. Regex match against the alias map (upazilas/thanas/EPZs that uniquely
     resolve to one district) over `address_raw`.

Never overwrites a non-null value (Hard Rule #5). Operates either
backfill-wide or for a single supplier_id (runtime hook from upsert.py).
"""
from __future__ import annotations

import re
from typing import Iterable

from etl.core.db import db, get_source_id
from etl.core.logging import get_logger

log = get_logger("etl.jobs.address_norm")


# -----------------------------------------------------------------------------
# Bangladesh 64-district registry. Aliases include modern Bangla romanisations.
# District spelling stored in DB is the FIRST entry (canonical).
# -----------------------------------------------------------------------------
_DISTRICTS: dict[str, tuple[str, ...]] = {
    # Dhaka Division
    "Dhaka":         ("dhaka",),
    "Faridpur":      ("faridpur",),
    "Gazipur":       ("gazipur",),
    "Gopalganj":     ("gopalganj",),
    "Kishoreganj":   ("kishoreganj", "kishorganj"),
    "Madaripur":     ("madaripur",),
    "Manikganj":     ("manikganj", "manikgonj"),
    "Munshiganj":    ("munshiganj", "munshigonj"),
    "Narayanganj":   ("narayanganj", "narayangonj"),
    "Narsingdi":     ("narsingdi", "narshingdi"),
    "Rajbari":       ("rajbari",),
    "Shariatpur":    ("shariatpur",),
    "Tangail":       ("tangail",),
    # Chittagong Division
    "Bandarban":     ("bandarban",),
    "Brahmanbaria":  ("brahmanbaria", "b.baria", "b baria"),
    "Chandpur":      ("chandpur",),
    "Chattogram":    ("chattogram", "chittagong", "ctg"),
    "Cumilla":       ("cumilla", "comilla"),
    "Cox's Bazar":   ("cox's bazar", "coxs bazar", "cox bazar"),
    "Feni":          ("feni",),
    "Khagrachhari":  ("khagrachhari", "khagrachari"),
    "Lakshmipur":    ("lakshmipur", "laxmipur"),
    "Noakhali":      ("noakhali",),
    "Rangamati":     ("rangamati",),
    # Rajshahi Division
    "Bogura":        ("bogura", "bogra"),
    "Joypurhat":     ("joypurhat", "jaipurhat"),
    "Naogaon":       ("naogaon",),
    "Natore":        ("natore",),
    "Chapainawabganj": ("chapainawabganj", "chapai nawabganj", "nawabganj"),
    "Pabna":         ("pabna",),
    "Rajshahi":      ("rajshahi",),
    "Sirajganj":     ("sirajganj", "sirajgonj"),
    # Khulna Division
    "Bagerhat":      ("bagerhat",),
    "Chuadanga":     ("chuadanga",),
    "Jashore":       ("jashore", "jessore"),
    "Jhenaidah":     ("jhenaidah", "jhenidah"),
    "Khulna":        ("khulna",),
    "Kushtia":       ("kushtia",),
    "Magura":        ("magura",),
    "Meherpur":      ("meherpur",),
    "Narail":        ("narail",),
    "Satkhira":      ("satkhira",),
    # Barishal Division
    "Barguna":       ("barguna",),
    "Barishal":      ("barishal", "barisal"),
    "Bhola":         ("bhola",),
    "Jhalokati":     ("jhalokati", "jhalokathi"),
    "Patuakhali":    ("patuakhali",),
    "Pirojpur":      ("pirojpur",),
    # Sylhet Division
    "Habiganj":      ("habiganj", "habigonj"),
    "Moulvibazar":   ("moulvibazar", "moulavibazar"),
    "Sunamganj":     ("sunamganj", "sunamgonj"),
    "Sylhet":        ("sylhet",),
    # Rangpur Division
    "Dinajpur":      ("dinajpur",),
    "Gaibandha":     ("gaibandha",),
    "Kurigram":      ("kurigram",),
    "Lalmonirhat":   ("lalmonirhat",),
    "Nilphamari":    ("nilphamari",),
    "Panchagarh":    ("panchagarh", "panchagar"),
    "Rangpur":       ("rangpur",),
    "Thakurgaon":    ("thakurgaon",),
    # Mymensingh Division
    "Jamalpur":      ("jamalpur",),
    "Mymensingh":    ("mymensingh", "mymensing"),
    "Netrokona":     ("netrokona", "netrakona"),
    "Sherpur":       ("sherpur",),
}


# Upazilas / thanas / EPZ keywords that deterministically resolve to a district.
# `city_name` is the canonical city we store; `district` is the parent district.
_CITY_ALIASES: dict[str, tuple[str, str]] = {
    # Dhaka district sub-areas
    "savar":         ("Savar", "Dhaka"),
    "ashulia":       ("Ashulia", "Dhaka"),
    "dhamrai":       ("Dhamrai", "Dhaka"),
    "keraniganj":    ("Keraniganj", "Dhaka"),
    "nawabganj":     ("Nawabganj", "Dhaka"),     # Dhaka upazila (NOT Chapai)
    "dohar":         ("Dohar", "Dhaka"),
    "uttara":        ("Uttara", "Dhaka"),
    "mirpur":        ("Mirpur", "Dhaka"),
    "pallabi":       ("Pallabi", "Dhaka"),
    "tejgaon":       ("Tejgaon", "Dhaka"),
    "mohakhali":     ("Mohakhali", "Dhaka"),
    "banani":        ("Banani", "Dhaka"),
    "gulshan":       ("Gulshan", "Dhaka"),
    "dhanmondi":     ("Dhanmondi", "Dhaka"),
    "motijheel":     ("Motijheel", "Dhaka"),
    "badda":         ("Badda", "Dhaka"),
    "khilkhet":      ("Khilkhet", "Dhaka"),
    "depz":          ("Savar", "Dhaka"),
    # Gazipur district sub-areas
    "tongi":         ("Tongi", "Gazipur"),
    "kaliakair":     ("Kaliakair", "Gazipur"),
    "kaliakoir":     ("Kaliakair", "Gazipur"),
    "sreepur":       ("Sreepur", "Gazipur"),
    "kapasia":       ("Kapasia", "Gazipur"),
    "kaliganj":      ("Kaliganj", "Gazipur"),
    "joydebpur":     ("Joydebpur", "Gazipur"),
    "konabari":      ("Konabari", "Gazipur"),
    "board bazar":   ("Board Bazar", "Gazipur"),
    "national university": ("Board Bazar", "Gazipur"),
    # Narayanganj district sub-areas
    "sonargaon":     ("Sonargaon", "Narayanganj"),
    "rupganj":       ("Rupganj", "Narayanganj"),
    "rupgonj":       ("Rupganj", "Narayanganj"),
    "araihazar":     ("Araihazar", "Narayanganj"),
    "bandar":        ("Bandar", "Narayanganj"),
    "fatullah":      ("Fatullah", "Narayanganj"),
    "siddhirganj":   ("Siddhirganj", "Narayanganj"),
    "aepz":          ("Adamjee EPZ", "Narayanganj"),
    "adamjee":       ("Adamjee EPZ", "Narayanganj"),
    # Chattogram district sub-areas
    "cepz":          ("Chattogram EPZ", "Chattogram"),
    "kepz":          ("Karnaphuli EPZ", "Chattogram"),
    "karnaphuli":    ("Karnaphuli EPZ", "Chattogram"),
    "halishahar":    ("Halishahar", "Chattogram"),
    "agrabad":       ("Agrabad", "Chattogram"),
    "patenga":       ("Patenga", "Chattogram"),
    "pahartali":     ("Pahartali", "Chattogram"),
    "anwara":        ("Anwara", "Chattogram"),
    # Cumilla district sub-areas
    "ccepz":         ("Cumilla EPZ", "Cumilla"),
    # Mongla EPZ -> Bagerhat
    "mongla":        ("Mongla", "Bagerhat"),
    "mepz":          ("Mongla EPZ", "Bagerhat"),
    # Ishwardi EPZ -> Pabna
    "ishwardi":      ("Ishwardi", "Pabna"),
    "iepz":          ("Ishwardi EPZ", "Pabna"),
    # Uttara EPZ -> Nilphamari
    "uepz":          ("Uttara EPZ", "Nilphamari"),
    # Narsingdi
    "madhabdi":      ("Madhabdi", "Narsingdi"),
    "ghorashal":     ("Ghorashal", "Narsingdi"),
    # ---- F7 additions: BGAPMEA upazila / thana tokens ----
    # Chattogram district
    "sitakunda":     ("Sitakunda", "Chattogram"),
    "sitakundu":     ("Sitakunda", "Chattogram"),
    "bhatiary":      ("Bhatiary", "Chattogram"),
    "mirsarai":      ("Mirsarai", "Chattogram"),
    "mirsharai":     ("Mirsarai", "Chattogram"),
    "kalurghat":     ("Kalurghat", "Chattogram"),
    "bakalia":       ("Bakalia", "Chattogram"),
    "fatikchhari":   ("Fatikchhari", "Chattogram"),
    "raozan":        ("Raozan", "Chattogram"),
    "boalkhali":     ("Boalkhali", "Chattogram"),
    "asadgonj":      ("Asadganj", "Chattogram"),
    "asadganj":      ("Asadganj", "Chattogram"),
    # Dhaka district
    "turag":         ("Turag", "Dhaka"),
    "dhour":         ("Turag", "Dhaka"),
    "keraneganj":    ("Keraniganj", "Dhaka"),
    "rampura":       ("Rampura", "Dhaka"),
    "banasree":      ("Rampura", "Dhaka"),
    "azimpur":       ("Azimpur", "Dhaka"),
    "lalbagh":       ("Lalbagh", "Dhaka"),
    "shyampur":      ("Shyampur", "Dhaka"),
    "demra":         ("Demra", "Dhaka"),
    # Gazipur district
    "mouchak":       ("Mouchak", "Gazipur"),
    "chandana":      ("Chandana", "Gazipur"),
    "salna":         ("Salna", "Gazipur"),
    "purabari":      ("Purabari", "Gazipur"),
    "bsmrau":        ("Salna", "Gazipur"),
    # ---- F8 additions: residual EPB / brand-disclosure tokens ----
    "patiya":                          ("Patiya", "Chattogram"),
    "nasirabad":                       ("Nasirabad", "Chattogram"),
    "korean epz":                      ("Karnaphuli EPZ", "Chattogram"),
    "korean export processing zone":   ("Karnaphuli EPZ", "Chattogram"),
    "hemayetpur":                      ("Hemayetpur", "Dhaka"),
    "azampur":                         ("Azampur", "Dhaka"),
}


def _compile_district_regex() -> dict[str, re.Pattern[str]]:
    out: dict[str, re.Pattern[str]] = {}
    for canon, aliases in _DISTRICTS.items():
        # Word-boundary match. Pad single-word aliases with \b on both sides.
        parts = [re.escape(a) for a in aliases]
        out[canon] = re.compile(r"\b(" + "|".join(parts) + r")\b", re.IGNORECASE)
    return out


def _compile_city_regex() -> dict[str, re.Pattern[str]]:
    # Pre-sorted longest-first so "board bazar" beats "board".
    keys = sorted(_CITY_ALIASES.keys(), key=len, reverse=True)
    return {k: re.compile(r"\b" + re.escape(k) + r"\b", re.IGNORECASE) for k in keys}


_DISTRICT_RX = _compile_district_regex()
_CITY_RX = _compile_city_regex()


def _derive_district_from_text(text: str) -> str | None:
    if not text:
        return None
    # Try city aliases first because some carry implicit district
    # ("DEPZ" -> Dhaka). City aliases checked longest-first.
    for k in _CITY_RX:
        if _CITY_RX[k].search(text):
            return _CITY_ALIASES[k][1]
    # Then plain district match.
    for canon, rx in _DISTRICT_RX.items():
        if rx.search(text):
            return canon
    return None


def _derive_city_from_text(text: str) -> str | None:
    if not text:
        return None
    for k in _CITY_RX:
        if _CITY_RX[k].search(text):
            return _CITY_ALIASES[k][0]
    return None


def _derive_city_fallback_district(text: str) -> str | None:
    """F7 fallback: when no specific upazila/thana alias matched but the
    address contains a known district token (typically as the trailing
    component of a Bangladesh postal address — e.g. '..., Gazipur'),
    use the canonical district name as the city. Empirically safe: the
    majority of Bangladesh suppliers have city == district when no
    finer-grained locality is specified in the source data."""
    if not text:
        return None
    for canon, rx in _DISTRICT_RX.items():
        if rx.search(text):
            return canon
    return None


def _normalise_gots_state(raw: str | None) -> str | None:
    """GOTS publishes state like 'Dhaka, BD-C' — keep only the leading
    name and resolve it against the district registry."""
    if not raw:
        return None
    head = raw.split(",", 1)[0].strip()
    return _derive_district_from_text(head)


# -----------------------------------------------------------------------------
def _fetch_candidate_payloads(cur, supplier_id: str) -> tuple[str | None, str | None, str | None]:
    """Return (epb_district, gots_state, brand_address_blob) for a supplier."""
    epb_id = get_source_id("EPB")
    gots_id = get_source_id("GOTS")
    cur.execute(
        """select s.code, sr.fields
             from public.source_records sr
             join public.sources s on s.id = sr.source_id
            where sr.supplier_id = %s
              and sr.source_id in (%s, %s)""",
        (supplier_id, epb_id, gots_id),
    )
    epb_district = None
    gots_state = None
    for r in cur.fetchall():
        row = (r["code"], r["fields"]) if isinstance(r, dict) else (r[0], r[1])
        code, fields = row
        if code == "EPB":
            epb_district = (
                fields.get("epb_factory_district")
                or fields.get("epb_office_district")
                or epb_district
            )
        elif code == "GOTS":
            gots_state = fields.get("gots_state") or gots_state
    return epb_district, gots_state, None


def _resolve(
    *,
    current_city: str | None,
    current_district: str | None,
    address_raw: str | None,
    epb_district: str | None,
    gots_state: str | None,
) -> tuple[str | None, str | None]:
    new_district = current_district
    new_city = current_city

    if not new_district:
        # 1. EPB authoritative.
        if epb_district:
            new_district = _derive_district_from_text(epb_district) or epb_district.strip() or None
        # 2. GOTS state.
        if not new_district and gots_state:
            new_district = _normalise_gots_state(gots_state)
        # 3. address_raw regex.
        if not new_district and address_raw:
            new_district = _derive_district_from_text(address_raw)
        # 4. fall back to existing `city` field if it happens to be a district name.
        if not new_district and current_city:
            new_district = _derive_district_from_text(current_city)

    if not new_city and address_raw:
        new_city = _derive_city_from_text(address_raw)
        if not new_city:
            new_city = _derive_city_fallback_district(address_raw)

    # F8: when nothing finer-grained is known (no address-derived city,
    # no upazila/thana token, no trailing district token in address),
    # default city to the canonical district name. This matches the
    # empirical pattern that Bangladesh suppliers without a finer
    # locality publish city == district, and handles RSC satellite
    # buildings whose district was derived from a parent factory but
    # whose address_raw is null.
    if not new_city and new_district:
        new_city = new_district

    return new_city, new_district


def _list_target_ids(cur) -> Iterable[str]:
    # F8: dropped the `address_raw is not null` filter so RSC satellite
    # suppliers whose district was set by F6 cross-link but who carry no
    # address_raw still flow through `_resolve` and pick up the
    # district-as-city fallback.
    cur.execute(
        "select id from public.suppliers "
        "where district is null or city is null"
    )
    return [str(r["id"]) if isinstance(r, dict) else str(r[0]) for r in cur.fetchall()]


def run_for(supplier_id: str) -> tuple[bool, bool]:
    """Single-supplier mode. Returns (city_updated, district_updated)."""
    with db.conn() as c, c.cursor() as cur:
        cur.execute(
            "select city, district, address_raw from public.suppliers where id = %s",
            (supplier_id,),
        )
        row = cur.fetchone()
        if not row:
            return False, False
        d = row if isinstance(row, dict) else {"city": row[0], "district": row[1], "address_raw": row[2]}
        epb_district, gots_state, _ = _fetch_candidate_payloads(cur, supplier_id)
        new_city, new_district = _resolve(
            current_city=d["city"],
            current_district=d["district"],
            address_raw=d["address_raw"],
            epb_district=epb_district,
            gots_state=gots_state,
        )
        city_upd = bool(new_city and new_city != d["city"])
        dist_upd = bool(new_district and new_district != d["district"])
        if city_upd or dist_upd:
            cur.execute(
                "update public.suppliers set "
                "city = coalesce(city, %s), district = coalesce(district, %s) "
                "where id = %s",
                (new_city, new_district, supplier_id),
            )
            c.commit()
        return city_upd, dist_upd


def run(limit: int | None = None) -> dict[str, int]:
    """Backfill mode. Walk every supplier with NULL city or district and
    fill what can be derived. Returns counters."""
    stats = {"scanned": 0, "city_filled": 0, "district_filled": 0}
    with db.conn() as c, c.cursor() as cur:
        ids = _list_target_ids(cur)
    if limit is not None:
        ids = list(ids)[:limit]
    log.info("address_norm.start", n=len(ids))
    # Process per-supplier in its own transaction so a slow run doesn't
    # hold one long transaction open against the pooler.
    for sid in ids:
        stats["scanned"] += 1
        try:
            city_upd, dist_upd = run_for(sid)
            if city_upd:
                stats["city_filled"] += 1
            if dist_upd:
                stats["district_filled"] += 1
        except Exception as exc:  # noqa: BLE001
            log.error("address_norm.row_failed", supplier_id=sid, error=str(exc))
        if stats["scanned"] % 500 == 0:
            log.info("address_norm.progress", **stats)
    log.info("address_norm.done", **stats)
    return stats
