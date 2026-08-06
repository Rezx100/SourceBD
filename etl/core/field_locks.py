"""Live `supplier_field_locks` lookup — single definition for every ETL writer.

Moved out of `etl.core.upsert` so recurring jobs (contact_merge, address_norm,
rsc_crosslink) share one "is this column locked" predicate with the upsert
path. Do not copy this function into another module; import it.
"""
from __future__ import annotations


def locked_columns(cur, supplier_id: str) -> set[str]:
    """Live field locks for one supplier (released_at IS NULL).

    Load once per supplier write, not per SET fragment. Empty set = no locks
    = ETL behaviour unchanged.
    """
    cur.execute(
        """select column_name
             from public.supplier_field_locks
            where supplier_id = %s
              and released_at is null""",
        (supplier_id,),
    )
    rows = cur.fetchall() or []
    out: set[str] = set()
    for row in rows:
        if isinstance(row, dict):
            out.add(str(row["column_name"]))
        else:
            out.add(str(row[0]))
    return out
