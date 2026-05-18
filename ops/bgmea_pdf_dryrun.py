"""Dry-run BGMEA PDF parser: count matches, print first 3 records, no DB writes."""
from __future__ import annotations

import asyncio

from etl.scrapers.bgmea_pdf import BgmeaPdfScraper


async def main() -> None:
    scraper = BgmeaPdfScraper()
    count = 0
    samples = []
    async for rec in scraper.fetch():
        count += 1
        if len(samples) < 3:
            samples.append(rec)
    print(f"PARSED {count} records")
    for i, r in enumerate(samples, 1):
        print(f"--- #{i} ---")
        print(f"  name      = {r.company_name!r}")
        print(f"  source_ref= {r.source_ref!r}")
        print(f"  contact   = {r.contact_name!r} / {r.contact_role!r}")
        print(f"  email     = {r.email!r}")
        print(f"  tel       = {r.phone_raw!r}")
        print(f"  address   = {r.address_raw!r}")
        print(f"  city      = {r.city!r}")


if __name__ == "__main__":
    asyncio.run(main())
