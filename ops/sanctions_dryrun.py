"""Dry-run UFLPA + CBP WRO scrapers locally — fetch + parse only, no DB writes.

Usage:
  python -m ops.sanctions_dryrun uflpa
  python -m ops.sanctions_dryrun cbp_wro
"""
from __future__ import annotations

import asyncio
import sys
from collections import Counter

from etl.scrapers.cbp_wro import CbpWroScraper
from etl.scrapers.uflpa import UflpaScraper

SCRAPERS = {"uflpa": UflpaScraper, "cbp_wro": CbpWroScraper}


async def _run(name: str) -> None:
    cls = SCRAPERS[name]
    scraper = cls()
    total = 0
    by_section: Counter[str] = Counter()
    by_country: Counter[str] = Counter()
    samples: list = []
    async for entry in scraper.fetch():
        total += 1
        if entry.country:
            by_country[entry.country] += 1
        sec = entry.raw.get("section") or entry.raw.get("kind") or "?"
        by_section[str(sec)] += 1
        if len(samples) < 6:
            samples.append(entry)
    print(f"\n=== {name}: {total} entries ===")
    print("by section/kind:", dict(by_section))
    print("by country:", dict(by_country.most_common(15)))
    print("\n--- samples ---")
    for s in samples:
        print(f"  ref={s.entry_ref}")
        print(f"    name={s.entity_name!r}")
        print(f"    aliases={s.aliases}")
        print(f"    country={s.country}  date={s.listed_date}  status={s.status}")
        if s.merchandise:
            print(f"    merchandise={s.merchandise}")


def main() -> None:
    if len(sys.argv) < 2 or sys.argv[1] not in SCRAPERS:
        print("usage: python -m ops.sanctions_dryrun {uflpa|cbp_wro}")
        sys.exit(1)
    asyncio.run(_run(sys.argv[1]))


if __name__ == "__main__":
    main()
