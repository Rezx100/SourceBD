"""Reusable scraping framework primitives."""
from etl.core.config import settings
from etl.core.logging import get_logger
from etl.core.scraper import BaseScraper, ScrapedRecord
from etl.core.db import db, get_source_id
from etl.core.upsert import upsert_supplier_with_source

__all__ = [
    "settings",
    "get_logger",
    "BaseScraper",
    "ScrapedRecord",
    "db",
    "get_source_id",
    "upsert_supplier_with_source",
]
