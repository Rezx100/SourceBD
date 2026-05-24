"""F11 — short-address upgrade with strict same-source superstring policy.

Hard Rule #5 (COALESCE fill-only) is *narrowly* relaxed for one column —
`suppliers.address_raw` — and only under the policy:

    "use strictly longer same-source value exists"

Concretely, for each supplier with `address_raw IS NOT NULL`:

  1. Walk the supplier's own `source_records` (only sources that already
     attested this supplier — never pulls an address from a source the
     supplier was never tagged by).
  2. For each row, collect candidate address values from the source-specific
     address-bearing payload keys.
  3. A candidate is *qualifying* iff:
       - len(candidate) > len(current) + 2 (strictly longer, small margin
         to ignore whitespace noise);
       - the normalised current address is a substring of the normalised
         candidate (i.e. the new value is a SUPERSET of the old, not a
         completely different physical address — eliminates the factory-vs-
         office case where two addresses are distinct locations).
  4. Among qualifying candidates, pick the longest. Ties broken by source
     tier (higher tier = lower rank wins). Direct UPDATE of `address_raw`
     (no COALESCE — this IS the relaxation).

The substring-containment guard is the structural safety device that
prevents the F11 relaxation from corrupting data: it can only ever extend
an existing address with more detail, never replace it with a different
one. This is the inverse of the contact-merge invariant and is the only
authorised exception to Hard Rule #5 to date.
"""

from __future__ import annotations

import re

from etl.core import db


# Per-source address-bearing payload keys, listed in order of preference.
# When the same supplier has multiple source_records of the same source,
# every key is checked across every row.
_SOURCE_ADDR_KEYS: dict[str, tuple[str, ...]] = {
    "BGMEA":    ("factory_address", "mailing_address", "raw_address"),
    "BKMEA":    ("bkmea_factory_address", "bkmea_mailing_address"),
    "BTMA":     ("factory_address", "mailing_address", "raw_address"),
    "BGAPMEA":  ("bgapmea_factory_address", "bgapmea_company_address", "raw_address", "address"),
    "EPB":      ("epb_factory_address", "epb_office_address", "address"),
    "RSC":      ("rsc_factory_address", "raw_address", "address"),
    "OEKO_TEX": ("oeko_profile_address", "address"),
    "GOTS":     ("gots_full_address", "address"),
    "WRAP":     ("wrap_address", "address"),
    "SA8000":   ("sa8000_address", "address"),
}

# Tier priority for tie-breaking. Lower = wins.
_TIER_RANK = {
    "EPB": 1, "BGMEA": 1, "BKMEA": 1,
    "BTMA": 2, "BGAPMEA": 2, "RSC": 2,
    "WRAP": 3, "OEKO_TEX": 3, "GOTS": 3, "SA8000": 3,
}

_LEN_MARGIN = 2  # strictly longer by at least this many chars

_WS_RE = re.compile(r"\s+")
_PUNCT_RE = re.compile(r"[,\.\-\(\)/]")


def _norm(s: str) -> str:
    """Lower-case, collapse whitespace, strip light punctuation for
    containment comparison. Aggressive enough to ignore formatting noise
    but conservative enough that two distinct addresses still test
    non-containing."""
    if not s:
        return ""
    s = s.lower()
    s = _PUNCT_RE.sub(" ", s)
    s = _WS_RE.sub(" ", s).strip()
    return s


def _list_candidates(supplier_id: int) -> list[tuple[str, str, int]]:
    """Return [(source_code, address_value, tier_rank)] for every
    address-bearing payload key found across this supplier's source_records.
    """
    out: list[tuple[str, str, int]] = []
    with db.conn() as cx, cx.cursor() as cur:
        cur.execute(
            """
            select s.code as source_code, sr.fields
              from source_records sr
              join sources s on s.id = sr.source_id
             where sr.supplier_id = %s
               and sr.status = 'active'
            """,
            (supplier_id,),
        )
        rows = cur.fetchall()
    for row in rows:
        code = row["source_code"]
        keys = _SOURCE_ADDR_KEYS.get(code)
        if not keys:
            continue
        fields = row["fields"] or {}
        rank = _TIER_RANK.get(code, 99)
        for k in keys:
            v = fields.get(k)
            if not v or not isinstance(v, str):
                continue
            v = v.strip()
            if v:
                out.append((code, v, rank))
    return out


def upgrade_for(supplier_id: int) -> tuple[bool, str | None, str | None]:
    """Upgrade `address_raw` for one supplier per the F11 policy.

    Returns (upgraded, old, new). `upgraded` False when no qualifying
    candidate exists.
    """
    with db.conn() as cx, cx.cursor() as cur:
        cur.execute(
            "select address_raw from suppliers where id = %s",
            (supplier_id,),
        )
        row = cur.fetchone()
    if not row or not row["address_raw"]:
        return False, None, None
    current = row["address_raw"].strip()
    current_norm = _norm(current)
    if not current_norm:
        return False, current, None

    best: tuple[str, str, int] | None = None  # (value, source_code, rank)
    for code, val, rank in _list_candidates(supplier_id):
        if len(val) <= len(current) + _LEN_MARGIN:
            continue
        if val.strip() == current:
            continue
        cand_norm = _norm(val)
        if not cand_norm or current_norm not in cand_norm:
            continue
        if best is None:
            best = (val, code, rank)
            continue
        # Prefer longer; on tie prefer higher-tier (lower rank).
        if len(val) > len(best[0]) or (len(val) == len(best[0]) and rank < best[2]):
            best = (val, code, rank)

    if best is None:
        return False, current, None

    new_val, _src, _rank = best
    with db.conn() as cx, cx.cursor() as cur:
        cur.execute(
            "update suppliers set address_raw = %s, updated_at = now() where id = %s",
            (new_val.strip(), supplier_id),
        )
        cx.commit()
    return True, current, new_val.strip()


def _list_target_ids(max_len: int) -> list[int]:
    """All suppliers with `address_raw` shorter than `max_len`."""
    with db.conn() as cx, cx.cursor() as cur:
        cur.execute(
            """
            select id from suppliers
             where address_raw is not null
               and length(trim(address_raw)) < %s
             order by id
            """,
            (max_len,),
        )
        return [r["id"] for r in cur.fetchall()]


def run_bulk(max_len: int = 60, limit: int | None = None, dry_run: bool = False) -> dict[str, int]:
    """Bulk upgrade pass. Default targets `address_raw` shorter than 60 chars
    (the audit's "short" threshold). `dry_run=True` reports candidates without
    writing."""
    ids = _list_target_ids(max_len)
    if limit is not None:
        ids = ids[:limit]
    stats = {"scanned": 0, "upgraded": 0, "skipped": 0, "dry_run_candidates": 0}
    for sid in ids:
        stats["scanned"] += 1
        if dry_run:
            with db.conn() as cx, cx.cursor() as cur:
                cur.execute("select address_raw from suppliers where id = %s", (sid,))
                cur_row = cur.fetchone()
            current = (cur_row["address_raw"] or "").strip()
            current_norm = _norm(current)
            qualifies = False
            for code, val, _rank in _list_candidates(sid):
                if (
                    len(val) > len(current) + _LEN_MARGIN
                    and val.strip() != current
                    and current_norm
                    and current_norm in _norm(val)
                ):
                    qualifies = True
                    break
            if qualifies:
                stats["dry_run_candidates"] += 1
        else:
            ok, _old, _new = upgrade_for(sid)
            if ok:
                stats["upgraded"] += 1
            else:
                stats["skipped"] += 1
    return stats
