"""C2: a run never mints a company on a near-match (spec-etl-freshness §8.3).

When a record matches no existing company, `plan_new_supplier` decides what
the upsert does instead of creating blindly:

| case                                                    | result |
| ------------------------------------------------------- | ------ |
| a reviewer already said "same" for this record          | attach |
| a review is still open for this record                  | wait   |
| name 80+ against a company the matcher would not join,  | hold   |
| or a shared registration number, mailbox or phone,      |        |
| or the same plot/holding number in the same district    |        |
| otherwise (or a reviewer said "different")              | create |

A held record is one `verification_queue` row (`fuzzy_match_review`, rule
`etl_hold_v1`) carrying both spellings and the record itself, so the decision
can be replayed. "Release" in /admin/queue means same company; "Reject" means
different, and the create writes a never-same ruling so the pair is never
asked again. No source record is written while a record is held, so the next
read of that source re-asks this module and finds the decision too.
"""
from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass
from typing import Any

from rapidfuzz import fuzz

from etl.core.logging import get_logger
from etl.core.scraper import ScrapedRecord

log = get_logger("etl.hold")

HOLD_RULE = "etl_hold_v1"
NEAR_NAME_FLOOR = 80

# Labelled premises ids ("Plot # 9", "PLOT NO- B-336", "Holding-213/1") or a
# bare leading number ("66, NAYAMATI"). ponytail: a lean cousin of the TS
# extractor in lib/dedup-addresses.ts; enough to *hold*, never to merge.
_LABELLED_ID_RE = re.compile(
    r"\b(?:plot|plots|holding|hold|house)\b[\s.:#-]*(?:no\.?|number|#|:)?[\s.:#-]*"
    r"([a-z]{0,3}[\s/-]?\d+[a-z0-9/-]*)",
    re.I,
)
_LEADING_ID_RE = re.compile(r"^\s*([a-z]{0,2}-?\d+[a-z0-9/-]*)\s*,", re.I)


def plot_ids(address: str | None) -> set[str]:
    """Canonical premises ids in an address: letters then numbers, no zeros."""
    if not address:
        return set()
    raw = [m.group(1) for m in _LABELLED_ID_RE.finditer(address)]
    lead = _LEADING_ID_RE.match(address)
    if lead:
        raw.append(lead.group(1))
    out = set()
    for r in raw:
        letters = "".join(re.findall(r"[a-z]+", r.lower()))
        digits = "/".join(str(int(d)) for d in re.findall(r"\d+", r))
        if digits:
            out.add(f"{letters}{digits}")
    return out


@dataclass(frozen=True)
class NearMatch:
    supplier_id: str
    name: str
    reason: str
    score: float  # 0-1, for the queue's confidence column
    address: str | None = None


@dataclass(frozen=True)
class NewPlan:
    """What the upsert does with a record that matched no company."""

    action: str  # attach | wait | hold | create
    supplier_id: str | None = None      # attach: the reviewed company
    near: NearMatch | None = None       # hold: the company it resembles
    different_from: str | None = None   # create: reviewer said "different"


def _registration_ids(rec: ScrapedRecord) -> list[tuple[str, str]]:
    """(SQL predicate, value) per registration the record carries."""
    p = rec.payload or {}
    out: list[tuple[str, str]] = []
    bk = str(p.get("bkmea_reg_number") or "").strip()
    if re.match(r"^\d+\s*-", bk):
        out.append(("split_part(bkmea_reg_number, ' ', 1) = %s", bk.split()[0]))
    bg = str(p.get("bgmea_reg_number") or "").strip()
    kind = {"general_manufacturer": "general", "associate_buying_house": "associate"}.get(
        str(p.get("bgmea_member_type") or "")
    )
    # Bare BGMEA numbers collide across the two registers (REZ-115): only a
    # typed identity is evidence.
    if bg.isdigit() and kind:
        out.append(("bgmea_reg_numbers @> array[%s]::text[]", f"{kind}:{bg}"))
    rj = str(p.get("rjsc_reg_number") or "").strip()
    if rj:
        out.append(("rjsc_reg_number = %s", rj))
    return out


def near_match(
    cur, rec: ScrapedRecord, *, norm: str, email: str | None, phones: list[str]
) -> NearMatch | None:
    """The existing company this record must be checked against, if any.

    Called only after `_find_existing` found nothing, so any shared identifier
    here is, by construction, under a name the matcher would not accept.
    """
    for predicate, value in _registration_ids(rec):
        cur.execute(
            f"select id::text as id, company_name, address_raw from public.suppliers "
            f"where {predicate} limit 1",
            (value,),
        )
        row = cur.fetchone()
        if row:
            return NearMatch(row["id"], row["company_name"],
                             f"same registration {value}", 1.0, row["address_raw"])

    if email:
        cur.execute(
            "select id::text as id, company_name, address_raw from public.suppliers "
            "where email_primary = %s limit 1",
            (email,),
        )
        row = cur.fetchone()
        if row:
            return NearMatch(row["id"], row["company_name"],
                             f"same mailbox {email}", 1.0, row["address_raw"])
    if phones:
        cur.execute(
            "select id::text as id, company_name, address_raw from public.suppliers "
            "where phones && %s::text[] limit 1",
            (phones,),
        )
        row = cur.fetchone()
        if row:
            return NearMatch(row["id"], row["company_name"],
                             "same phone number", 1.0, row["address_raw"])

    if norm:
        cur.execute(
            """select id::text as id, company_name, company_name_norm, address_raw
                 from public.suppliers
                where company_name_norm %% %s
                limit 50""",
            (norm,),
        )
        best: tuple[float, dict] | None = None
        for row in cur.fetchall():
            score = fuzz.token_sort_ratio(norm, row["company_name_norm"] or "")
            if best is None or score > best[0]:
                best = (score, row)
        if best and best[0] >= NEAR_NAME_FLOOR:
            score, row = best
            # 92+ here means Pass 4 refused it: word order, initials, or two
            # candidates a human ruled never-same.
            why = (f"name {score:.0f}% alike" if score < 92
                   else f"name {score:.0f}% alike, but the matcher would not join them")
            return NearMatch(row["id"], row["company_name"], why, score / 100,
                             row["address_raw"])

    ids = plot_ids(rec.address_raw)
    if ids and rec.district:
        # ponytail: scans one district's rows (≤ ~3k) on the create path only,
        # a handful of times a month; index by plot id if creates grow.
        cur.execute(
            "select id::text as id, company_name, address_raw from public.suppliers "
            "where lower(district) = lower(%s) and address_raw is not null",
            (rec.district,),
        )
        for row in cur.fetchall():
            shared = ids & plot_ids(row["address_raw"])
            if shared:
                return NearMatch(row["id"], row["company_name"],
                                 f"same plot {sorted(shared)[0]} in {rec.district}",
                                 0.8, row["address_raw"])
    return None


def held_decision(cur, rec: ScrapedRecord) -> tuple[str, str | None] | None:
    """Latest hold for this record: (verdict, company id) or None.

    verdict is 'same', 'different' or 'open' (undecided or escalated). A
    'same' whose company has since been deleted is treated as no decision,
    so the record is checked afresh.
    """
    cur.execute(
        """select q.admin_action::text as action, q.reviewed_at,
                  s.id::text as supplier_id
             from public.verification_queue q
             left join public.suppliers s on s.id = q.supplier_a_id
            where q.queue_type = 'fuzzy_match_review'
              and q.source_data ->> 'rule' = %s
              and q.source_data ->> 'source_code' = %s
              and q.source_data ->> 'source_ref' = %s
            order by q.created_at desc
            limit 1""",
        (HOLD_RULE, rec.source_code, rec.source_ref),
    )
    row = cur.fetchone()
    if row is None:
        return None
    if row["reviewed_at"] is None or row["action"] == "escalate":
        return ("open", row["supplier_id"])
    if row["action"] == "reject":
        return ("different", row["supplier_id"])
    if row["supplier_id"] is None:
        return None
    return ("same", row["supplier_id"])


def plan_new_supplier(
    cur, rec: ScrapedRecord, *, norm: str, email: str | None, phones: list[str],
    facility_of: str | None,
) -> NewPlan:
    decision = held_decision(cur, rec)
    if decision is not None:
        verdict, sid = decision
        if verdict == "same":
            return NewPlan("attach", supplier_id=sid)
        if verdict == "open":
            return NewPlan("wait")
        return NewPlan("create", different_from=sid)
    # An extension name with a known parent is exact identity (REZ-67).
    if facility_of is None:
        near = near_match(cur, rec, norm=norm, email=email, phones=phones)
        if near is not None:
            return NewPlan("hold", near=near)
    return NewPlan("create")


def record_payload(rec: ScrapedRecord) -> dict[str, Any]:
    """The record, minus its fetched document, as JSON for replay."""
    data = asdict(rec)
    data.pop("evidence", None)
    return json.loads(json.dumps(data, default=str))


def record_from_payload(data: dict[str, Any]) -> ScrapedRecord:
    data = dict(data)
    data["alias_refs"] = tuple(data.get("alias_refs") or ())
    return ScrapedRecord(**data)


def write_hold(cur, rec: ScrapedRecord, near: NearMatch) -> None:
    cur.execute(
        """insert into public.verification_queue
               (queue_type, supplier_a_id, supplier_b_name, confidence, source_data)
           values ('fuzzy_match_review', %s, %s, %s, %s::jsonb)""",
        (
            near.supplier_id,
            rec.company_name,
            round(near.score, 3),
            json.dumps({
                "rule": HOLD_RULE,
                "reason": near.reason,
                "source_code": rec.source_code,
                "source_ref": rec.source_ref,
                "incoming_name": rec.company_name,
                "candidate_name": near.name,
                "incoming_address": rec.address_raw,
                "candidate_address": near.address,
                "record": record_payload(rec),
            }, default=str),
        ),
    )


def replay_decided(limit: int = 50) -> dict[str, int]:
    """Apply reviewed holds now instead of at the source's next read.

    The replayed record carries no fetched document, so its source record's
    hash is cleared afterwards: the next real read is then not "unchanged"
    and writes the citation through the normal path.
    """
    from etl.core.db import db, get_source_id
    from etl.core.upsert import upsert_supplier_with_source

    with db.conn() as c, c.cursor() as cur:
        cur.execute(
            """select id::text as id, source_data
                 from public.verification_queue
                where queue_type = 'fuzzy_match_review'
                  and source_data ->> 'rule' = %s
                  and reviewed_at is not null
                  and admin_action::text <> 'escalate'
                  and source_data ->> 'replayed_at' is null
                order by reviewed_at
                limit %s""",
            (HOLD_RULE, limit),
        )
        rows = cur.fetchall()
    replayed = failed = 0
    for row in rows:
        data = row["source_data"]
        try:
            rec = record_from_payload(data["record"])
            supplier_id = upsert_supplier_with_source(rec)
        except Exception as exc:  # noqa: BLE001
            failed += 1
            log.error("hold.replay_failed", queue_id=row["id"], error=str(exc))
            continue
        with db.conn() as c, c.cursor() as cur:
            if supplier_id is not None:
                cur.execute(
                    "update public.source_records set raw_hash = null "
                    "where source_id = %s and source_ref = %s",
                    (get_source_id(rec.source_code), rec.source_ref),
                )
            cur.execute(
                """update public.verification_queue
                      set source_data = source_data || jsonb_build_object(
                            'replayed_at', now(), 'replayed_supplier_id', %s::text)
                    where id = %s""",
                (supplier_id, row["id"]),
            )
            c.commit()
        replayed += 1
    return {"replayed": replayed, "failed": failed}
