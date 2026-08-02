"""Batch SBI score backfill / recompute driver.

Reads all suppliers + joined evidence (source_tags, rsc_remediation,
certifications, typed columns) in one server-side query, computes each
supplier's 4-pillar score with `etl.scoring.sbi.compute_sbi`, and upserts
into `public.sbi_scores`. Idempotent via `inputs_hash` — rows whose hash
matches the existing row are skipped.
"""
from __future__ import annotations

from collections.abc import Callable
from datetime import date, datetime
from typing import Iterable

from etl.core.db import db
from etl.core.logging import get_logger
from etl.scoring.sbi import Cert, SbiInputs, SbiScore, compute_sbi

log = get_logger("etl.scoring.runner")


_FETCH_SQL = """
select
  s.id                          as supplier_id,
  s.source_tags                 as source_tags,
  s.bgmea_reg_numbers           as bgmea_reg_numbers,
  s.bkmea_reg_number            as bkmea_reg_number,
  s.rjsc_reg_number             as rjsc_reg_number,
  s.epb_erc_number              as epb_erc_number,
  s.bgmea_verified              as bgmea_verified,
  s.bkmea_verified              as bkmea_verified,
  s.bgapmea_verified            as bgapmea_verified,
  s.btma_verified               as btma_verified,
  s.established_date            as established_date,
  s.employees_total             as employees_total,
  s.production_capacity_pcs_day as capacity_pcs_day,
  s.production_capacity_dozen_yearly as capacity_dozen_yearly,
  r.progress_pct                as rsc_progress_pct,
  (r.supplier_id is not null)   as rsc_has_row,
  coalesce(
    (select jsonb_agg(jsonb_build_object('kind', c.kind, 'expires_on', c.expires_on))
       from public.certifications c
      where c.supplier_id = s.id),
    '[]'::jsonb
  )                             as certs_json,
  e.inputs_hash                 as existing_hash
from public.suppliers s
left join public.rsc_remediation r
       on r.supplier_id = s.id and r.active is true
left join public.sbi_scores e
       on e.supplier_id = s.id
"""

_UPSERT_SQL = """
insert into public.sbi_scores
  (supplier_id, pillar1_legal, pillar2_safety, pillar3_certs, pillar4_market,
   total, inputs_hash, computed_at)
values (%s, %s, %s, %s, %s, %s, %s, now())
on conflict (supplier_id) do update set
  pillar1_legal = excluded.pillar1_legal,
  pillar2_safety = excluded.pillar2_safety,
  pillar3_certs = excluded.pillar3_certs,
  pillar4_market = excluded.pillar4_market,
  total = excluded.total,
  inputs_hash = excluded.inputs_hash,
  computed_at = now()
"""


def _row_to_inputs(row: dict) -> SbiInputs:
    certs_payload = row["certs_json"] or []
    certs: list[Cert] = []
    for c in certs_payload:
        kind = c.get("kind")
        if not kind:
            continue
        exp_raw = c.get("expires_on")
        exp: date | None
        if exp_raw is None:
            exp = None
        elif isinstance(exp_raw, date):
            exp = exp_raw
        else:
            exp = datetime.fromisoformat(str(exp_raw)).date()
        certs.append(Cert(kind=kind, expires_on=exp))

    def _f(x: object) -> float | None:
        return float(x) if x is not None else None

    def _d(x: object) -> date | None:
        if x is None:
            return None
        if isinstance(x, date):
            return x
        try:
            return datetime.fromisoformat(str(x)[:10]).date()
        except ValueError:
            return None

    return SbiInputs(
        supplier_id=str(row["supplier_id"]),
        source_tags=tuple(row["source_tags"] or ()),
        bgmea_reg_numbers=tuple(row["bgmea_reg_numbers"] or ()),
        bkmea_reg_number=row["bkmea_reg_number"],
        rjsc_reg_number=row["rjsc_reg_number"],
        epb_erc_number=row["epb_erc_number"],
        bgmea_verified=bool(row["bgmea_verified"]),
        bkmea_verified=bool(row["bkmea_verified"]),
        bgapmea_verified=bool(row["bgapmea_verified"]),
        btma_verified=bool(row["btma_verified"]),
        rsc_progress_pct=_f(row["rsc_progress_pct"]),
        rsc_has_row=bool(row["rsc_has_row"]),
        certs=tuple(certs),
        established_date=_d(row["established_date"]),
        employees_total=row["employees_total"],
        capacity_pcs_day=row["capacity_pcs_day"],
        capacity_dozen_yearly=row["capacity_dozen_yearly"],
    )


def run(
    *,
    limit: int | None = None,
    force: bool = False,
    batch_size: int = 500,
    today: date | None = None,
    progress_callback: Callable[[dict[str, int]], None] | None = None,
) -> dict[str, int]:
    """Backfill / recompute SBI scores for all suppliers.

    `progress_callback`, when given, fires after each committed upsert batch
    with the running counters — the queue-dispatched job heartbeats through it
    so the stale reaper never kills a healthy recompute (REZ-31).

    Returns counters: {seen, computed, upserted, skipped_hash}.
    """
    today = today or date.today()
    seen = 0
    computed = 0
    upserted = 0
    skipped = 0

    sql = _FETCH_SQL
    if limit is not None:
        sql = sql + f"\nlimit {int(limit)}"

    with db.conn() as c:
        with c.cursor() as cur:
            cur.execute(sql)
            rows: Iterable[dict] = cur.fetchall()

        batch: list[tuple] = []
        with c.cursor() as cur:
            for row in rows:
                seen += 1
                inputs = _row_to_inputs(row)
                score: SbiScore = compute_sbi(inputs, today)
                computed += 1
                if not force and row.get("existing_hash") == score.inputs_hash:
                    skipped += 1
                    continue
                batch.append(
                    (
                        inputs.supplier_id,
                        score.pillar1_legal,
                        score.pillar2_safety,
                        score.pillar3_certs,
                        score.pillar4_market,
                        score.total,
                        score.inputs_hash,
                    )
                )
                if len(batch) >= batch_size:
                    cur.executemany(_UPSERT_SQL, batch)
                    upserted += len(batch)
                    batch.clear()
                    c.commit()
                    if progress_callback is not None:
                        progress_callback(
                            {
                                "seen": seen,
                                "computed": computed,
                                "upserted": upserted,
                                "skipped_hash": skipped,
                            }
                        )
            if batch:
                cur.executemany(_UPSERT_SQL, batch)
                upserted += len(batch)
                batch.clear()
                c.commit()

    log.info(
        "sbi.backfill.done",
        seen=seen,
        computed=computed,
        upserted=upserted,
        skipped_hash=skipped,
        force=force,
        limit=limit,
    )
    return {"seen": seen, "computed": computed, "upserted": upserted, "skipped_hash": skipped}
