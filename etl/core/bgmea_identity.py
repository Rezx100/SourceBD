"""BGMEA registration identity: register + number, never bare number alone.

REZ-115 — BGMEA's General and Associate registers number independently.
``suppliers.bgmea_reg_numbers`` historically stored bare digits, so the same
digit could name two companies. Identity strings are:

  * ``general:{N}``  — general_manufacturer (matches ``source_ref``)
  * ``associate:{N}`` — associate_buying_house (prefix added; SR ref stays bare)

Register is taken only from ``fields->>'bgmea_member_type'`` as written by the
scrapers — never inferred from entity_type or elimination.
"""

from __future__ import annotations

import re
from typing import Any

GENERAL_PREFIX = "general:"
ASSOCIATE_PREFIX = "associate:"

MEMBER_TYPE_GENERAL = "general_manufacturer"
MEMBER_TYPE_ASSOCIATE = "associate_buying_house"

_IDENTITY_RE = re.compile(r"^(general|associate):(\d+)$")
_BARE_DIGITS_RE = re.compile(r"^\d+$")


def identity_from_member_type(member_type: str | None, reg: str | None) -> str | None:
    """Build a stored identity from evidence fields only."""
    if not member_type or not reg:
        return None
    n = str(reg).strip()
    if not _BARE_DIGITS_RE.match(n):
        # Allow stripping a leading general: if a caller passed a full ref.
        if n.startswith(GENERAL_PREFIX):
            n = n[len(GENERAL_PREFIX) :]
        elif n.startswith(ASSOCIATE_PREFIX):
            n = n[len(ASSOCIATE_PREFIX) :]
        if not _BARE_DIGITS_RE.match(n):
            return None
    if member_type == MEMBER_TYPE_GENERAL:
        return f"{GENERAL_PREFIX}{n}"
    if member_type == MEMBER_TYPE_ASSOCIATE:
        return f"{ASSOCIATE_PREFIX}{n}"
    return None


def identity_from_source_record(rec: dict[str, Any]) -> str | None:
    """Derive identity from an active BGMEA source_record row/dict."""
    fields = rec.get("fields") or {}
    if not isinstance(fields, dict):
        fields = {}
    member_type = fields.get("bgmea_member_type")
    reg = fields.get("bgmea_reg_number")
    if not reg:
        ref = str(rec.get("source_ref") or "")
        if ref.startswith(GENERAL_PREFIX):
            reg = ref[len(GENERAL_PREFIX) :]
        elif _BARE_DIGITS_RE.match(ref):
            reg = ref
    return identity_from_member_type(
        str(member_type) if member_type else None,
        str(reg) if reg else None,
    )


def parse_identity(value: str) -> tuple[str, str] | None:
    """Return (register_key, number) for a stored identity string."""
    m = _IDENTITY_RE.match((value or "").strip())
    if not m:
        return None
    return m.group(1), m.group(2)


def register_plain_label(register_key: str) -> str:
    if register_key == "general":
        return "General member"
    if register_key == "associate":
        return "Associate member"
    return "BGMEA member"


def verification_url(register_key: str, number: str, *, member_id: str | None = None) -> str | None:
    """Outbound URL for the register page that shows this company.

    General members have per-factory pages at /member/{id}.
    Associate members are published only in the PDF register — there is no
    per-company HTML page. Returning None avoids linking Associate #N to the
    General member page for the same digit (the defect this issue fixes).
    """
    if register_key == "general":
        mid = (member_id or number or "").strip()
        if not mid:
            return None
        return f"https://www.bgmea.com.bd/member/{mid}"
    if register_key == "associate":
        return None
    return None


def is_legacy_bare(value: str) -> bool:
    return bool(_BARE_DIGITS_RE.match((value or "").strip()))
