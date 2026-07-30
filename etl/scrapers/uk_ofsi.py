"""UK OFSI Consolidated Sanctions List scraper (Tier 5 regulatory).

Source (UK Office of Financial Sanctions Implementation, "2022 format" XML):
  https://ofsistorage.blob.core.windows.net/publishlive/2022format/ConList.xml

Schema (per <FinancialSanctionsTarget> element):
  Name6                  primary surname / single-line entity name
  name1..name5           given-name parts (individuals; usually empty for entities)
  GroupTypeDescription   'Entity' | 'Individual' | 'Ship'
  AliasType              'Primary name' | 'Primary name variation' | 'AKA' | 'FKA'
  GroupID                stable group identifier — multiple <FinancialSanctionsTarget>
                         rows share one GroupID for aliases and multi-address records.
  RegimeName, GroupStatus, GrpStatus ('A'=active), DateListed, LastUpdated
  Country                country of the address attached to that row
  Address1..Address6
  UKStatementOfReasons   public reason text (entities only)

We collapse all rows for one GroupID into a single SanctionEntry:
  - entity_name    = the row whose AliasType startswith 'Primary name' (Name6),
                     falling back to the first Name6 seen.
  - aliases        = every other distinct Name6 across the group.
  - country        = first non-empty Country across the group.
  - status         = GroupStatus, status_notes = UKStatementOfReasons (truncated).
  - listed_date    = earliest DateListed across the group.

We screen entities only — individuals and ships are dropped at scrape time
(same rationale as `ofac_sdn`: a Bangladesh garment factory cannot be a UK-
sanctioned individual or vessel, so keeping them only invites false positives).

Transport: direct, wrapped in the acquisition interface. A 50 MB XML document is
streamed with `iterparse` and its facts live in typed elements; a rendered
version of it would be a different document. The wrapper gives it per-field
evidence and the same admin controls as every other source.
"""
from __future__ import annotations

import io
import re
from datetime import date, datetime
from typing import AsyncIterator

from lxml import etree

from etl.acquire import AcquireRequest
from etl.core.acquiring import AcquiringSanctionScraper
from etl.core.sanctions import SanctionEntry
from etl.core.scraper import EvidenceAttachment

URL = "https://ofsistorage.blob.core.windows.net/publishlive/2022format/ConList.xml"
TARGET_TAG = "{*}FinancialSanctionsTarget"  # default xmlns is HMT schema URL

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}")


def _txt(elem, tag: str) -> str:
    """Return the stripped text of <tag> child, or '' if absent / xsi:nil."""
    child = elem.find(f"{{*}}{tag}")
    if child is None or child.text is None:
        return ""
    if child.get("{http://www.w3.org/2001/XMLSchema-instance}nil") == "true":
        return ""
    return child.text.strip()


def _parse_date(s: str) -> date | None:
    if not s:
        return None
    m = _DATE_RE.match(s)
    if not m:
        return None
    try:
        return datetime.strptime(m.group(0), "%Y-%m-%d").date()
    except ValueError:
        return None


def _full_name(elem) -> str:
    """Reassemble a multi-part name from name1..name5 + Name6 in OFSI order.

    For entities only Name6 is normally populated. For individuals OFSI splits
    the name across name1 (first), name2 (middle), ..., Name6 (last/family).
    We don't ingest individuals, but build the combined form anyway so the
    code is robust if OFSI ever populates name1+ on an entity row.
    """
    parts = [_txt(elem, f"name{i}") for i in range(1, 6)]
    parts.append(_txt(elem, "Name6"))
    parts = [p for p in parts if p]
    return " ".join(parts).strip()


def _xpath(group_id: str, tag: str | None = None) -> str:
    """Locator into ConList.xml: the group's row, optionally a field within it."""
    base = f"xml:FinancialSanctionsTarget[GroupID={group_id}]"
    return f"{base}/{tag}" if tag else base


def _row_source(elem) -> str:
    """The row's own XML as text, for excerpting.

    Tags are deliberately kept: OFSI puts nothing in attributes but everything
    in short child elements, and `<Name6>ABC Ltd</Name6>` is a verbatim slice of
    the document that the verifier can re-find. Serialising per row instead of
    holding the whole 50 MB tree keeps the streaming parse's memory profile.
    """
    try:
        return etree.tostring(elem, encoding="unicode", with_tail=False)
    except Exception:  # noqa: BLE001
        return ""


class UkOfsiScraper(AcquiringSanctionScraper):
    code = "uk_ofsi"
    source_code = "UK_OFSI"
    transport = "direct"
    fallback_transport = None
    rps = 0.5

    async def fetch(self) -> AsyncIterator[SanctionEntry]:
        doc = await self.acquire(
            AcquireRequest(url=URL, want_bytes=True, label="consolidated list XML")
        )
        if not doc.ok or not doc.body_bytes:
            raise RuntimeError(
                f"uk_ofsi: {URL} unreadable ({doc.fetch_status.value}: "
                f"{doc.error_message}). Refusing to report an empty sanctions list."
            )
        xml_bytes = doc.body_bytes

        # Group rows by GroupID. Each entry below is the merged dict for one group.
        groups: dict[str, dict] = {}

        for _event, elem in etree.iterparse(
            io.BytesIO(xml_bytes), events=("end",), tag=TARGET_TAG
        ):
            try:
                gtype = _txt(elem, "GroupTypeDescription")
                if gtype.lower() != "entity":
                    continue
                gid = _txt(elem, "GroupID")
                if not gid:
                    continue
                grp_status = _txt(elem, "GrpStatus") or "A"
                if grp_status != "A":
                    # 'I' = inactive / removed; skip.
                    continue

                name = _full_name(elem)
                if not name:
                    continue

                alias_type = _txt(elem, "AliasType").lower()
                country = _txt(elem, "Country")
                listed = _parse_date(_txt(elem, "DateListed"))
                last_upd = _parse_date(_txt(elem, "LastUpdated"))
                regime = _txt(elem, "RegimeName")
                status = _txt(elem, "GroupStatus") or "Asset Freeze Targets"
                reasons = _txt(elem, "UKStatementOfReasons")

                g = groups.setdefault(
                    gid,
                    {
                        "primary": None,
                        "names_seen": set(),
                        "aliases": [],
                        "country": "",
                        "listed": None,
                        "last_updated": None,
                        "regime": "",
                        "status": status,
                        "reasons": "",
                        "sources": [],
                    },
                )

                # A group spans several rows. Keep the XML of only the rows that
                # actually contributed a value we cite, so the excerpt haystack
                # stays small without ever missing a cited fact.
                contributed = False

                # Pick the primary-name row if we encounter one; otherwise
                # fall back to the first Name6 we saw.
                if alias_type.startswith("primary name") and g["primary"] is None:
                    g["primary"] = name
                    contributed = True
                if g["primary"] is None and name not in g["names_seen"]:
                    g["primary"] = name
                    contributed = True

                if name not in g["names_seen"]:
                    g["names_seen"].add(name)
                    if g["primary"] is not None and name != g["primary"]:
                        g["aliases"].append(name)

                if country and not g["country"]:
                    g["country"] = country
                    contributed = True
                if listed and (g["listed"] is None or listed < g["listed"]):
                    g["listed"] = listed
                    contributed = True
                if last_upd and (g["last_updated"] is None or last_upd > g["last_updated"]):
                    g["last_updated"] = last_upd
                if regime and not g["regime"]:
                    g["regime"] = regime
                if reasons and not g["reasons"]:
                    g["reasons"] = reasons[:2000]
                    contributed = True

                if contributed:
                    g["sources"].append(_row_source(elem))
            finally:
                # Free memory while streaming a 50+ MB document.
                elem.clear()
                while elem.getprevious() is not None:
                    del elem.getparent()[0]

        for gid, g in groups.items():
            primary = g["primary"]
            if not primary:
                continue
            # Reorder primary so it isn't accidentally also in aliases.
            aliases = [a for a in g["aliases"] if a != primary]
            yield SanctionEntry(
                list_code="uk_ofsi",
                source_code="UK_OFSI",
                entry_ref=f"ofsi-{gid}",
                entity_name=primary,
                aliases=aliases,
                country=g["country"] or None,
                merchandise=None,
                listed_date=g["listed"],
                status=g["status"],
                status_notes=g["reasons"] or None,
                source_url=doc.citable_url,
                raw={
                    "group_id": gid,
                    "regime": g["regime"],
                    "last_updated": g["last_updated"].isoformat() if g["last_updated"] else None,
                },
                evidence=EvidenceAttachment(
                    doc=doc,
                    locators={
                        "entity_name": _xpath(gid, "Name6"),
                        "country": _xpath(gid, "Country"),
                        "listed_date": _xpath(gid, "DateListed"),
                        "status": _xpath(gid, "GroupStatus"),
                        "status_notes": _xpath(gid, "UKStatementOfReasons"),
                    },
                    default_locator=_xpath(gid),
                    document_text="\n".join(g["sources"]),
                    document_is_html=False,
                    subject_table="sanctions_list_entries",
                ),
            )
