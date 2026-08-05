"""Harvest the registered company name behind every BGMEA membership number.

WHY THIS EXISTS
---------------
`source_records.fields` carries no name for a BGMEA record — 0 of 5,970 in
production. `suppliers.company_name` is written once, at insert, from whichever
record created the row; `_enrich_supplier` never touches it afterwards. So when
a record attaches to a supplier that already exists, the name BGMEA published
that record under is discarded and nothing in the database remembers it.

That is why a supplier can publish another company's registration with a
verified pill and no query can object (REZ-102, REZ-103). Recovering the names
is the precondition for measuring the class, not a repair of it.

WHAT THIS DOES *NOT* DO
-----------------------
Nothing is written to the database. This module never imports the upsert, never
calls `BaseScraper.run()`, and therefore never touches `_find_existing`,
`_enrich_supplier`, `_apply_source_specific`, `_maybe_publish`,
`_upsert_source_record` or the evidence writer. It fetches pages and writes one
JSON file. Populating `scraped_company_name` in production is a separate,
later decision that needs a full `bgmea_web` ingest.

THE TWO REGISTERS ARE NOT ONE REGISTER
--------------------------------------
BGMEA numbers its general (manufacturer) and associate (buying house) members
independently: associate `35` is `DK Textile Ltd.`, `general:35` is a different
company. Keying names on the bare number silently conflates them and inflated
REZ-102's measured class from 50 suppliers to 609. Every key this module emits
is the whole `source_ref`, matching `ops/plans/rez-90-ref-names.json`.

  general members    web member-list, ~214 pages   ->  ``general:{reg}``
  associate members  the checked-in PDF            ->  ``{reg}``

WHY THE LIST PAGE IS ENOUGH
---------------------------
`BgmeaWebScraper._parse_list` already reads the company name and the
registration number off the same list row, so the ~4,284 member detail pages
are not needed for a name harvest. That is ~214 fetches instead of ~4,500.
Caveat recorded in the output: `_to_record` prefers the *detail* tab's
registration number when building a `source_ref` and only falls back to the
list value, so a small number of refs may not line up with what is stored.
`--report` measures exactly that rather than assuming it away.

Usage
-----
    python ops/harvest_bgmea_names.py --max-pages 1      # smoke test
    python ops/harvest_bgmea_names.py                    # full harvest
    python ops/harvest_bgmea_names.py --transport direct # no Firecrawl credits
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

sys.path.append(str(Path(__file__).resolve().parents[1]))

from etl.acquire import AcquireRequest  # noqa: E402
from etl.scrapers.bgmea_buying_house import BgmeaBuyingHouseScraper  # noqa: E402
from etl.scrapers.bgmea_web import DETAIL_URL, BgmeaWebScraper  # noqa: E402

DEFAULT_OUT = Path(__file__).resolve().parents[1] / "ops" / "plans" / "bgmea-names.json"

# Matches `bgmea_web._to_record`: a member with no registration number on the
# row is keyed by its member id instead, so it stays addressable rather than
# being dropped from the oracle.
GENERAL_PREFIX = "general:"
MEMBER_PREFIX = "member:"


def ref_for_row(row: dict[str, str]) -> str:
    """The `source_ref` a general-member list row corresponds to.

    Mirrors `bgmea_web._to_record`, minus its preference for the detail tab's
    registration number — a list-only harvest has only the list value. Keep the
    two in step: a divergence here silently misses records rather than failing.
    """
    reg = (row.get("bgmea_reg_number") or "").strip()
    if reg:
        return f"{GENERAL_PREFIX}{reg}"
    return f"{MEMBER_PREFIX}{row['member_id']}"


async def harvest_general(
    *, max_pages: int | None, transport: str | None
) -> tuple[dict[str, dict[str, Any]], dict[str, Any]]:
    """Walk the member-list pages and return {source_ref: {...}}.

    Deliberately does not call `scraper.fetch()`, which would also pull every
    member detail page. Only `acquire()` (one HTTP GET) and `_parse_list` (pure
    parsing) are used, so no code path here can reach the database.
    """
    scraper = BgmeaWebScraper(transport=transport)
    names: dict[str, dict[str, Any]] = {}
    seen_ids: set[str] = set()
    collisions: list[dict[str, str]] = []
    pages_fetched = 0
    page = 1
    empty_streak = 0
    try:
        while empty_streak < 2:
            if max_pages is not None and page > max_pages:
                break
            doc = await scraper.acquire(
                AcquireRequest(
                    url=scraper._list_url(page),
                    only_main_content=False,
                    label=f"member-list p{page}",
                )
            )
            if not doc.ok:
                # Same rule as the scraper's own loop: a timeout is not the end
                # of the registry. Truncating here would emit a name file that
                # looks complete and quietly marks every unreached member
                # "unknown" — the exact failure this harvest exists to remove.
                if doc.transient_failure:
                    raise RuntimeError(
                        f"bgmea list page {page} unreadable "
                        f"({doc.fetch_status.value}: {doc.error_message}). "
                        "Aborting rather than writing a partial name file that "
                        "reads as a complete one."
                    )
                break
            pages_fetched += 1
            rows = scraper._parse_list(doc.text())
            fresh = [r for r in rows if r["member_id"] not in seen_ids]
            if not fresh:
                empty_streak += 1
                page += 1
                continue
            empty_streak = 0
            for row in fresh:
                seen_ids.add(row["member_id"])
                ref = ref_for_row(row)
                name = (row.get("company_name") or "").strip()
                if not name:
                    continue
                prior = names.get(ref)
                if prior is not None and prior["name"] != name:
                    # Two members sharing a registration number is a fact about
                    # BGMEA's register, not a parse bug. Record both rather than
                    # letting the last write win, because an ambiguous ref must
                    # not be used to accuse a supplier of holding a stranger's
                    # number.
                    collisions.append(
                        {"ref": ref, "kept": prior["name"], "also": name,
                         "member_id": row["member_id"]}
                    )
                    continue
                names[ref] = {
                    "name": name,
                    "register": "general",
                    "member_id": row["member_id"],
                    "list_page": page,
                    # BGMEA's own page for this member. Two uses: a citation a
                    # buyer can click, and a handle for re-reading one member
                    # in isolation when a single profile is in doubt, instead
                    # of re-running the whole register.
                    "detail_url": DETAIL_URL.format(mid=row["member_id"]),
                    # Free on the same row, and an independent second opinion:
                    # an email domain that belongs to a different company is
                    # corroboration the name alone cannot give.
                    "email": (row.get("email") or "").strip() or None,
                    "contact_person": (row.get("contact_person") or "").strip() or None,
                }
            page += 1
    finally:
        await scraper.aclose()

    meta = {
        "source": "https://www.bgmea.com.bd/page/member-list",
        "pages_fetched": pages_fetched,
        "transport": scraper.active_transport,
        "credits_spent": scraper.credits_spent,
        "members_seen": len(seen_ids),
        "names": len(names),
        "reg_collisions": collisions,
        "truncated": max_pages is not None,
    }
    return names, meta


async def harvest_associate() -> tuple[dict[str, dict[str, Any]], dict[str, Any]]:
    """Names for the associate (buying house) register, from the local PDF.

    Reuses the shipped parser rather than re-implementing it, so the harvest
    and the ingest cannot disagree about what the PDF says. The local-file
    adapter reads from disk: no network, no database.
    """
    scraper = BgmeaBuyingHouseScraper()
    names: dict[str, dict[str, Any]] = {}
    try:
        async for rec in scraper.fetch():
            name = (rec.company_name or "").strip()
            if name:
                names[rec.source_ref] = {
                    "name": name,
                    "register": "associate",
                    "email": (rec.email or "").strip() or None,
                    "contact_person": (rec.contact_name or "").strip() or None,
                }
    finally:
        await scraper.aclose()
    return names, {
        "source": str(scraper.pdf_path),
        "names": len(names),
    }


def report_coverage(names: dict[str, dict[str, Any]]) -> dict[str, Any]:
    """How many stored BGMEA records this harvest can actually name.

    The number that matters is not how many names were collected but how many
    line up with a `source_ref` we hold. `bgmea_web._to_record` prefers the
    detail tab's registration number over the list row's, so a mismatch is
    possible and must be counted rather than assumed away.
    """
    import httpx

    from etl.core.config import settings

    base = str(settings.supabase_url).rstrip("/") + "/rest/v1"
    key = settings.supabase_service_role_key
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}

    with httpx.Client(headers=headers, timeout=60) as client:
        src = client.get(
            f"{base}/sources", params={"select": "id", "code": "eq.BGMEA"}
        )
        src.raise_for_status()
        source_id = src.json()[0]["id"]

        refs: list[str] = []
        offset = 0
        while True:
            r = client.get(
                f"{base}/source_records",
                params={
                    "select": "source_ref",
                    "source_id": f"eq.{source_id}",
                    "status": "eq.active",
                },
                headers={"Range": f"{offset}-{offset + 999}"},
            )
            r.raise_for_status()
            rows = r.json()
            refs.extend(row["source_ref"] for row in rows)
            if len(rows) < 1000:
                break
            offset += 1000

    def register_of(ref: str) -> str:
        return "general" if ref.startswith(GENERAL_PREFIX) else "associate"

    covered = Counter()
    missing_by_register = Counter()
    missing_examples: dict[str, list[str]] = {"general": [], "associate": []}
    for ref in refs:
        reg = register_of(ref)
        if ref in names:
            covered[reg] += 1
        else:
            missing_by_register[reg] += 1
            if len(missing_examples[reg]) < 10:
                missing_examples[reg].append(ref)

    return {
        "stored_records": len(refs),
        "covered": dict(covered),
        "missing": dict(missing_by_register),
        "missing_examples": missing_examples,
        "harvested_not_in_db": len(set(names) - set(refs)),
    }


async def main_async(args: argparse.Namespace) -> int:
    payload: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "note": (
            "Keys are whole source_refs. BGMEA's general and associate "
            "registers number independently; never key on the bare number."
        ),
        "registers": {},
        "names": {},
    }

    if not args.skip_general:
        general, meta = await harvest_general(
            max_pages=args.max_pages, transport=args.transport
        )
        payload["registers"]["general"] = meta
        payload["names"].update(general)
        print(f"general   : {len(general)} names from {meta['pages_fetched']} pages "
              f"via {meta['transport']} ({meta['credits_spent']} credits)")
        if meta["reg_collisions"]:
            print(f"            {len(meta['reg_collisions'])} registration "
                  f"collisions recorded (not used as evidence)")

    if not args.skip_associate:
        assoc, meta = await harvest_associate()
        payload["registers"]["associate"] = meta
        payload["names"].update(assoc)
        print(f"associate : {len(assoc)} names from the local PDF")

    if args.skip_general and args.skip_associate:
        # Nothing was fetched: re-measure an existing file rather than
        # overwrite it with an empty one.
        payload = json.loads(args.out.read_text(encoding="utf-8"))
        print(f"loaded {len(payload['names'])} names from {args.out}")

    by_register = Counter(v["register"] for v in payload["names"].values())
    payload["totals"] = dict(by_register)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False, sort_keys=True),
        encoding="utf-8",
    )
    print(f"\nwrote {len(payload['names'])} names -> {args.out}")

    if args.report:
        cov = report_coverage(payload["names"])
        total_covered = sum(cov["covered"].values())
        print(f"\ncoverage against {cov['stored_records']} stored BGMEA records")
        for reg in ("general", "associate"):
            got = cov["covered"].get(reg, 0)
            miss = cov["missing"].get(reg, 0)
            print(f"  {reg:10} named {got}, unnamed {miss}")
            if miss:
                print(f"             e.g. {', '.join(cov['missing_examples'][reg])}")
        pct = 100.0 * total_covered / cov["stored_records"] if cov["stored_records"] else 0
        print(f"  total      {total_covered} of {cov['stored_records']} ({pct:.1f}%)")
        print(f"  harvested but not held in the database: {cov['harvested_not_in_db']}")

    print("No database writes were made.")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument(
        "--max-pages", type=int, default=None,
        help="Stop after N member-list pages. Use 1 for a smoke test. "
             "Marks the output truncated so it cannot be mistaken for complete.",
    )
    p.add_argument(
        "--transport", choices=("firecrawl", "direct"), default=None,
        help="Override the transport. 'direct' spends no Firecrawl credits; "
             "these pages are server-rendered so it is a valid substitute.",
    )
    p.add_argument("--out", type=Path, default=DEFAULT_OUT)
    p.add_argument("--skip-general", action="store_true")
    p.add_argument("--skip-associate", action="store_true")
    p.add_argument(
        "--report", action="store_true",
        help="After harvesting, read the stored BGMEA refs and report how many "
             "this file can name. Read-only.",
    )
    return p


def main() -> int:
    return asyncio.run(main_async(build_parser().parse_args()))


if __name__ == "__main__":
    raise SystemExit(main())
