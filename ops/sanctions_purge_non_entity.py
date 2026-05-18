"""Purge non-entity OFAC SDN rows (vessels, aircraft, individuals) and any
sanctions_screening rows that point to them. Run BEFORE rescreen so the
matcher only sees entity-type sanctioned organizations.
"""
from etl.core.db import db
from etl.core.logging import get_logger

log = get_logger("ops.sanctions_purge_non_entity")


def main() -> None:
    with db.conn() as c, c.cursor() as cur:
        cur.execute(
            """select coalesce(raw->>'sdn_type','(null)') as t, count(*) as n
                 from sanctions_list_entries
                where list = 'ofac_sdn'
                group by 1 order by 2 desc"""
        )
        before = {r["t"]: r["n"] for r in cur.fetchall()}
        log.info("purge.before", counts=before)

        # Drop screening rows referencing non-entity entries first, to keep
        # the FK chain clean. (list_entry_ref stores the entry_ref string.)
        cur.execute(
            """delete from sanctions_screening
                where list_entry_ref in (
                    select entry_ref from sanctions_list_entries
                     where list = 'ofac_sdn'
                       and lower(coalesce(raw->>'sdn_type','entity')) <> 'entity'
                )
            returning id"""
        )
        n_screening_deleted = cur.rowcount

        cur.execute(
            """delete from sanctions_list_entries
                where list = 'ofac_sdn'
                  and lower(coalesce(raw->>'sdn_type','entity')) <> 'entity'
            returning id"""
        )
        n_entries_deleted = cur.rowcount
        c.commit()

        cur.execute(
            """select coalesce(raw->>'sdn_type','(null)') as t, count(*) as n
                 from sanctions_list_entries
                where list = 'ofac_sdn'
                group by 1 order by 2 desc"""
        )
        after = {r["t"]: r["n"] for r in cur.fetchall()}
        log.info("purge.after",
                 counts=after,
                 entries_deleted=n_entries_deleted,
                 screening_deleted=n_screening_deleted)

    print(f"Deleted {n_entries_deleted} non-entity OFAC SDN rows.")
    print(f"Deleted {n_screening_deleted} screening rows referencing them.")
    print(f"Before: {before}")
    print(f"After:  {after}")


if __name__ == "__main__":
    main()
