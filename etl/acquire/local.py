"""Local-file adapter.

Two sources have no network transport at all: the BGMEA Associate Members PDF
(`etl/raw/BGMEA_Associate_Members.pdf`) and the curated BTMA spinning-mills
JSON extraction (`etl/raw/btma_spinning/pages/*.json`).

They are wired through the same interface so they produce identical evidence
rows. That closes a real gap: a scheduled run of a file-backed source currently
reports success even when the file on disk is months stale, because nothing
records where the bytes came from or when. Here the acquisition records the
absolute path, the file mtime and a content hash, so the admin console can show
"this source has not changed since <date>" instead of a green tick.

`AcquireRequest.url` carries a `file://` URL for these sources. Because there
is no live public page, the citation for a file-backed fact is the source
document's own published landing page, recorded in `sources.base_url`, plus the
Bunny-mirrored copy of the file itself.
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urlparse

from etl.acquire.base import AcquisitionAdapter
from etl.acquire.models import AcquiredDoc, AcquireRequest, Adapter, FetchStatus
from etl.core.logging import get_logger

log = get_logger("etl.acquire.local")

_EXT_CONTENT_TYPE = {
    ".pdf": "application/pdf",
    ".json": "application/json",
    ".csv": "text/csv",
    ".xml": "application/xml",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls": "application/vnd.ms-excel",
    ".html": "text/html",
    ".htm": "text/html",
    ".txt": "text/plain",
}


def path_to_url(path: Path) -> str:
    return path.resolve().as_uri()


def url_to_path(url: str) -> Path:
    if url.startswith("file://"):
        parsed = urlparse(url)
        raw = unquote(parsed.path)
        # Windows file URIs render as /E:/SourceBD/... — strip the leading slash.
        if len(raw) > 2 and raw[0] == "/" and raw[2] == ":":
            raw = raw[1:]
        return Path(raw)
    return Path(url)


class LocalFileAdapter(AcquisitionAdapter):
    """Read a file from disk as an `AcquiredDoc`."""

    name = "local"

    async def fetch(self, request: AcquireRequest) -> AcquiredDoc:
        path = url_to_path(request.url)
        meta: dict[str, object] = {"path": str(path), "verify_mode": "full"}
        if request.label:
            meta["label"] = request.label

        if not path.exists():
            log.info("local.missing", path=str(path))
            return AcquiredDoc(
                url=path_to_url(path) if path.is_absolute() else request.url,
                adapter=Adapter.LOCAL,
                fetch_status=FetchStatus.NOT_FOUND,
                error_message=f"file not found: {path}",
                meta=meta,
            )

        try:
            body = path.read_bytes()
            stat = path.stat()
        except OSError as exc:
            return AcquiredDoc(
                url=request.url,
                adapter=Adapter.LOCAL,
                fetch_status=FetchStatus.ERROR,
                error_message=f"{type(exc).__name__}: {exc}"[:500],
                meta=meta,
            )

        mtime = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc)
        meta["file_mtime"] = mtime.isoformat()
        meta["file_bytes"] = stat.st_size

        content_type = _EXT_CONTENT_TYPE.get(path.suffix.lower())
        doc = AcquiredDoc(
            url=path_to_url(path),
            adapter=Adapter.LOCAL,
            fetch_status=FetchStatus.OK,
            final_url=path_to_url(path),
            http_status=None,
            body_bytes=body,
            content_type=content_type,
            title=path.name,
            meta=meta,
        )
        if content_type in ("text/html", "application/xml", "text/plain", "text/csv"):
            doc.raw_html = body.decode("utf-8", errors="replace")
        return doc

    async def fetch_dir(
        self, directory: Path, pattern: str = "*", label: str | None = None
    ) -> list[AcquiredDoc]:
        """Acquire every matching file in a directory, sorted for determinism."""
        docs: list[AcquiredDoc] = []
        for path in sorted(directory.glob(pattern)):
            if path.is_file():
                docs.append(
                    await self.fetch(AcquireRequest(url=path_to_url(path), label=label))
                )
        return docs
