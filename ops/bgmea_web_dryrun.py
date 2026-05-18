"""Dry-run BGMEA web scraper for first N pages, print parsed records (no DB writes)."""
from __future__ import annotations

import asyncio
import json
import sys

from etl.scrapers.bgmea_web import BgmeaWebScraper


async def main() -> None:
    pages = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    scraper = BgmeaWebScraper(max_pages=pages)
    count = 0
    samples = []
    async for rec in scraper.fetch():
        count += 1
        if len(samples) < 3:
            samples.append(rec)
    print(f"\nPARSED {count} records across {pages} page(s)")
    for i, r in enumerate(samples, 1):
        print(f"\n--- sample #{i} ---")
        print(f"  name        = {r.company_name!r}")
        print(f"  source_ref  = {r.source_ref!r}")
        print(f"  entity_type = {r.entity_type!r}")
        print(f"  contact     = {r.contact_name!r} / {r.contact_role!r}")
        print(f"  email       = {r.email!r}")
        print(f"  phone       = {r.phone_raw!r}")
        print(f"  address     = {r.address_raw!r}")
        print(f"  city        = {r.city!r}")
        print(f"  website     = {r.website!r}")
        print(f"  payload     = {json.dumps(r.payload, indent=2, default=str)[:1500]}")


if __name__ == "__main__":
    asyncio.run(main())
