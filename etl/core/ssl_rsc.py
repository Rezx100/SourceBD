"""SSL context helper for `rsc-bd.org`.

`rsc-bd.org` serves only the leaf certificate and omits the Sectigo
intermediate, so Python / httpx (no AIA chasing) fails verification even with
certifi. We fetch the intermediate via the AIA URL embedded in the leaf cert
and append it to a custom SSL context. The intermediate itself chains up to a
root that IS in certifi, so the resulting trust decision is still strict.

Shared by:
- `etl/scrapers/rsc_reports.py` (Spec 15)
- `etl/scrapers/rsc_documents.py` (Spec 13)

The Firecrawl migration was expected to retire this: Firecrawl does its own TLS,
so a page fetched through it needs no local trust fixing. It stays because both
RSC sources still reach rsc-bd.org directly for the parts Firecrawl cannot serve
— `rsc_documents` mirrors inspection-report binaries byte-for-byte, and
`rsc_reports` keeps a direct fallback for when Firecrawl is unavailable. Deleting
it would not simplify anything; it would just move the same certificate handling
into two scrapers that would then disagree about it.
"""
from __future__ import annotations

import ssl
from functools import lru_cache

import certifi
import httpx

from etl.core.logging import get_logger

log = get_logger("etl.ssl_rsc")

_RSC_INTERMEDIATE_URL = (
    "http://crt.sectigo.com/SectigoPublicServerAuthenticationCADVR36.crt"
)


@lru_cache(maxsize=1)
def build_rsc_ssl_context() -> ssl.SSLContext:
    ctx = ssl.create_default_context(cafile=certifi.where())
    try:
        r = httpx.get(_RSC_INTERMEDIATE_URL, timeout=30)
        r.raise_for_status()
        try:
            pem = ssl.DER_cert_to_PEM_cert(r.content)
        except Exception:  # noqa: BLE001
            pem = r.text
        ctx.load_verify_locations(cadata=pem)
    except Exception as exc:  # noqa: BLE001
        log.warn("ssl.intermediate_fetch_failed", error=str(exc))
    return ctx
