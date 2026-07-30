"""EU Consolidated Sanctions List scraper (Tier 5 regulatory).

Source (EU Financial Sanctions Database public XML, version 1.1):
  https://webgate.ec.europa.eu/fsd/fsf/public/files/xmlFullSanctionsList_1_1/content?token=dG9rZW4tMjAxNw

The token is a fixed public token published by the EU Commission for unauthenticated
access; it does not contain any per-user secret.

Schema (one <sanctionEntity> per designated person/group):
  <sanctionEntity logicalId="123" euReferenceNumber="EU.123.456" designationDate="...">
    <subjectType code="enterprise" classificationCode="..."/>      <!-- 'person' | 'enterprise' -->
    <regulation regulationType="..." publicationDate="..." publicationUrl="..."/>
    <remark>...</remark>
    <nameAlias wholeName="ABC Trading Ltd" firstName="" function="" ... strong="true"/>
    <nameAlias wholeName="ABC Ltd" .../>
    <address city="..." countryDescription="..."/>
  </sanctionEntity>

We ingest one SanctionEntry per <sanctionEntity> with subjectType code=='enterprise':
  - entry_ref      = f"eu-{logicalId}"
  - entity_name    = first <nameAlias.wholeName> (the canonical legal name)
  - aliases        = remaining distinct wholeName values
  - country        = first non-empty address.countryDescription
  - listed_date    = parsed from designationDate
  - status         = 'EU consolidated sanctions'
  - status_notes   = first <remark> text (truncated)

Transport: direct, wrapped in the acquisition interface. The payload is XML
streamed with `iterparse`, and most of its facts live in attributes, so it must
be read as XML rather than as a rendering of XML. The wrapper is what gives it
per-field evidence and the shared admin surface.
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

URL = (
    "https://webgate.ec.europa.eu/fsd/fsf/public/files/"
    "xmlFullSanctionsList_1_1/content?token=dG9rZW4tMjAxNw"
)

# The EU XML carries a default xmlns. Use local-name() based matching by
# stripping namespaces with iterparse(tag="*") and comparing on QName.localname.
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}")


def _parse_date(s: str | None) -> date | None:
    if not s:
        return None
    m = _DATE_RE.match(s)
    if not m:
        return None
    try:
        return datetime.strptime(m.group(0), "%Y-%m-%d").date()
    except ValueError:
        return None


def _local_iter(parent, name: str):
    for child in parent:
        if etree.QName(child).localname == name:
            yield child


def _local_first(parent, name: str):
    for child in parent:
        if etree.QName(child).localname == name:
            return child
    return None


def _xpath(logical_id: str, part: str | None = None) -> str:
    base = f"xml:sanctionEntity[logicalId={logical_id}]"
    return f"{base}/{part}" if part else base


class EuSanctionsScraper(AcquiringSanctionScraper):
    code = "eu_sanctions"
    source_code = "EU_SANC"
    transport = "direct"
    fallback_transport = None
    rps = 0.5

    async def fetch(self) -> AsyncIterator[SanctionEntry]:
        doc = await self.acquire(
            AcquireRequest(url=URL, want_bytes=True, label="EU consolidated list XML")
        )
        if not doc.ok or not doc.body_bytes:
            raise RuntimeError(
                f"eu_sanctions: {URL} unreadable ({doc.fetch_status.value}: "
                f"{doc.error_message}). Refusing to report an empty sanctions list."
            )
        xml_bytes = doc.body_bytes

        for _event, ent in etree.iterparse(
            io.BytesIO(xml_bytes),
            events=("end",),
            tag="{*}sanctionEntity",
        ):
            try:
                logical_id = ent.get("logicalId") or ent.get("euReferenceNumber")
                if not logical_id:
                    continue

                subj = _local_first(ent, "subjectType")
                code = (subj.get("code") if subj is not None else "") or ""
                # 'enterprise' is the EU code for legal entities; some legacy
                # rows use 'E'. Anything else (person/individual) is dropped.
                if code.lower() not in ("enterprise", "e"):
                    continue

                designation = ent.get("designationDate")

                names: list[str] = []
                for na in _local_iter(ent, "nameAlias"):
                    whole = (na.get("wholeName") or "").strip()
                    if whole and whole not in names:
                        names.append(whole)
                if not names:
                    continue
                entity_name = names[0]
                aliases = names[1:]

                country = ""
                for addr in _local_iter(ent, "address"):
                    c = (addr.get("countryDescription") or "").strip()
                    if c and c.lower() != "unknown":
                        country = c
                        break

                remark = _local_first(ent, "remark")
                remark_txt = (remark.text or "").strip() if remark is not None else ""

                reg = _local_first(ent, "regulation")
                publication_url = (reg.get("publicationUrl") if reg is not None else "") or ""

                # Serialise before the yield: the `finally` below clears the
                # element to keep the streaming parse's memory flat, so after
                # the consumer resumes there is nothing left to excerpt from.
                # Tags and attributes are kept deliberately — `wholeName="…"`
                # is where the EU states the name, so stripping markup would
                # leave every claim without a checkable excerpt.
                try:
                    entity_source = etree.tostring(
                        ent, encoding="unicode", with_tail=False
                    )
                except Exception:  # noqa: BLE001
                    entity_source = ""

                yield SanctionEntry(
                    list_code="eu_sanctions",
                    source_code="EU_SANC",
                    entry_ref=f"eu-{logical_id}",
                    entity_name=entity_name,
                    aliases=aliases,
                    country=country or None,
                    merchandise=None,
                    listed_date=_parse_date(designation),
                    status="EU consolidated sanctions",
                    status_notes=remark_txt[:2000] or None,
                    source_url=publication_url or URL,
                    raw={
                        "logical_id": logical_id,
                        "eu_reference_number": ent.get("euReferenceNumber"),
                        "subject_type_code": code,
                    },
                    evidence=EvidenceAttachment(
                        doc=doc,
                        locators={
                            "entity_name": _xpath(logical_id, "nameAlias/@wholeName"),
                            "listed_date": _xpath(logical_id, "@designationDate"),
                            "status_notes": _xpath(logical_id, "remark"),
                        },
                        default_locator=_xpath(logical_id),
                        document_text=entity_source,
                        document_is_html=False,
                        subject_table="sanctions_list_entries",
                        # A label we assign to every row on this list rather
                        # than text the EU prints per entity.
                        skip_keys=("status",),
                    ),
                )
            finally:
                ent.clear()
                while ent.getprevious() is not None:
                    del ent.getparent()[0]
