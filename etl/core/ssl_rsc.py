"""SSL context helper for `rsc-bd.org`.

`rsc-bd.org` serves only the leaf certificate and omits the Sectigo
intermediate, so Python / httpx (no AIA chasing) fails verification even with
certifi. We fetch the intermediate via the AIA URL embedded in the leaf cert
and append it to a custom SSL context. The intermediate itself chains up to a
root that IS in certifi, so the resulting trust decision is still strict.

Shared by:
- `etl/scrapers/rsc_reports.py` (Spec 15)
- `etl/scrapers/rsc_documents.py` (Spec 13)
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
