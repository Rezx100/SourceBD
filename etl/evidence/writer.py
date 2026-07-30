"""Persist evidence documents and per-field claims.

Called by scrapers right after a successful upsert. The contract is
deliberately narrow:

    doc_id = await record_document(doc, scraper_code="bgmea_web", source_code="BGMEA")
    record_claims(doc_id, subject_table="suppliers", subject_id=..., payload=...,
                  document_text=doc.text(), locator_for=..., source_tier="tier2_industry")

Idempotency: `evidence_documents` is unique on (url_hash, content_sha256), so
re-acquiring an unchanged page reuses the existing row. When the page changed,
a NEW document row is inserted and the claims re-point at it — that is how the
history of what a source said, and when, is preserved.
"""
from __future__ import annotations

import json
from typing import Any, Iterable, Sequence

from etl.acquire.models import AcquiredDoc, FetchStatus
from etl.core.db import db, get_source_id
from etl.core.logging import get_logger
from etl.evidence import snapshot
from etl.evidence.locate import (
    iter_claimable,
    make_excerpt,
    strips_tags_for,
    value_hash,
)

log = get_logger("etl.evidence.writer")

# Payload keys that are plumbing, not facts about the supplier.
DEFAULT_SKIP_KEYS = frozenset(
    {
        "raw",
        "source_url",
        "mirror_url",
        "country",
        "active",
    }
)

# Within one run, the same document usually backs many records — a registry list
# page cites hundreds of suppliers. Without this cache we would re-mirror to
# Bunny and re-run the upsert once per record, and the ON CONFLICT credit
# accumulator would bill one page hundreds of times.
_DOC_CACHE: dict[tuple[str, str], str] = {}


def reset_document_cache() -> None:
    """Clear the per-run document cache. Called at the start of every run."""
    _DOC_CACHE.clear()


async def record_document(
    doc: AcquiredDoc,
    *,
    scraper_code: str,
    source_code: str | None = None,
    etl_run_id: str | None = None,
    take_snapshot: bool = True,
    include_markdown_snapshot: bool = False,
    citable_url_override: str | None = None,
) -> str | None:
    """Upsert one `evidence_documents` row. Returns its id, or None on failure.

    Records failures too (with the appropriate `fetch_status`), because "we
    tried to read this citation and got a 404" is exactly the signal the admin
    console needs. Only a genuinely unusable input returns None.
    """
    cache_key = (doc.url, doc.content_sha256)
    cached = _DOC_CACHE.get(cache_key)
    if cached is not None:
        return cached

    snap = snapshot.SnapshotUrls()
    if take_snapshot and doc.ok:
        snap = await snapshot.mirror(
            doc, scraper_code, include_markdown=include_markdown_snapshot
        )

    source_id: str | None = None
    if source_code:
        try:
            source_id = get_source_id(source_code)
        except Exception as exc:  # noqa: BLE001
            log.warning("evidence.unknown_source", source_code=source_code, error=str(exc))

    # A fresh acquisition is 'live' when it succeeded and 'dead' when the page
    # is definitively gone. Transient failures stay 'unverified' so the verifier
    # decides later — a timeout must never look like a dead citation.
    if doc.fetch_status is FetchStatus.OK:
        verify_status = "live"
    elif doc.fetch_status is FetchStatus.NOT_FOUND:
        verify_status = "dead"
    else:
        verify_status = "unverified"

    sql = """
    insert into public.evidence_documents (
      source_id, scraper_code, etl_run_id,
      url, final_url, adapter, http_status, fetch_status,
      firecrawl_error_code, error_message,
      content_sha256, content_bytes, content_type, title,
      raw_html_mirror_url, markdown_mirror_url, screenshot_mirror_url, file_mirror_url,
      credits_used, fetched_at,
      last_verified_at, verify_status, meta
    )
    values (
      %(source_id)s, %(scraper_code)s, %(etl_run_id)s,
      %(url)s, %(final_url)s, %(adapter)s, %(http_status)s, %(fetch_status)s,
      %(error_code)s, %(error_message)s,
      %(content_sha256)s, %(content_bytes)s, %(content_type)s, %(title)s,
      %(raw_html_mirror_url)s, %(markdown_mirror_url)s, %(screenshot_mirror_url)s,
      %(file_mirror_url)s,
      %(credits_used)s, %(fetched_at)s,
      %(verified_at)s, %(verify_status)s, %(meta)s::jsonb
    )
    on conflict (url_hash, content_sha256) do update set
      final_url             = coalesce(excluded.final_url, public.evidence_documents.final_url),
      http_status           = excluded.http_status,
      fetch_status          = excluded.fetch_status,
      firecrawl_error_code  = excluded.firecrawl_error_code,
      error_message         = excluded.error_message,
      content_bytes         = coalesce(excluded.content_bytes, public.evidence_documents.content_bytes),
      content_type          = coalesce(excluded.content_type, public.evidence_documents.content_type),
      title                 = coalesce(excluded.title, public.evidence_documents.title),
      raw_html_mirror_url   = coalesce(excluded.raw_html_mirror_url, public.evidence_documents.raw_html_mirror_url),
      markdown_mirror_url   = coalesce(excluded.markdown_mirror_url, public.evidence_documents.markdown_mirror_url),
      screenshot_mirror_url = coalesce(excluded.screenshot_mirror_url, public.evidence_documents.screenshot_mirror_url),
      file_mirror_url       = coalesce(excluded.file_mirror_url, public.evidence_documents.file_mirror_url),
      credits_used          = public.evidence_documents.credits_used + excluded.credits_used,
      etl_run_id            = coalesce(excluded.etl_run_id, public.evidence_documents.etl_run_id),
      last_verified_at      = excluded.last_verified_at,
      verify_status         = excluded.verify_status,
      transient_failures    = 0,
      meta                  = public.evidence_documents.meta || excluded.meta
    returning id
    """

    params = {
        "source_id": source_id,
        "scraper_code": scraper_code,
        "etl_run_id": etl_run_id,
        "url": doc.url,
        # `final_url` is the link the UI actually offers a buyer, so an override
        # takes precedence here rather than at render time — otherwise the
        # expiring URL would still leak out through any consumer that reads the
        # row directly.
        "final_url": citable_url_override or doc.final_url,
        "adapter": doc.adapter.value,
        "http_status": doc.http_status,
        "fetch_status": doc.fetch_status.value,
        "error_code": doc.error_code,
        "error_message": (doc.error_message or None),
        "content_sha256": doc.content_sha256,
        "content_bytes": doc.content_bytes_len or None,
        "content_type": doc.content_type,
        "title": (doc.title or None),
        "raw_html_mirror_url": snap.raw_html_mirror_url,
        "markdown_mirror_url": snap.markdown_mirror_url,
        "screenshot_mirror_url": snap.screenshot_mirror_url,
        "file_mirror_url": snap.file_mirror_url,
        "credits_used": doc.credits_used,
        "fetched_at": doc.fetched_at,
        "verified_at": doc.fetched_at if doc.ok else None,
        "verify_status": verify_status,
        "meta": json.dumps(doc.meta, ensure_ascii=False, default=str),
    }

    try:
        with db.conn() as c, c.cursor() as cur:
            cur.execute(sql, params)
            row = cur.fetchone()
            c.commit()
    except Exception as exc:  # noqa: BLE001
        log.error("evidence.document_write_failed", url=doc.url, error=str(exc))
        return None

    if not row:
        return None
    doc_id = str(row["id"])
    _DOC_CACHE[cache_key] = doc_id
    return doc_id


def _locator_for(
    field_key: str, loc_map: dict[str, str], default: str | None
) -> str | None:
    """Resolve a field's locator, allowing a `prefix.*` wildcard.

    Flattened sub-fields (`employees.male`, `certifications.bsci`) all live in one
    place on the page, so sources declare `employees.*` once instead of listing
    every key a publisher might add later.
    """
    if field_key in loc_map:
        return loc_map[field_key]
    if "." in field_key:
        wildcard = loc_map.get(field_key.split(".", 1)[0] + ".*")
        if wildcard:
            return wildcard
    return default


def excerpt_source(document_text: str | None, doc: AcquiredDoc) -> str:
    """Where `record` should search for excerpts.

    Three cases, and the distinction between the last two is the whole point:

    * a caller-supplied slice is used as given;
    * None means the caller did not scope anything, so the document body is the
      right haystack — sound when that body describes one subject;
    * `NO_EXCERPT` means the caller tried to scope and could not, so there is no
      sound haystack at all and no excerpt may be taken.

    Testing None for identity rather than truthiness is therefore load-bearing.
    A truthiness check would collapse `NO_EXCERPT` into the body fallback and
    silently reinstate page-wide excerpt matching on multi-record documents,
    where it can quote one subject's value as another's.
    """
    if document_text is None:
        return doc.text()
    return document_text


def record_claims(
    evidence_id: str,
    *,
    subject_table: str,
    subject_id: str | None,
    payload: dict[str, Any],
    document_text: str | None,
    subject_key: str | None = None,
    supplier_id: str | None = None,
    source_tier: str | None = None,
    locators: dict[str, str] | None = None,
    default_locator: str | None = None,
    skip_keys: Iterable[str] = (),
    document_is_html: bool | None = None,
) -> int:
    """Write one claim per citable scalar field. Returns the number written.

    Fields whose value cannot be found in the source text still get a claim,
    with a NULL excerpt. That is intentional and important: a claim we cannot
    drift-verify is visible as such in the admin console rather than being
    quietly counted as verified.

    Note `document_text` means something different here than in `record`: this
    function excerpts against exactly what it is given, so None yields no
    excerpts at all. `record` instead falls back to the whole document body,
    which is only sound when that body describes a single subject. Callers
    scoping a record out of a multi-record document should pass `NO_EXCERPT`
    rather than None when the record cannot be isolated.
    """
    if not evidence_id:
        return 0
    if subject_id is None and subject_key is None:
        log.warning(
            "evidence.claims_unaddressable",
            subject_table=subject_table,
            evidence_id=evidence_id,
        )
        return 0

    skip = set(DEFAULT_SKIP_KEYS) | set(skip_keys)
    pairs = iter_claimable(payload, skip=skip)
    if not pairs:
        return 0

    loc_map = locators or {}
    rows: list[tuple[Any, ...]] = []
    for field_key, value in pairs:
        excerpt = make_excerpt(document_text, value, is_html=document_is_html)
        rows.append(
            (
                evidence_id,
                supplier_id,
                subject_table,
                subject_id,
                subject_key,
                field_key,
                str(value)[:2000],
                value_hash(value),
                _locator_for(field_key, loc_map, default_locator),
                excerpt,
                source_tier,
            )
        )

    sql = """
    insert into public.evidence_claims (
      evidence_id, supplier_id, subject_table, subject_id, subject_key,
      field_key, field_value, value_sha256, locator, excerpt, source_tier
    )
    values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::source_tier)
    on conflict (subject_table, subject_id, subject_key, field_key, evidence_id) do update set
      field_value       = excluded.field_value,
      value_sha256      = excluded.value_sha256,
      locator           = coalesce(excluded.locator, public.evidence_claims.locator),
      excerpt           = coalesce(excluded.excerpt, public.evidence_claims.excerpt),
      supplier_id       = coalesce(excluded.supplier_id, public.evidence_claims.supplier_id),
      source_tier       = coalesce(excluded.source_tier, public.evidence_claims.source_tier),
      status            = 'active',
      last_confirmed_at = now(),
      updated_at        = now()
    """

    try:
        with db.conn() as c, c.cursor() as cur:
            cur.executemany(sql, rows)
            c.commit()
    except Exception as exc:  # noqa: BLE001
        log.error(
            "evidence.claims_write_failed",
            evidence_id=evidence_id,
            subject_table=subject_table,
            error=str(exc),
        )
        return 0

    return len(rows)


def supersede_claims(
    subject_table: str,
    subject_id: str | None,
    keep_evidence_id: str,
    field_keys: Sequence[str],
    subject_key: str | None = None,
) -> int:
    """Mark older claims for the same fields as superseded.

    When a source republishes a page, the previous document's claims for those
    fields are no longer the current citation. They become `stale` rather than
    being deleted, so the history of what was cited when is not destroyed.
    """
    if not field_keys:
        return 0
    sql = """
    update public.evidence_claims
       set status = 'stale', updated_at = now()
     where subject_table = %s
       and subject_id is not distinct from %s
       and subject_key is not distinct from %s
       and field_key = any(%s)
       and evidence_id <> %s
       and status = 'active'
    """
    try:
        with db.conn() as c, c.cursor() as cur:
            cur.execute(
                sql,
                (
                    subject_table, subject_id, subject_key,
                    list(field_keys), keep_evidence_id,
                ),
            )
            count = cur.rowcount or 0
            c.commit()
    except Exception as exc:  # noqa: BLE001
        log.error("evidence.supersede_failed", error=str(exc))
        return 0
    return count


async def record(
    doc: AcquiredDoc,
    *,
    scraper_code: str,
    source_code: str | None,
    subject_table: str,
    subject_id: str | None,
    payload: dict[str, Any],
    subject_key: str | None = None,
    supplier_id: str | None = None,
    source_tier: str | None = None,
    etl_run_id: str | None = None,
    locators: dict[str, str] | None = None,
    default_locator: str | None = None,
    skip_keys: Iterable[str] = (),
    supersede: bool = True,
    document_text: str | None = None,
    document_is_html: bool | None = None,
    citable_url_override: str | None = None,
) -> tuple[str | None, int]:
    """Convenience wrapper: record the document, then its claims.

    `document_text` overrides where excerpts are searched — needed when values
    were parsed from a different representation than the document body, e.g. the
    text layer of a PDF page rather than the raw file bytes.
    """
    haystack = excerpt_source(document_text, doc)
    if document_is_html is None:
        document_is_html = strips_tags_for(doc.content_type, haystack)
    doc_id = await record_document(
        doc,
        scraper_code=scraper_code,
        source_code=source_code,
        etl_run_id=etl_run_id,
        citable_url_override=citable_url_override,
    )
    if doc_id is None:
        return None, 0

    written = record_claims(
        doc_id,
        subject_table=subject_table,
        subject_id=subject_id,
        subject_key=subject_key,
        payload=payload,
        document_text=haystack,
        supplier_id=supplier_id,
        source_tier=source_tier,
        locators=locators,
        default_locator=default_locator,
        skip_keys=skip_keys,
        document_is_html=document_is_html,
    )

    if supersede and written and (subject_id or subject_key):
        keys = [k for k, _ in iter_claimable(payload, skip=set(DEFAULT_SKIP_KEYS) | set(skip_keys))]
        supersede_claims(subject_table, subject_id, doc_id, keys, subject_key=subject_key)

    return doc_id, written
