"""BunnyCDN raw-document mirror.

Uploads bytes to the SourceBD storage zone and returns the public CDN URL.

Auth model:
- PUT to `https://{storage_hostname}/{storage_zone}/{path}` with header
  `AccessKey: {storage_password}`. Returns 201 on success.
- Read back via `https://{pull_zone_hostname}/{path}` (CDN edge).

Idempotent: caller-supplied path is the unique key. Re-uploading the same
path overwrites in-place (Bunny PUT semantics). The HEAD probe lets callers
skip re-downloading + re-uploading when the file is already mirrored.
"""
from __future__ import annotations

from typing import Final

import httpx

from etl.core.config import settings
from etl.core.logging import get_logger

log = get_logger("etl.bunny")

_PUT_TIMEOUT: Final = httpx.Timeout(120.0, connect=20.0)


def _public_url(path: str) -> str:
    return f"https://{settings.bunny_pull_zone_hostname}/{path.lstrip('/')}"


def _storage_url(path: str) -> str:
    return (
        f"https://{settings.bunny_storage_hostname}/"
        f"{settings.bunny_storage_zone}/{path.lstrip('/')}"
    )


def _require_config() -> None:
    missing = [
        name for name, val in {
            "BUNNY_STORAGE_ZONE": settings.bunny_storage_zone,
            "BUNNY_STORAGE_PASSWORD": settings.bunny_storage_password,
            "BUNNY_STORAGE_HOSTNAME": settings.bunny_storage_hostname,
            "BUNNY_PULL_ZONE_HOSTNAME": settings.bunny_pull_zone_hostname,
        }.items() if not val
    ]
    if missing:
        raise RuntimeError(f"BunnyCDN not configured: missing {', '.join(missing)}")


async def exists(path: str) -> bool:
    """HEAD probe against the storage origin. True iff the object exists."""
    _require_config()
    url = _storage_url(path)
    headers = {"AccessKey": settings.bunny_storage_password}
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.head(url, headers=headers)
        except httpx.TransportError:
            return False
    return resp.status_code == 200


async def upload(path: str, content: bytes, content_type: str | None = None) -> str:
    """PUT `content` to `path` in the storage zone. Returns public CDN URL."""
    _require_config()
    url = _storage_url(path)
    headers = {"AccessKey": settings.bunny_storage_password}
    if content_type:
        headers["Content-Type"] = content_type
    async with httpx.AsyncClient(timeout=_PUT_TIMEOUT) as client:
        resp = await client.put(url, content=content, headers=headers)
    if resp.status_code not in (200, 201, 204):
        raise RuntimeError(
            f"BunnyCDN PUT failed: {resp.status_code} {resp.text[:200]} url={url}"
        )
    cdn_url = _public_url(path)
    log.info("bunny.upload", path=path, bytes=len(content), cdn_url=cdn_url)
    return cdn_url
