"""Cleanup the false-positive sanctions match on supplier f7c6fe0f.

What we're undoing:
  - finding-china-5-trade was a parser artifact (the entity name
    'Inner Mongolia Hengzheng Group Baoanzhao Agriculture, Industry, and Trade
    Co., Ltd.' was wrongly split, leaving a stub "Trade Co., Ltd").
  - That stub matched a Bangladeshi supplier "Trade International" whose
    normalized form is "trade".

We delete the bad screening row + the bad list entry, and manually reverse
the trigger-set flags. (re-running the scraper will rebuild the correct
single Inner Mongolia entry; the matcher's new length guard will prevent
the same generic-suffix match from happening again.)
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from etl.core.db import db  # noqa: E402

BAD_REF = "finding-china-5-trade"
SUPPLIER_ID = "f7c6fe0f-09ab-47d3-9bb1-290df96d77c3"


def main() -> None:
    with db.conn() as c, c.cursor() as cur:
        cur.execute(
            "delete from public.sanctions_screening "
            " where supplier_id = %s and list_entry_ref = %s",
            (SUPPLIER_ID, BAD_REF),
        )
        print(f"deleted screening rows: {cur.rowcount}")

        cur.execute(
            "delete from public.sanctions_list_entries where entry_ref = %s",
            (BAD_REF,),
        )
        print(f"deleted list entries:    {cur.rowcount}")

        # Are any other ACTIVE screening rows for this supplier?
        cur.execute(
            "select count(*) as n from public.sanctions_screening "
            " where supplier_id = %s and active = true",
            (SUPPLIER_ID,),
        )
        n_active = cur.fetchone()["n"]
        print(f"remaining active screening rows for supplier: {n_active}")

        if n_active == 0:
            cur.execute(
                "update public.suppliers set is_sanctioned = false where id = %s",
                (SUPPLIER_ID,),
            )
            print(f"un-sanctioned supplier rows: {cur.rowcount}")
            cur.execute(
                "update public.sbi_scores set sanctioned_zero = false "
                " where supplier_id = %s",
                (SUPPLIER_ID,),
            )
            print(f"reset sbi_scores.sanctioned_zero rows: {cur.rowcount}")

        c.commit()
    print("cleanup complete")


if __name__ == "__main__":
    main()
