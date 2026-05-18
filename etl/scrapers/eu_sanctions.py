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
"""
from __future__ import annotations

import io
import re
from datetime import date, datetime
from typing import AsyncIterator

from lxml import etree

from etl.core.http import HttpClient
from etl.core.sanctions import BaseSanctionScraper, SanctionEntry

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


class EuSanctionsScraper(BaseSanctionScraper):
    code = "eu_sanctions"
    source_code = "EU_SANC"

    async def fetch(self) -> AsyncIterator[SanctionEntry]:
        async with HttpClient(rps=0.5) as http:
            resp = await http.get(URL)
            xml_bytes = resp.content

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
                )
            finally:
                ent.clear()
                while ent.getprevious() is not None:
                    del ent.getparent()[0]
