"""Registered SourceBD scrapers and maintenance jobs.

The CLI and admin queue runner import this module so every execution path uses
one allow-list.

`SCRAPERS` are data sources; `JOBS` are schedulable maintenance tasks that run
through the same admin queue and timer UI but ingest nothing. They are kept
apart because a source is required to declare an acquisition transport and to
produce evidence, and a job is not — merging them would weaken that guarantee
into a convention. `RUNNABLE` is the union, and is what the queue dispatches on.
"""
from __future__ import annotations

from etl.evidence.monitors import RefreshMonitorsJob
from etl.evidence.verifier import VerifyEvidenceJob
from etl.scrapers.bgapmea_web import BgapmeaScraper
from etl.scrapers.bgmea_buying_house import BgmeaBuyingHouseScraper
from etl.scrapers.bgmea_web import BgmeaWebScraper
from etl.scrapers.bkmea_detail import BkmeaDetailScraper
from etl.scrapers.bkmea_web import BkmeaScraper
from etl.scrapers.brand_disclosures import (
    BrandAsosScraper,
    BrandHmScraper,
    BrandMsScraper,
    BrandNextScraper,
    BrandPrimarkScraper,
)
from etl.scrapers.btma_spinning import BtmaSpinningScraper
from etl.scrapers.cbp_wro import CbpWroScraper
from etl.scrapers.epb_web import EpbScraper
from etl.scrapers.eu_sanctions import EuSanctionsScraper
from etl.scrapers.gots import GotsScraper
from etl.scrapers.ilab_tvpra import IlabTvpraScraper
from etl.scrapers.oeko_tex import OekoTexScraper
from etl.scrapers.ofac_sdn import OfacSdnScraper
from etl.scrapers.rsc import RscScraper
from etl.scrapers.rsc_documents import RscDocumentsScraper
from etl.scrapers.rsc_reports import RscReportsScraper
from etl.scrapers.rsc_updates import RscUpdatesScraper
from etl.scrapers.sa8000 import Sa8000Scraper
from etl.scrapers.uflpa import UflpaScraper
from etl.scrapers.uk_ofsi import UkOfsiScraper
from etl.scrapers.wrap import WrapScraper

SCRAPERS = {
    "bgmea_buying_house": BgmeaBuyingHouseScraper,
    "bgmea_web": BgmeaWebScraper,
    "bkmea_web": BkmeaScraper,
    "bkmea_detail": BkmeaDetailScraper,
    "bgapmea_web": BgapmeaScraper,
    "epb_web": EpbScraper,
    "btma_spinning": BtmaSpinningScraper,
    "rsc": RscScraper,
    "rsc_reports": RscReportsScraper,
    "rsc_updates": RscUpdatesScraper,
    "rsc_documents": RscDocumentsScraper,
    "wrap": WrapScraper,
    "oeko_tex": OekoTexScraper,
    "gots": GotsScraper,
    "sa8000": Sa8000Scraper,
    "uflpa": UflpaScraper,
    "cbp_wro": CbpWroScraper,
    "ofac_sdn": OfacSdnScraper,
    "uk_ofsi": UkOfsiScraper,
    "eu_sanctions": EuSanctionsScraper,
    "ilab_tvpra": IlabTvpraScraper,
    "brand_hm": BrandHmScraper,
    # brand_inditex retired 29 Jul 2026. Inditex publishes no factory-level
    # supplier list: only aggregate per-country counts, with the actual list
    # shared privately with IndustriALL Global Union under their Global Framework
    # Agreement. The page we scraped now 200s and redirects to their homepage.
    # There is nothing to scrape, so do not re-add it without a public list.
    "brand_primark": BrandPrimarkScraper,
    "brand_asos": BrandAsosScraper,
    "brand_ms": BrandMsScraper,
    "brand_next": BrandNextScraper,
}

SCRAPER_CODES = tuple(SCRAPERS.keys())

JOBS = {
    "verify_evidence": VerifyEvidenceJob,
    "refresh_monitors": RefreshMonitorsJob,
}

JOB_CODES = tuple(JOBS.keys())

# What the admin queue is allowed to dispatch. Must stay in sync with
# `admin_etl_allowed_scraper_codes()` in SQL and `lib/admin/etl-scrapers.ts`.
RUNNABLE = {**SCRAPERS, **JOBS}
