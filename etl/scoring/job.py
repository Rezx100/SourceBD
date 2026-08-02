"""Schedulable SBI recompute job (REZ-33).

`sbi_scores` was written exactly once (the Spec-11 backfill, 21 May 2026), so
Discover's default ranking — which joins `sbi_scores` — ranked on frozen
inputs and had no row at all for suppliers created since. This job wraps
`etl.scoring.runner.run()` in the same shape as the other maintenance jobs so
the recompute sits on `etl_schedules` and runs from the admin queue, instead
of depending on someone remembering the CLI.
"""
from __future__ import annotations

from typing import Any

from etl.core.db import db
from etl.core.logging import get_logger
from etl.scoring import runner


class SbiRecomputeJob:
    """Schedulable job wrapper, so score recompute runs from the same admin UI.

    Shaped like a scraper (`code`, `run()`, an `etl_runs` row) rather than a
    bespoke script, so it appears in the queue, the timer UI and the run
    history alongside the sources whose evidence it scores.
    """

    code = "sbi_recompute"
    source_code = ""
    transport = "direct"
    # Set by the queue runner. The runner heartbeats through it after every
    # committed 500-row upsert batch: a full recompute walks every supplier,
    # and without heartbeats the stale reaper would kill a healthy job
    # (REZ-31).
    progress_callback: Any | None = None

    def __init__(self) -> None:
        self.log = get_logger("etl.scraper.sbi_recompute")
        self.last_run_id: str | None = None

    async def fetch(self) -> Any:  # pragma: no cover
        """Not a source. Present so the queue runner's interface is uniform."""
        if False:
            yield  # type: ignore[unreachable]

    async def run(self) -> dict[str, Any]:
        run_id = self._open_run()
        try:
            result = runner.run(progress_callback=self._on_batch)
        except Exception as exc:  # noqa: BLE001
            self._close_run(run_id, "failed", 0, 0, 0, str(exc))
            raise
        self._close_run(
            run_id,
            "success",
            result["seen"],
            result["upserted"],
            result["skipped_hash"],
            None,
        )
        return {
            "seen": result["seen"],
            "upserted": result["upserted"],
            "skipped": result["skipped_hash"],
            "matched": 0,
            "computed": result["computed"],
        }

    def _on_batch(self, counters: dict[str, int]) -> None:
        """Heartbeat for the queue runner; a no-op from the CLI (no callback)."""
        if self.progress_callback is None:
            return
        self.progress_callback(
            {
                "etl_run_id": self.last_run_id,
                "scraper_code": self.code,
                "event_type": "progress",
                "message": (
                    f"Scored {counters['seen']} suppliers "
                    f"({counters['upserted']} upserted)."
                ),
                "records_seen": counters["seen"],
                "records_upserted": counters["upserted"],
                "records_skipped": counters["skipped_hash"],
                "records_matched": 0,
            }
        )

    # --- run log ---------------------------------------------------------
    def _open_run(self) -> str:
        with db.conn() as c, c.cursor() as cur:
            cur.execute(
                """insert into public.etl_runs (scraper_code, status)
                   values (%s, 'running') returning id""",
                (self.code,),
            )
            run_id = str(cur.fetchone()["id"])
            self.last_run_id = run_id
            c.commit()
        self.log.info("run.start", run_id=run_id)
        return run_id

    def _close_run(
        self,
        run_id: str,
        status: str,
        seen: int,
        upserted: int,
        skipped: int,
        error: str | None,
    ) -> None:
        with db.conn() as c, c.cursor() as cur:
            cur.execute(
                """update public.etl_runs
                     set finished_at       = now(),
                         status            = %s,
                         records_seen      = %s,
                         records_upserted  = %s,
                         records_skipped   = %s,
                         error             = %s
                   where id = %s""",
                (status, seen, upserted, skipped, error, run_id),
            )
            c.commit()
        self.log.info(
            "run.end", run_id=run_id, status=status, seen=seen, upserted=upserted
        )


__all__ = ["SbiRecomputeJob"]
