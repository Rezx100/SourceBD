"""Archived snapshots of acquired documents.

The provenance guarantee is "every cited link is live and still contains the
fact". Sources break that promise constantly — BGMEA renumbers member ids, CBP
pulled its Withhold Release Order page entirely — so each acquisition also
mirrors its bytes to Bunny CDN. When the live link dies, the profile can still
show a dated archived copy instead of dropping the fact or showing a 404.

Mirror layout (deterministic, so re-runs are idempotent HEAD probes):

    evidence/<scraper_code>/<YYYY-MM-DD>/<url_sha1_12>-<kind>.<ext>

`kind` is `page` (raw HTML), `md` (markdown), `file` (original bytes) or
`shot` (screenshot PNG).
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime, timezone

import httpx

from etl.acquire.models import AcquiredDoc
from etl.core import bunny
from etl.core.config import settings
from etl.core.logging import get_logger

log = get_logger("etl.evidence.snapshot")

_SHOT_TIMEOUT = httpx.Timeout(60.0, connect=20.0)


@dataclass(slots=True)
class SnapshotUrls:
    raw_html_mirror_url: str | None = None
    markdown_mirror_url: str | None = None
    file_mirror_url: str | None = None
    screenshot_mirror_url: str | None = None


def _url_key(url: str) -> str:
    return hashlib.sha1(url.encode("utf-8", errors="replace")).hexdigest()[:12]


def _path(scraper_code: str, url: str, kind: str, ext: str, when: datetime) -> str:
    day = when.astimezone(timezone.utc).date().isoformat()
    return f"evidence/{scraper_code}/{day}/{_url_key(url)}-{kind}.{ext}"


def bunny_configured() -> bool:
    return bool(settings.bunny_storage_zone and settings.bunny_storage_password)


async def _put(path: str, content: bytes, content_type: str) -> str | None:
    """Upload unless already present. Returns the CDN URL, or None on failure.

    A snapshot failure must never fail the scrape: the live URL is still
    recorded, we simply have no archived fallback for that document yet.
    """
    try:
        if await bunny.exists(path):
            return f"https://{settings.bunny_pull_zone_hostname}/{path}"
        return await bunny.upload(path, content, content_type)
    except Exception as exc:  # noqa: BLE001
        log.warning("evidence.snapshot_failed", path=path, error=str(exc))
        return None


async def mirror(
    doc: AcquiredDoc,
    scraper_code: str,
    *,
    include_markdown: bool = False,
) -> SnapshotUrls:
    """Mirror an acquired document's payload to Bunny."""
    out = SnapshotUrls()
    if not doc.ok or not bunny_configured():
        if not bunny_configured():
            log.debug("evidence.snapshot_skipped", reason="bunny_not_configured")
        return out

    when = doc.fetched_at
    url = doc.url

    if doc.raw_html:
        out.raw_html_mirror_url = await _put(
            _path(scraper_code, url, "page", "html", when),
            doc.raw_html.encode("utf-8", errors="replace"),
            "text/html; charset=utf-8",
        )

    if include_markdown and doc.markdown:
        out.markdown_mirror_url = await _put(
            _path(scraper_code, url, "md", "md", when),
            doc.markdown.encode("utf-8", errors="replace"),
            "text/markdown; charset=utf-8",
        )

    # Non-HTML payloads (PDF, CSV, XML, XLSX, JSON) — mirror the bytes as-is so
    # the archived copy is the original artefact, not our rendering of it.
    if doc.body_bytes and not doc.raw_html:
        ext = _ext_for(doc.content_type)
        out.file_mirror_url = await _put(
            _path(scraper_code, url, "file", ext, when),
            doc.body_bytes,
            doc.content_type or "application/octet-stream",
        )

    # Firecrawl screenshot URLs expire after 24h, so re-host immediately.
    if doc.screenshot_url:
        shot = await _download(doc.screenshot_url)
        if shot:
            out.screenshot_mirror_url = await _put(
                _path(scraper_code, url, "shot", "png", when), shot, "image/png"
            )

    return out


async def _download(url: str) -> bytes | None:
    try:
        async with httpx.AsyncClient(timeout=_SHOT_TIMEOUT, follow_redirects=True) as client:
            resp = await client.get(url)
        if resp.status_code == 200:
            return resp.content
        log.warning("evidence.shot_fetch_status", status=resp.status_code)
    except Exception as exc:  # noqa: BLE001
        log.warning("evidence.shot_fetch_failed", error=str(exc))
    return None


_EXT_BY_TYPE = {
    "application/pdf": "pdf",
    "application/json": "json",
    "text/csv": "csv",
    "application/xml": "xml",
    "text/xml": "xml",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-excel": "xls",
    "text/plain": "txt",
}


def _ext_for(content_type: str | None) -> str:
    if not content_type:
        return "bin"
    base = content_type.split(";")[0].strip().lower()
    return _EXT_BY_TYPE.get(base, "bin")
