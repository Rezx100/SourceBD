"""Certificates a body stops listing become "no longer listed" (spec S2, §4.4).

After a certificate scraper reads its body's whole list, every certificate it
saw is stamped `last_seen_at` / `last_seen_run_id`, and the ones it did not
see are considered for `listing_status = 'no_longer_listed'`. Rows are never
deleted. The decision is `plan_reconcile` (etl.core.breaker), shared with the
sanctions lists:

- a read that stopped early, or saw under 90% of what was listed, is partial:
  nothing is stamped and the read date does not advance;
- more than 2% (floor 3) missing holds the removals for a human; the read
  still counts;
- the FIRST reconcile of a scheme is always held, so the founder reads the
  list of certificates not seen (etl_runs.meta.reconcile) before anything
  is marked. Release: `run <code> --accept-delistings`.

A certificate seen again after being marked comes back as listed.
"""
from __future__ import annotations

import json
from typing import Any

from psycopg.errors import UndefinedColumn

from etl.core.breaker import plan_reconcile
from etl.core.db import db
from etl.core.logging import get_logger
from etl.core.notify import slack

log = get_logger("etl.cert_reconcile")

# How many missing certificate numbers the run log keeps for the founder.
_MISSING_SAMPLE = 500


def reconcile_certificates(**kwargs: Any) -> dict[str, Any]:
    """Fail soft until migration 0122 adds the columns (deploy order)."""
    try:
        return _reconcile(**kwargs)
    except UndefinedColumn as exc:
        log.warning("cert_reconcile.unavailable", kind=kwargs.get("kind"), error=str(exc))
        return {"action": "unavailable"}


def _reconcile(
    *,
    kind: str,
    scraper_code: str,
    run_id: str,
    seen_cert_nos: set[str],
    read_complete: bool,
    accept: bool,
) -> dict[str, Any]:
    with db.conn() as c, c.cursor() as cur:
        cur.execute(
            """select c.id::text as id, c.certificate_no, c.listing_status, s.slug
                 from public.certifications c
                 join public.suppliers s on s.id = c.supplier_id
                where c.kind = %s and c.uploaded_by is null""",
            (kind,),
        )
        rows = cur.fetchall()
        listed = [r for r in rows if r["listing_status"] == "listed"]
        missing = [r for r in listed if r["certificate_no"] not in seen_cert_nos]
        # First = no read of this scheme has ever been allowed to mark anything.
        cur.execute(
            """select exists (select 1 from public.etl_runs
                               where meta -> 'reconcile' -> %s ->> 'action' = 'reconcile') as done""",
            (kind,),
        )
        first = not cur.fetchone()["done"]
        action = plan_reconcile(
            read_complete=read_complete, listed_before=len(listed),
            seen=len(seen_cert_nos), missing=len(missing), accept=accept,
        )
        if action == "reconcile" and first and missing and not accept:
            action = "held"  # first read of this scheme: the founder looks first
        out: dict[str, Any] = {
            "action": action, "first_read": first, "listed_before": len(listed),
            "seen": len(seen_cert_nos), "missing": len(missing),
            "missing_certificates": [
                f"{r['slug']}:{r['certificate_no']}" for r in missing[:_MISSING_SAMPLE]
            ],
        }
        relisted = delisted = 0
        if action != "partial" and seen_cert_nos:
            cur.execute(
                """update public.certifications
                      set last_seen_at = now(),
                          last_seen_run_id = %s::uuid,
                          flipped_by_run_id = case when listing_status = 'no_longer_listed'
                                                   then %s::uuid else flipped_by_run_id end,
                          listing_status = 'listed'
                    where kind = %s and uploaded_by is null
                      and certificate_no = any(%s)
                returning (flipped_by_run_id = %s::uuid) as flipped""",
                (run_id, run_id, kind, list(seen_cert_nos), run_id),
            )
            relisted = sum(1 for r in cur.fetchall() if r["flipped"])
        if action == "reconcile" and missing:
            cur.execute(
                """update public.certifications
                      set listing_status = 'no_longer_listed', flipped_by_run_id = %s::uuid
                    where id = any(%s::uuid[])""",
                (run_id, [r["id"] for r in missing]),
            )
            delisted = len(missing)
        out.update(relisted=relisted, delisted=delisted)
        cur.execute(
            """update public.etl_runs
                  set meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object(
                        'reconcile',
                        coalesce(meta -> 'reconcile', '{}'::jsonb)
                          || jsonb_build_object(%s::text, %s::jsonb))
                where id = %s""",
            (kind, json.dumps(out), run_id),
        )
        c.commit()

    log.info("cert_reconcile", kind=kind, **{k: v for k, v in out.items()
                                             if k != "missing_certificates"})
    if action == "held":
        why = ("this is the first full read" if first
               else f"{len(missing)} of {len(listed)} is over the 2% limit")
        slack(
            f":hourglass: SourceBD: {scraper_code} did not see {len(missing)} "
            f"{kind.upper()} certificates it listed before; nothing is marked because "
            f"{why}. The list is in run {run_id} (meta.reconcile). Release with: "
            f"docker compose run --rm etl run {scraper_code} --accept-delistings"
        )
    elif delisted or relisted:
        slack(
            f":page_facing_up: SourceBD: {scraper_code} — {delisted} {kind.upper()} "
            f"certificates no longer listed, {relisted} listed again (run {run_id})."
        )
    return out
