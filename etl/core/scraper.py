"""Base scraper contract. Every source implements this."""
from __future__ import annotations

import abc
import hashlib
import json
from dataclasses import dataclass, field
from typing import Any, AsyncIterator

from etl.core.db import db, get_source_id
from etl.core.logging import get_logger


@dataclass
class ScrapedRecord:
    """One canonical record emitted by a scraper. Pre-normalization."""

    source_code: str                          # e.g. 'BGMEA'
    source_ref: str                           # stable per-source id (reg #, factory id, URL)
    company_name: str
    payload: dict[str, Any] = field(default_factory=dict)   # full raw fields
    contact_name: str | None = None
    contact_role: str | None = None
    email: str | None = None
    phone_raw: str | None = None
    address_raw: str | None = None
    city: str | None = None
    district: str | None = None
    website: str | None = None
    entity_type: str | None = None   # explicit override; falls back to source default

    def hash(self) -> str:
        canonical = json.dumps(self.payload, sort_keys=True, ensure_ascii=False, default=str)
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


class BaseScraper(abc.ABC):
    """Inherit and implement `fetch()`. Lifecycle: run() handles run-log + commit."""

    code: str = ""           # unique scraper code (e.g. 'bgmea_pdf')
    source_code: str = ""    # source catalog code (e.g. 'BGMEA')

    def __init__(self) -> None:
        self.log = get_logger(f"etl.scraper.{self.code}")

    @abc.abstractmethod
    async def fetch(self) -> AsyncIterator[ScrapedRecord]:  # pragma: no cover
        """Async generator yielding ScrapedRecord."""
        if False:
            yield  # type: ignore[unreachable]

    async def run(self) -> dict[str, int]:
        """Drive a full scrape: open run log, stream upserts, close run log."""
        from etl.core.upsert import upsert_supplier_with_source  # local import: avoids cycle

        run_id = self._open_run()
        seen = upserted = skipped = 0
        try:
            async for rec in self.fetch():
                seen += 1
                try:
                    upsert_supplier_with_source(rec)
                    upserted += 1
                except Exception as e:  # noqa: BLE001
                    skipped += 1
                    self.log.error("upsert.failed", source_ref=rec.source_ref, error=str(e))
                if seen % 50 == 0:
                    self.log.info("progress", seen=seen, upserted=upserted, skipped=skipped)
            self._close_run(run_id, "success", seen, upserted, skipped, None)
        except Exception as e:  # noqa: BLE001
            self._close_run(run_id, "failed", seen, upserted, skipped, str(e))
            raise
        return {"seen": seen, "upserted": upserted, "skipped": skipped}

    # --- run log ----------------------------------------------------------
    def _open_run(self) -> str:
        with db.conn() as c, c.cursor() as cur:
            cur.execute(
                """insert into public.etl_runs (scraper_code, source_id, status)
                   values (%s, %s, 'running') returning id""",
                (self.code, get_source_id(self.source_code) if self.source_code else None),
            )
            run_id = str(cur.fetchone()["id"])
            c.commit()
            self.log.info("run.start", run_id=run_id)
            return run_id

    def _close_run(
        self,
        run_id: str,
        status: str,
        seen: int,
        upserted: int,
        skipped: int,
        error: str | None,
    ) -> None:
        with db.conn() as c, c.cursor() as cur:
            cur.execute(
                """update public.etl_runs
                     set finished_at = now(),
                         status = %s,
                         records_seen = %s,
                         records_upserted = %s,
                         records_skipped = %s,
                         error = %s
                   where id = %s""",
                (status, seen, upserted, skipped, error, run_id),
            )
            c.commit()
        self.log.info("run.end", run_id=run_id, status=status,
                      seen=seen, upserted=upserted, skipped=skipped)
