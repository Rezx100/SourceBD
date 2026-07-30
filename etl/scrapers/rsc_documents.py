"""Spec 13 — RSC document mirror.

Mirrors per-factory compliance documents (fire / structural / electrical /
boiler inspection reports + CAP) from their origin URLs (cached in
`public.rsc_remediation` by `etl/scrapers/rsc.py` from the Accord JSON API) to
Bunny CDN under `rsc-docs/<supplier_slug>/<doc_type>-<fetched_date>.<ext>`,
persisting provenance in `public.compliance_documents`.

Per-factory pipeline:
  1. SELECT supplier_id, slug + 5 URL columns from rsc_remediation joined to
     suppliers, optionally filtered by --supplier-slug and limited by --limit.
  2. For each (supplier, doc_type) where the URL is not NULL and is not yet
     mirrored at the deterministic mirror path with a matching DB row, download
     the file (httpx, retries on transient errors).
  3. Compute sha256, infer extension from URL or Content-Type.
  4. HEAD-probe Bunny mirror path; upload if absent. On failure, set
     `mirror_url=NULL` so the UI hot-links the origin.
  5. UPSERT into compliance_documents on (supplier_id, doc_type, sha256).

Idempotent on (supplier_id, doc_type, sha256): an unchanged file is a no-op,
an updated file inserts a new history row.

Transport: direct, wrapped in the acquisition interface. These are binary
downloads — the point is the exact bytes, so a rendered version of them is
useless. What the wrapper adds is an `evidence_documents` row per file, so a
mirrored inspection report is covered by the same liveness checking, archive
link and admin view as every other citation.
"""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Iterable

from etl.acquire import AcquireRequest
from etl.core.acquiring import AcquiringScraper
from etl.core.bunny import exists as bunny_exists, upload as bunny_upload
from etl.core.db import db
from etl.core.scraper import ScrapedRecord
from etl.core.ssl_rsc import build_rsc_ssl_context

_DOC_COLUMNS: list[tuple[str, str]] = [
    ("fire",       "fire_inspection_url"),
    ("structural", "structural_inspection_url"),
    ("electrical", "electrical_inspection_url"),
    ("boiler",     "boiler_inspection_url"),
    ("cap",        "cap_url"),
]

_CT_EXT = {
    "application/pdf":  "pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-excel": "xls",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
}

_URL_EXT_RE = re.compile(r"\.(pdf|xlsx|xls|docx?|jpe?g|png)(?:[?#]|$)", re.IGNORECASE)


@dataclass
class _DocRef:
    supplier_id: str
    supplier_slug: str
    doc_type: str
    url: str


def _ext_from_url(url: str) -> str | None:
    m = _URL_EXT_RE.search(url)
    return m.group(1).lower() if m else None


def _ext_from_doc(content_type: str | None, disposition: str | None) -> str | None:
    ct = (content_type or "").split(";", 1)[0].strip().lower()
    if ct in _CT_EXT:
        return _CT_EXT[ct]
    m = re.search(r'filename\*?=(?:UTF-8\'\')?"?([^";]+)', disposition or "")
    if m:
        e = _ext_from_url(m.group(1))
        if e:
            return e
    return None


def _select_rows(supplier_slug: str | None, limit: int | None) -> list[dict]:
    sql = """
        select s.id as supplier_id,
               s.slug as supplier_slug,
               r.fire_inspection_url,
               r.structural_inspection_url,
               r.electrical_inspection_url,
               r.boiler_inspection_url,
               r.cap_url
        from public.rsc_remediation r
        join public.suppliers s on s.id = r.supplier_id
        where r.active = true
          and (
              r.fire_inspection_url is not null
           or r.structural_inspection_url is not null
           or r.electrical_inspection_url is not null
           or r.boiler_inspection_url is not null
           or r.cap_url is not null
          )
    """
    params: list = []
    if supplier_slug:
        sql += " and s.slug = %s"
        params.append(supplier_slug)
    sql += " order by s.slug"
    if limit:
        sql += f" limit {int(limit)}"
    with db.conn() as c, c.cursor() as cur:
        cur.execute(sql, params)
        return list(cur.fetchall())


def _enumerate(rows: list[dict]) -> Iterable[_DocRef]:
    for row in rows:
        for doc_type, col in _DOC_COLUMNS:
            url = row[col]
            if not url:
                continue
            yield _DocRef(
                supplier_id=str(row["supplier_id"]),
                supplier_slug=row["supplier_slug"],
                doc_type=doc_type,
                url=url,
            )


def _mirror_path(slug: str, doc_type: str, ext: str, fetched_date: str) -> str:
    return f"rsc-docs/{slug}/{doc_type}-{fetched_date}.{ext}"


def _upsert_doc(
    supplier_id: str,
    doc_type: str,
    original_url: str,
    mirror_url: str | None,
    sha256: str,
    file_size: int,
    content_type: str | None,
) -> tuple[str, str]:
    """Insert or update a compliance_documents row.

    Returns ('inserted' | 'updated', row id). The id is what an evidence claim
    points at, so provenance attaches to this specific version of the file
    rather than to whatever the latest one happens to be.
    """
    with db.conn() as c, c.cursor() as cur:
        cur.execute(
            """insert into public.compliance_documents
                 (supplier_id, doc_type, source, original_url, mirror_url,
                  sha256, file_size, content_type, fetched_at)
               values (%s, %s, 'rsc', %s, %s, %s, %s, %s, now())
               on conflict (supplier_id, doc_type, sha256) do update set
                   original_url = excluded.original_url,
                   mirror_url   = coalesce(excluded.mirror_url, public.compliance_documents.mirror_url),
                   content_type = coalesce(excluded.content_type, public.compliance_documents.content_type),
                   file_size    = excluded.file_size,
                   fetched_at   = now()
               returning id,
                         (xmax = 0) as inserted,
                         mirror_url
            """,
            (supplier_id, doc_type, original_url, mirror_url,
             sha256, file_size, content_type),
        )
        row = cur.fetchone()
        c.commit()
    return ("inserted" if row["inserted"] else "updated"), str(row["id"])


class RscDocumentsScraper(AcquiringScraper):
    code = "rsc_documents"
    source_code = "RSC"
    transport = "direct"
    fallback_transport = None
    # `run()` catalogs documents directly; `fetch()` is a stub.
    yields_records = False

    def __init__(
        self,
        supplier_slug: str | None = None,
        limit: int | None = None,
        **kwargs: Any,
    ) -> None:
        super().__init__(**kwargs)
        self._supplier_slug = supplier_slug
        self._limit = limit

    def direct_verify(self):
        """rsc-bd.org omits its Sectigo intermediate, so add it to the trust store.

        The context is certifi plus that one intermediate, i.e. a strict
        superset, so it is also correct for the non-RSC hosts some CAP documents
        are served from — one adapter instead of two clients keyed by hostname.
        """
        return build_rsc_ssl_context()

    async def fetch(self) -> AsyncIterator[ScrapedRecord]:  # not used
        if False:
            yield  # type: ignore[unreachable]

    async def run(self) -> dict[str, int]:  # type: ignore[override]
        from etl.evidence.writer import record_claims, record_document, reset_document_cache
        from etl.core.upsert import _tier_for

        run_id = self._open_run()
        reset_document_cache()
        seen = upserted = skipped = 0
        bytes_uploaded = 0
        bytes_downloaded = 0
        mirror_failed = 0
        today = datetime.now(timezone.utc).date().isoformat()

        try:
            rows = _select_rows(self._supplier_slug, self._limit)
            self.log.info("rsc_docs.suppliers_selected", n=len(rows))

            # Pre-flight: ensure Bunny credentials are present (raises if not).
            await bunny_exists("rsc-docs/.healthcheck")

            for ref in _enumerate(rows):
                seen += 1
                try:
                    doc = await self.acquire(
                        AcquireRequest(
                            url=ref.url,
                            want_bytes=True,
                            label=f"{ref.supplier_slug} {ref.doc_type}",
                        )
                    )
                    if not doc.ok or doc.body_bytes is None:
                        raise RuntimeError(
                            f"{doc.fetch_status.value}: {doc.error_message}"
                        )
                    content = doc.body_bytes
                    bytes_downloaded += len(content)
                    sha = hashlib.sha256(content).hexdigest()
                    disposition = doc.meta.get("content_disposition")
                    ext = (
                        _ext_from_url(ref.url)
                        or _ext_from_doc(doc.content_type, disposition)
                        or "bin"
                    )
                    content_type = (
                        (doc.content_type or "").split(";", 1)[0].strip() or None
                    )

                    path = _mirror_path(ref.supplier_slug, ref.doc_type, ext, today)
                    mirror_url: str | None = None
                    try:
                        if await bunny_exists(path):
                            # Bunny already has an object at this deterministic path
                            # for today's date; use the public URL as-is.
                            from etl.core.config import settings as _s
                            mirror_url = (
                                f"https://{_s.bunny_pull_zone_hostname}/{path}"
                            )
                        else:
                            mirror_url = await bunny_upload(path, content, content_type)
                            bytes_uploaded += len(content)
                    except Exception as e:  # noqa: BLE001
                        mirror_failed += 1
                        self.log.warn(
                            "rsc_docs.mirror_failed",
                            supplier=ref.supplier_slug,
                            doc_type=ref.doc_type,
                            error=str(e)[:200],
                        )
                        mirror_url = None  # hot-link fallback

                    _, doc_row_id = _upsert_doc(
                        supplier_id=ref.supplier_id,
                        doc_type=ref.doc_type,
                        original_url=ref.url,
                        mirror_url=mirror_url,
                        sha256=sha,
                        file_size=len(content),
                        content_type=content_type,
                    )
                    upserted += 1
                    await self._cite_file(
                        doc, ref, sha, len(content), doc_row_id, run_id,
                        record_document, record_claims, _tier_for,
                    )
                except Exception as e:  # noqa: BLE001
                    skipped += 1
                    self.log.error(
                        "rsc_docs.failed",
                        supplier=ref.supplier_slug,
                        doc_type=ref.doc_type,
                        url=ref.url,
                        error=str(e)[:300],
                    )
                if seen % 100 == 0:
                    self.log.info(
                        "rsc_docs.progress",
                        seen=seen, upserted=upserted, skipped=skipped,
                        mirror_failed=mirror_failed,
                        bytes_uploaded=bytes_uploaded,
                    )

            self._close_run(run_id, "success", seen, upserted, skipped, None)
        except Exception as e:  # noqa: BLE001
            self._close_run(run_id, "failed", seen, upserted, skipped, str(e))
            raise
        finally:
            await self.aclose()

        return {
            "seen": seen,
            "upserted": upserted,
            "skipped": skipped,
            "mirror_failed": mirror_failed,
            "bytes_downloaded": bytes_downloaded,
            "bytes_uploaded": bytes_uploaded,
            "transport": self.active_transport,
            "evidence_documents": self.evidence_documents,
            "evidence_claims": self.evidence_claims,
        }

    async def _cite_file(
        self,
        doc,
        ref: "_DocRef",
        sha: str,
        size: int,
        doc_row_id: str,
        run_id: str | None,
        record_document,
        record_claims,
        _tier_for,
    ) -> None:
        """Record provenance for one mirrored file.

        A binary has no text to excerpt, so the claim is anchored on the file's
        digest instead: the verifier re-fetches the origin URL and compares
        `content_sha256`, which answers the question that actually matters here —
        is the inspection report we archived still the report RSC publishes?
        """
        evidence_id = await record_document(
            doc,
            scraper_code=self.code,
            source_code=self.source_code,
            etl_run_id=run_id,
        )
        if not evidence_id:
            return
        self._evidence_doc_ids.add(evidence_id)
        self.evidence_claims += record_claims(
            evidence_id,
            subject_table="compliance_documents",
            subject_id=doc_row_id,
            supplier_id=ref.supplier_id,
            payload={"document_sha256": sha, "file_size": size},
            document_text=None,
            source_tier=_tier_for(self.source_code),
            locators={
                "document_sha256": f"file:{ref.doc_type} (sha256 of the downloaded bytes)",
                "file_size": f"file:{ref.doc_type} (byte length)",
            },
        )
