"""Classify an admin review-queue row into a buyer-facing release action.

The May 2026 verification_queue backlog is not a hold of hidden companies.
Each open row has a destination a buyer can already see, or a mutation that
puts evidence on the right published profile. Clicking Review must execute
that mutation (or honestly close when the destination is already live).

Actions
-------
attach_facility     unpublished building → mother Facilities section
already_attached    same, already done; close the ticket
keep_separate       already a live company on Discover; close
label_group         set parent_group_name so "Part of X Group" renders
merge_into          absorb loser records onto winner; unpublish loser
attach_brand        move a brand-only listing onto a published company
publish             row already has Tier 1–3 evidence; make it visible
hold_no_register    brand-only, no published match; cannot publish
needs_human         do not auto-mutate
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

from etl.core.normalize import (
    extension_base_name,
    make_slug,
    normalize_company_name,
)

Action = Literal[
    "attach_facility",
    "already_attached",
    "keep_separate",
    "label_group",
    "merge_into",
    "attach_brand",
    "publish",
    "hold_no_register",
    "needs_human",
]

GENERIC_TOKENS: frozenset[str] = frozenset(
    {
        "accessories",
        "accessory",
        "and",
        "bangladesh",
        "bd",
        "co",
        "company",
        "industries",
        "industry",
        "international",
        "limited",
        "ltd",
        "packaging",
        "printing",
        "private",
        "pvt",
        "the",
    }
)

# Token clusters that are common words, not corporate groups.
JUNK_CLUSTER_TOKENS: frozenset[str] = frozenset(
    {
        "bangladesh",
        "bangla",
        "cotton",
        "creative",
        "dhaka",
        "dress",
        "extension",
        "fair",
        "four",
        "global",
        "green",
        "jeans",
        "knit",
        "pacific",
        "sourcing",
        "star",
        "trade",
        "trims",
        "world",
    }
)

# Tight name-prefix labels. Mixed tokens (aman, four, pacific) are excluded
# because sister concerns must stay separate companies (REZ-59).
GROUP_LABELS: dict[str, tuple[str, str]] = {
    "euro": ("Euro Group", r"(^|\s)euro(\s|$)"),
    "square": ("Square Group", r"(^|\s)square(\s|$)"),
    "ananta": ("Ananta Group", r"(^|\s)ananta(\s|$)"),
    "chorka": ("Chorka Group", r"(^|\s)chorka(\s|$)"),
    "hams": ("HAMS Group", r"(^|\s)hams(\s|$)"),
    "jinnat": ("Jinnat Group", r"(^|\s)jinnat(\s|$)"),
    "noman": ("Noman Group", r"(^|\s)noman(\s|$)"),
}


@dataclass(frozen=True)
class ReleasePlan:
    queue_id: str
    queue_type: str
    action: Action
    buyer_destination: str
    reason: str
    winner_id: str | None = None
    loser_id: str | None = None
    parent_id: str | None = None
    child_id: str | None = None
    group_name: str | None = None
    member_ids: tuple[str, ...] = field(default_factory=tuple)

    def fingerprint_parts(self) -> tuple[str, ...]:
        members = ",".join(sorted(self.member_ids))
        return (
            self.queue_id,
            self.action,
            self.winner_id or "",
            self.loser_id or "",
            self.parent_id or "",
            self.child_id or "",
            self.group_name or "",
            members,
        )


def _stem_token(tok: str) -> str:
    if len(tok) > 4 and tok.endswith("s"):
        return tok[:-1]
    return tok


def _compact_name(norm: str) -> str:
    parts = [_stem_token(t) for t in norm.split() if t and t not in GENERIC_TOKENS]
    return "".join(parts)


def _edit_distance(a: str, b: str) -> int:
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, start=1):
        cur = [i]
        for j, cb in enumerate(b, start=1):
            ins = cur[j - 1] + 1
            delete = prev[j] + 1
            sub = prev[j - 1] + (0 if ca == cb else 1)
            cur.append(min(ins, delete, sub))
        prev = cur
    return prev[-1]


def names_are_same_company(a: str, b: str) -> bool:
    """True only for spelling/plural/spacing variants of one legal name.

    Mega Knit vs Meghna Knit, M.A. vs N.M. Accessories stay False.
    """
    na = normalize_company_name(a)
    nb = normalize_company_name(b)
    if not na or not nb:
        return False
    if na == nb:
        return True
    if make_slug(a) == make_slug(b):
        return True
    ca, cb = _compact_name(na), _compact_name(nb)
    if len(ca) < 10 or len(cb) < 10:
        return False
    if ca == cb:
        return True
    dist = _edit_distance(ca, cb)
    if dist > 2:
        return False
    # Mega Knit vs Meghna Knit is distance 2 but a different company.
    # A.H. vs H.H. Textile, Rio vs Reo Fashion are distance 1 at the start.
    # Only allow 1–2 edits when the compact stems share a long prefix.
    longer = max(len(ca), len(cb))
    if dist == 1:
        return ca[:6] == cb[:6]
    return longer >= 12 and ca[:6] == cb[:6]


def classify_extension(
    *,
    queue_id: str,
    parent_id: str | None,
    child_id: str,
    parent_published: bool | None,
    child_facility_of: str | None,
    child_published: bool,
    parent_exists: bool,
) -> ReleasePlan:
    if child_facility_of and parent_id and child_facility_of == parent_id:
        return ReleasePlan(
            queue_id=queue_id,
            queue_type="group_parent_review",
            action="already_attached",
            parent_id=parent_id,
            child_id=child_id,
            buyer_destination="Already on the mother company Facilities section",
            reason="facility_of already points at the named parent",
        )
    if child_facility_of and parent_id and child_facility_of != parent_id:
        return ReleasePlan(
            queue_id=queue_id,
            queue_type="group_parent_review",
            action="needs_human",
            parent_id=parent_id,
            child_id=child_id,
            buyer_destination="Attached to a different mother than this ticket names",
            reason="facility_of disagrees with the queued parent",
        )
    if not parent_exists or not parent_id:
        return ReleasePlan(
            queue_id=queue_id,
            queue_type="group_parent_review",
            action="needs_human",
            child_id=child_id,
            buyer_destination="Named mother is missing",
            reason="parent supplier row gone",
        )
    if parent_published is False:
        return ReleasePlan(
            queue_id=queue_id,
            queue_type="group_parent_review",
            action="needs_human",
            parent_id=parent_id,
            child_id=child_id,
            buyer_destination="Named mother is not visible to buyers",
            reason="cannot attach a building to an unpublished parent",
        )
    if child_published or child_facility_of is None:
        return ReleasePlan(
            queue_id=queue_id,
            queue_type="group_parent_review",
            action="attach_facility",
            parent_id=parent_id,
            child_id=child_id,
            buyer_destination="Building moves onto the mother company profile",
            reason="set facility_of; publish trigger unpublishes the child",
        )
    return ReleasePlan(
        queue_id=queue_id,
        queue_type="group_parent_review",
        action="needs_human",
        parent_id=parent_id,
        child_id=child_id,
        buyer_destination="Unhandled extension state",
        reason="child unpublished without facility_of",
    )


def classify_cluster(
    *,
    queue_id: str,
    token: str,
    members: list[dict[str, Any]],
) -> ReleasePlan:
    tok = (token or "").strip().lower()
    live = [m for m in members if m.get("id")]
    ids = tuple(str(m["id"]) for m in live)

    if tok in GROUP_LABELS:
        import re

        group_name, pattern = GROUP_LABELS[tok]
        rx = re.compile(pattern)
        labelled = [
            m
            for m in live
            if not m.get("facility_of")
            and rx.search(str(m.get("company_name_norm") or ""))
        ]
        if len(labelled) >= 2:
            return ReleasePlan(
                queue_id=queue_id,
                queue_type="group_parent_review",
                action="label_group",
                group_name=group_name,
                member_ids=tuple(str(m["id"]) for m in labelled),
                buyer_destination=f"Stay separate companies, labelled Part of {group_name}",
                reason="tight prefix match on a known group stem",
            )
        return ReleasePlan(
            queue_id=queue_id,
            queue_type="group_parent_review",
            action="keep_separate",
            member_ids=ids,
            buyer_destination="Already visible as separate companies",
            reason="group stem matched fewer than two live members",
        )

    return ReleasePlan(
        queue_id=queue_id,
        queue_type="group_parent_review",
        action="keep_separate",
        member_ids=ids,
        buyer_destination="Already visible as separate companies",
        reason=(
            "common-word cluster, not a corporate group"
            if tok in JUNK_CLUSTER_TOKENS or tok
            else "token cluster is not a curated group"
        ),
    )


def classify_fuzzy(
    *,
    queue_id: str,
    cert_id: str,
    target_id: str,
    cert_name: str,
    target_name: str,
    cert_has_rsc: bool,
    target_has_rsc: bool,
    cert_is_facility: bool,
    target_is_facility: bool,
) -> ReleasePlan:
    if cert_id == target_id:
        return ReleasePlan(
            queue_id=queue_id,
            queue_type="fuzzy_match_review",
            action="keep_separate",
            winner_id=target_id,
            buyer_destination="Already one company",
            reason="cert and target are the same row",
        )
    if cert_is_facility or target_is_facility:
        return ReleasePlan(
            queue_id=queue_id,
            queue_type="fuzzy_match_review",
            action="keep_separate",
            winner_id=target_id,
            loser_id=cert_id,
            buyer_destination="Facility rows stay on the mother, not merged",
            reason="REZ-58: never merge a building into a company",
        )
    if cert_has_rsc and target_has_rsc:
        return ReleasePlan(
            queue_id=queue_id,
            queue_type="fuzzy_match_review",
            action="keep_separate",
            winner_id=target_id,
            loser_id=cert_id,
            buyer_destination="Two RSC-inspected buildings stay two profiles",
            reason="each side has its own RSC row",
        )
    if names_are_same_company(cert_name, target_name):
        return ReleasePlan(
            queue_id=queue_id,
            queue_type="fuzzy_match_review",
            action="merge_into",
            winner_id=target_id,
            loser_id=cert_id,
            buyer_destination="One company profile; cert evidence moves onto the register row",
            reason="names are spelling/plural/spacing variants of one company",
        )
    return ReleasePlan(
        queue_id=queue_id,
        queue_type="fuzzy_match_review",
        action="keep_separate",
        winner_id=target_id,
        loser_id=cert_id,
        buyer_destination="Two different companies; both stay on Discover",
        reason="names are not the same legal entity",
    )


def classify_brand(
    *,
    queue_id: str,
    supplier_id: str,
    company_name: str,
    is_published: bool,
    is_facility: bool,
    facility_of: str | None,
    tier13_count: int,
    published_matches: list[dict[str, Any]],
) -> ReleasePlan:
    if is_facility and facility_of:
        return ReleasePlan(
            queue_id=queue_id,
            queue_type="brand_disclosure_match_review",
            action="already_attached",
            parent_id=facility_of,
            child_id=supplier_id,
            buyer_destination="Brand listing already sits on the mother Facilities section",
            reason="row is already a facility",
        )
    if is_published:
        return ReleasePlan(
            queue_id=queue_id,
            queue_type="brand_disclosure_match_review",
            action="keep_separate",
            winner_id=supplier_id,
            buyer_destination="Already visible to buyers",
            reason="brand row is already published",
        )
    if tier13_count >= 1 and not is_facility:
        return ReleasePlan(
            queue_id=queue_id,
            queue_type="brand_disclosure_match_review",
            action="publish",
            winner_id=supplier_id,
            buyer_destination="Publish as its own company — register evidence exists",
            reason="active Tier 1–3 source_record present",
        )

    exact = [
        m
        for m in published_matches
        if m.get("company_name_norm") == normalize_company_name(company_name)
        or m.get("slug") == make_slug(company_name)
    ]
    if len(exact) == 1:
        match = exact[0]
        return ReleasePlan(
            queue_id=queue_id,
            queue_type="brand_disclosure_match_review",
            action="attach_brand",
            winner_id=str(match["id"]),
            loser_id=supplier_id,
            buyer_destination="Brand listing moves onto the existing published company",
            reason="exact name/slug match to a published company",
        )

    base = extension_base_name(company_name)
    if base:
        base_slug = make_slug(base)
        base_hits = [
            m
            for m in published_matches
            if m.get("slug") == base_slug
            or m.get("company_name_norm") == normalize_company_name(base)
        ]
        if len(base_hits) == 1:
            match = base_hits[0]
            return ReleasePlan(
                queue_id=queue_id,
                queue_type="brand_disclosure_match_review",
                action="attach_facility",
                parent_id=str(match["id"]),
                child_id=supplier_id,
                buyer_destination="Unit/building attaches to the published mother",
                reason="extension_base_name matches one published company",
            )

    if len(exact) > 1:
        return ReleasePlan(
            queue_id=queue_id,
            queue_type="brand_disclosure_match_review",
            action="needs_human",
            loser_id=supplier_id,
            buyer_destination="More than one published company could own this listing",
            reason="ambiguous published match",
        )

    return ReleasePlan(
        queue_id=queue_id,
        queue_type="brand_disclosure_match_review",
        action="hold_no_register",
        loser_id=supplier_id,
        buyer_destination="Stays hidden — brand list only, no Bangladesh register",
        reason="publishing would violate the Tier 1–3 gate",
    )


def classify_queue_row(
    *,
    queue_id: str,
    queue_type: str,
    source_data: dict[str, Any] | None,
    supplier_a_id: str | None,
    child: dict[str, Any] | None = None,
    parent: dict[str, Any] | None = None,
    members: list[dict[str, Any]] | None = None,
    cert: dict[str, Any] | None = None,
    target: dict[str, Any] | None = None,
    brand_row: dict[str, Any] | None = None,
    published_matches: list[dict[str, Any]] | None = None,
) -> ReleasePlan:
    data = source_data or {}
    if queue_type == "group_parent_review" and data.get("rule") == "rsc_extension_rollup_v1":
        parent_id = data.get("parent_supplier_id")
        child_id = data.get("extension_supplier_id") or supplier_a_id
        child = child or {}
        parent = parent or {}
        return classify_extension(
            queue_id=queue_id,
            parent_id=str(parent_id) if parent_id else None,
            child_id=str(child_id),
            parent_published=parent.get("is_published") if parent else None,
            child_facility_of=child.get("facility_of"),
            child_published=bool(child.get("is_published")),
            parent_exists=bool(parent.get("id")) if parent else bool(parent_id),
        )
    if queue_type == "group_parent_review" and data.get("cluster_token"):
        return classify_cluster(
            queue_id=queue_id,
            token=str(data.get("cluster_token") or ""),
            members=members or [],
        )
    if queue_type == "fuzzy_match_review":
        cert = cert or {}
        target = target or {}
        cert_id = str(data.get("cert_supplier_id") or supplier_a_id or "")
        target_id = str(data.get("target_supplier_id") or "")
        if str(cert.get("id") or "") != cert_id or str(target.get("id") or "") != target_id:
            return ReleasePlan(
                queue_id=queue_id,
                queue_type="fuzzy_match_review",
                action="needs_human",
                winner_id=target_id or None,
                loser_id=cert_id or None,
                buyer_destination="One side of this pair is missing",
                reason="cert or target supplier row gone",
            )
        return classify_fuzzy(
            queue_id=queue_id,
            cert_id=cert_id,
            target_id=target_id,
            cert_name=str(cert.get("company_name") or data.get("cert_supplier_name") or ""),
            target_name=str(
                target.get("company_name") or data.get("target_supplier_name") or ""
            ),
            cert_has_rsc=bool(cert.get("has_rsc")),
            target_has_rsc=bool(target.get("has_rsc")),
            cert_is_facility=bool(cert.get("facility_of")),
            target_is_facility=bool(target.get("facility_of")),
        )
    if queue_type == "brand_disclosure_match_review":
        row = brand_row or child or {}
        return classify_brand(
            queue_id=queue_id,
            supplier_id=str(row.get("id") or supplier_a_id or ""),
            company_name=str(row.get("company_name") or ""),
            is_published=bool(row.get("is_published")),
            is_facility=bool(row.get("facility_of")),
            facility_of=row.get("facility_of"),
            tier13_count=int(row.get("tier13_count") or 0),
            published_matches=published_matches or [],
        )
    return ReleasePlan(
        queue_id=queue_id,
        queue_type=queue_type,
        action="needs_human",
        buyer_destination="Unknown queue type",
        reason=f"no release rule for {queue_type}",
    )
