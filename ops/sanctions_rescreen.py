"""Re-screen all suppliers against all sanctions list entries.

Workflow:
  1. Mark every sanctions_screening row inactive.
  2. Reset suppliers.is_sanctioned = false for any supplier whose only
     evidence was the now-inactive screening rows. (Trigger handles the
     SBI score recompute.)
  3. Iterate every sanctions_list_entries row and re-run the new
     _match_and_screen() against current suppliers. New matches insert
     active rows and the trigger re-flags the supplier.

Safe to re-run any time after the matcher logic changes.
"""
from __future__ import annotations

import json

from etl.core.db import db
from etl.core.logging import get_logger
from etl.core.normalize import normalize_company_name
from etl.core.sanctions import _match_and_screen, SanctionEntry

log = get_logger("ops.sanctions_rescreen")


def _load_entries(cur) -> list[dict]:
    cur.execute(
        """select id, list, entry_ref, entity_name, aliases, country,
                  merchandise, listed_date, status, status_notes,
                  source_url, raw
             from public.sanctions_list_entries
            order by list, entry_ref"""
    )
    return list(cur.fetchall())


def main() -> None:
    with db.conn() as c, c.cursor() as cur:
        cur.execute("select count(*) as n from sanctions_screening where active = true")
        n_active_before = cur.fetchone()["n"]
        cur.execute("select count(*) as n from suppliers where is_sanctioned = true")
        n_flagged_before = cur.fetchone()["n"]
        log.info("rescreen.before",
                 active_screenings=n_active_before, flagged_suppliers=n_flagged_before)

        # Step 1+2: clear all current screening + supplier flags.
        # The DB trigger trg_sanc_propagate flips suppliers.is_sanctioned on
        # insert/update of sanctions_screening, but doesn't watch a "go to
        # zero" path on its own — so we update suppliers explicitly here.
        cur.execute("update sanctions_screening set active = false where active = true")
        cur.execute(
            """update suppliers
                  set is_sanctioned = false
                where is_sanctioned = true"""
        )
        c.commit()
        log.info("rescreen.cleared")

        entries = _load_entries(cur)
        log.info("rescreen.entries_loaded", n=len(entries))

    total_matched = 0
    by_list: dict[str, int] = {}

    for i, row in enumerate(entries, 1):
        aliases = list(row["aliases"]) if row["aliases"] else []
        raw = row["raw"] if isinstance(row["raw"], dict) else (
            json.loads(row["raw"]) if row["raw"] else {}
        )
        entry = SanctionEntry(
            list_code=row["list"],
            source_code="",
            entry_ref=row["entry_ref"],
            entity_name=row["entity_name"],
            aliases=aliases,
            country=row["country"],
            merchandise=row["merchandise"],
            listed_date=row["listed_date"],
            status=row["status"],
            status_notes=row["status_notes"],
            source_url=row["source_url"],
            raw=raw,
        )
        norm = normalize_company_name(entry.entity_name)

        with db.conn() as c, c.cursor() as cur:
            matched = _match_and_screen(
                cur, entry=entry, norm=norm, entry_id=str(row["id"])
            )
            c.commit()
        if matched:
            total_matched += len(matched)
            by_list[entry.list_code] = by_list.get(entry.list_code, 0) + len(matched)

        if i % 1000 == 0:
            log.info("rescreen.progress", processed=i, matched_so_far=total_matched)

    with db.conn() as c, c.cursor() as cur:
        cur.execute("select count(*) as n from sanctions_screening where active = true")
        n_active_after = cur.fetchone()["n"]
        cur.execute("select count(*) as n from suppliers where is_sanctioned = true")
        n_flagged_after = cur.fetchone()["n"]

    log.info(
        "rescreen.done",
        processed=len(entries),
        new_matches=total_matched,
        by_list=by_list,
        active_screenings_after=n_active_after,
        flagged_suppliers_after=n_flagged_after,
    )
    print()
    print(f"Processed {len(entries)} sanctions list entries.")
    print(f"Active screenings: {n_active_before} -> {n_active_after}")
    print(f"Flagged suppliers: {n_flagged_before} -> {n_flagged_after}")
    print(f"By list: {by_list}")


if __name__ == "__main__":
    main()
