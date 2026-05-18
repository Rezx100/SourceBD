"""Local dry-run for EPB Exporter Database scraper (RMG-only, API-driven).

Walks BGMEA + BKMEA association exporters via the JSON API and prints a few
parsed records. No DB writes.
"""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from etl.scrapers.epb_web import EpbScraper  # noqa: E402


async def main() -> None:
    scraper = EpbScraper()

    seen_per_assoc: dict[str, int] = {}
    samples: list[dict] = []

    async for rec in scraper.fetch():
        assoc = (rec.payload.get("epb_associations") or ["?"])[0]
        seen_per_assoc[assoc] = seen_per_assoc.get(assoc, 0) + 1
        if seen_per_assoc[assoc] <= 2:
            samples.append(
                {
                    "association": assoc,
                    "company": rec.company_name,
                    "address": rec.address_raw,
                    "district": rec.district,
                    "payload": rec.payload,
                }
            )

    print("\n=== SAMPLES ===")
    for s in samples:
        print(json.dumps(s, indent=2, ensure_ascii=False))
        print("---")

    print("\n=== TOTALS ===")
    for k, v in seen_per_assoc.items():
        print(f"  {k}: {v}")
    print(f"  TOTAL RMG: {sum(seen_per_assoc.values())}")


if __name__ == "__main__":
    asyncio.run(main())
