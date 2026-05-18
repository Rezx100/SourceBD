"""Local dry-run for BGAPMEA scraper parsing.

Fetches a handful of detail pages directly and prints parsed records.
Does NOT touch the database. Run before deploying to VPS.
"""
from __future__ import annotations

import asyncio
import json
from pathlib import Path
import sys

# Ensure repo root on path when invoked as `python ops/bgapmea_dryrun.py`.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from etl.core.http import HttpClient  # noqa: E402
from etl.scrapers.bgapmea_web import (  # noqa: E402
    BgapmeaScraper,
    DETAIL_URL,
    _BROWSER_HEADERS,
)


SAMPLE_IDS = ["80", "1561", "1688", "1595", "5", "1390"]


async def main() -> None:
    scraper = BgapmeaScraper()
    async with HttpClient(rps=1.0, headers=_BROWSER_HEADERS) as http:
        # Validate the listing collector against the first 2 pages.
        ids_subset: list[str] = []
        for offset in (0, 15):
            url = "https://www.bgapmea.org/index.php/member" if offset == 0 \
                else f"https://www.bgapmea.org/index.php/member/index/{offset}"
            r = await http.get(url)
            import re
            ids_subset.extend(re.findall(r"/member/member_details/(\d+)", r.text))
        print(f"[list] first-2-pages ids unique={len(set(ids_subset))} sample={ids_subset[:8]}")

        for did in SAMPLE_IDS:
            url = DETAIL_URL.format(id=did)
            try:
                resp = await http.get(url)
            except Exception as e:
                print(f"[detail {did}] FAIL {e}")
                continue
            rec = scraper._parse_detail(resp.text, detail_id=did, url=url)
            if rec is None:
                print(f"[detail {did}] parse_empty")
                continue
            d = {
                "company": rec.company_name,
                "owner": rec.contact_name,
                "owner_role": rec.contact_role,
                "email": rec.email,
                "phone": rec.phone_raw,
                "address": rec.address_raw,
                "district": rec.district,
                "website": rec.website,
                "payload": rec.payload,
            }
            print(f"[detail {did}]")
            print(json.dumps(d, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
