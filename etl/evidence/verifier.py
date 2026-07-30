"""Re-check recorded citations: is the link still live, and does it still say it?

A liveness check on its own is not enough. A registry page that returns 200 but
has dropped a factory's worker count is a broken citation that looks perfectly
healthy to an HTTP status check, and shipping it to a buyer asserts a fact we no
longer have evidence for. So every pass compares the document's content hash and,
when the content moved, re-checks each claim's recorded excerpt.

The single most important rule here is the one REZ-30 was caused by breaking: a
transient failure must never be mistaken for an absent fact. A timeout, a 403, a
502 or a dropped connection says nothing about whether the page exists or what it
says. Those outcomes leave the document's previous state exactly as it was, log an
`inconclusive` check, and back the retry off. Only a definitive 404/410 retires a
citation.

Three verification depths, taken from how the document was acquired:

* ``full``     — the request replays exactly (a GET, or a file on disk), so a
                 missing excerpt is real drift.
* ``liveness`` — the page is reachable but the payload cannot be reproduced
                 (Firecrawl action sequences: SA8000's in-page harvest, RSC's
                 modal walk). A missing excerpt is "could not check".
* ``none``     — the request cannot be reissued at all (a POST body: EPB, WRAP,
                 OEKO-TEX). Excluded from the queue; these citations rest on
                 their archived Bunny snapshot, and the admin console says so.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, AsyncIterator

from etl.acquire import (
    AcquiredDoc,
    AcquireRequest,
    DirectAdapter,
    FirecrawlAdapter,
    LocalFileAdapter,
)
from etl.acquire.models import Adapter, FetchStatus
from etl.core.db import db
from etl.core.logging import get_logger
from etl.core.scraper import ScrapedRecord
from etl.evidence.locate import excerpt_contains, strips_tags_for

log = get_logger("etl.evidence.verifier")

# Base re-check interval. Citations do not rot on an hourly timescale, and each
# check costs a credit on Firecrawl-backed documents.
DEFAULT_INTERVAL_HOURS = 24 * 7
# Consecutive transient failures after which a document is surfaced for a human.
# It still never becomes `dead` on this path — an unreachable source is an
# operational problem, not evidence that a fact was retracted.
MAX_TRANSIENT_BEFORE_ATTENTION = 5
# Cap on the backoff multiplier so a long outage cannot push a document's next
# check years out.
MAX_BACKOFF_STEPS = 6
# Firecrawl serves a cached copy for free within this window, which makes the
# long-tail sweep cheap. It is deliberately shorter than the re-check interval:
# a cache hit older than the last check would confirm nothing new.
VERIFY_MAX_AGE_MS = 24 * 60 * 60 * 1000


@dataclass
class VerifyOutcome:
    """Result of checking one document."""

    evidence_id: str
    url: str
    outcome: str  # live | changed | dead | inconclusive
    adapter: str = Adapter.DIRECT.value
    http_status: int | None = None
    fetch_status: str = FetchStatus.ERROR.value
    content_sha256: str | None = None
    content_changed: bool = False
    claims_checked: int = 0
    claims_confirmed: int = 0
    claims_missing: int = 0
    claims_unverifiable: int = 0
    credits_used: int = 0
    notes: dict[str, Any] = field(default_factory=dict)


def _select_due(
    limit: int,
    *,
    scraper_code: str | None = None,
    interval_hours: int = DEFAULT_INTERVAL_HOURS,
) -> list[dict[str, Any]]:
    """Documents whose next check is due, oldest first.

    The backoff term is what keeps a source outage from turning into a hot loop:
    each consecutive transient failure doubles the wait, so a site that is down
    for a week is retried a handful of times rather than every pass.
    """
    sql = """
    select id, url, final_url, adapter, content_sha256, content_type,
           scraper_code, source_id, transient_failures, verify_status, meta
      from public.evidence_documents
     where fetch_status = 'ok'
       and coalesce(meta->>'verify_mode', 'full') <> 'none'
       and (
             last_verified_at is null
          or last_verified_at < now() - (
               make_interval(hours => %(interval)s)
               * power(2, least(transient_failures, %(max_steps)s))
             )
           )
    """
    params: dict[str, Any] = {
        "interval": interval_hours,
        "max_steps": MAX_BACKOFF_STEPS,
        "limit": limit,
    }
    if scraper_code:
        sql += " and scraper_code = %(scraper_code)s"
        params["scraper_code"] = scraper_code
    sql += " order by last_verified_at asc nulls first limit %(limit)s"

    with db.conn() as c, c.cursor() as cur:
        cur.execute(sql, params)
        return list(cur.fetchall())


def _load_claims(evidence_id: str) -> list[dict[str, Any]]:
    with db.conn() as c, c.cursor() as cur:
        cur.execute(
            """select id, field_key, field_value, excerpt, status
                 from public.evidence_claims
                where evidence_id = %s and status in ('active', 'stale')""",
            (evidence_id,),
        )
        return list(cur.fetchall())


class EvidenceVerifier:
    """Re-check a batch of recorded documents and reconcile their claims."""

    def __init__(self) -> None:
        self._firecrawl: FirecrawlAdapter | None = None
        self._direct: DirectAdapter | None = None
        self._local: LocalFileAdapter | None = None

    # ------------------------------------------------------------------ fetch
    async def _refetch(self, row: dict[str, Any]) -> AcquiredDoc:
        adapter = row["adapter"]
        meta = row.get("meta") or {}
        if adapter == Adapter.FIRECRAWL.value:
            if self._firecrawl is None:
                self._firecrawl = FirecrawlAdapter()
            return await self._firecrawl.fetch(
                AcquireRequest(
                    url=row["url"],
                    # Mirror the acquisition options that change what the
                    # document contains. Re-checking a registry table with the
                    # Firecrawl default of only_main_content=True would strip
                    # the table and report every claim on it as drifted.
                    only_main_content=bool(meta.get("only_main_content", False)),
                    max_age_ms=VERIFY_MAX_AGE_MS,
                    label="verify",
                )
            )
        if adapter == Adapter.LOCAL.value:
            if self._local is None:
                self._local = LocalFileAdapter()
            return await self._local.fetch(
                AcquireRequest(url=row["url"], label="verify")
            )
        if self._direct is None:
            self._direct = DirectAdapter()
        return await self._direct.fetch(
            AcquireRequest(url=row["url"], want_bytes=True, label="verify")
        )

    async def aclose(self) -> None:
        for adapter in (self._firecrawl, self._direct):
            if adapter is not None:
                await adapter.aclose()
        self._firecrawl = None
        self._direct = None
        self._local = None

    # ----------------------------------------------------------------- verify
    async def verify_document(self, row: dict[str, Any]) -> VerifyOutcome:
        evidence_id = str(row["id"])
        meta = row.get("meta") or {}
        mode = meta.get("verify_mode") or "full"
        doc = await self._refetch(row)

        result = VerifyOutcome(
            evidence_id=evidence_id,
            url=row["url"],
            outcome="inconclusive",
            adapter=doc.adapter.value,
            http_status=doc.http_status,
            fetch_status=doc.fetch_status.value,
            content_sha256=doc.content_sha256 if doc.ok else None,
            credits_used=doc.credits_used,
        )

        if doc.fetch_status is FetchStatus.NOT_FOUND:
            if row["adapter"] == Adapter.LOCAL.value:
                # A staged file disappearing means our own raw directory is not
                # mounted or was cleaned — it is not the publisher retracting a
                # fact. Retiring thousands of claims over a missing volume would
                # be the same silent-success error in reverse.
                result.outcome = "inconclusive"
                result.notes["reason"] = "local_file_missing"
                self._record_transient(evidence_id, row, result)
                return result
            result.outcome = "dead"
            self._mark_dead(evidence_id, doc, result)
            return result

        if not doc.ok:
            result.notes["reason"] = doc.error_message or doc.fetch_status.value
            self._record_transient(evidence_id, row, result)
            return result

        result.content_changed = doc.content_sha256 != row["content_sha256"]
        claims = _load_claims(evidence_id)
        result.claims_checked = len(claims)

        if not result.content_changed:
            # Byte-identical: nothing can have drifted, so skip the per-claim
            # text search entirely. This is the common case and the reason a
            # weekly sweep over tens of thousands of documents is affordable.
            result.claims_confirmed = len(claims)
            result.outcome = "live"
            self._mark_live(evidence_id, doc, claims, result)
            return result

        body = doc.text()
        is_html = strips_tags_for(doc.content_type or row.get("content_type"), body)
        confirmed: list[str] = []
        missing: list[str] = []
        unverifiable: list[str] = []

        for claim in claims:
            excerpt = claim["excerpt"]
            if not excerpt:
                # No excerpt was ever captured — a binary file, or a value the
                # source publishes in an encoding we cannot quote. The document
                # hash moved, so we cannot confirm it either way.
                unverifiable.append(str(claim["id"]))
                continue
            if excerpt_contains(excerpt, body, claim["field_value"], is_html=is_html):
                confirmed.append(str(claim["id"]))
            elif mode == "full":
                missing.append(str(claim["id"]))
            else:
                # The payload this excerpt came from cannot be reproduced by a
                # plain re-scrape, so its absence proves nothing.
                unverifiable.append(str(claim["id"]))

        result.claims_confirmed = len(confirmed)
        result.claims_missing = len(missing)
        result.claims_unverifiable = len(unverifiable)
        # Content moving without any cited fact moving is a redeploy, not drift,
        # and must not raise an alert — otherwise every cosmetic change on a
        # source floods the console and the real ones get ignored.
        result.outcome = "changed" if missing else "live"
        self._apply_changed(evidence_id, doc, confirmed, missing, result)
        return result

    # --------------------------------------------------------------- persist
    def _record_transient(
        self, evidence_id: str, row: dict[str, Any], result: VerifyOutcome
    ) -> None:
        """Back off, and leave the document's last known good state alone."""
        failures = int(row.get("transient_failures") or 0) + 1
        needs_attention = failures >= MAX_TRANSIENT_BEFORE_ATTENTION
        with db.conn() as c, c.cursor() as cur:
            cur.execute(
                """update public.evidence_documents
                      set last_verified_at   = now(),
                          transient_failures = %s,
                          verify_detail      = verify_detail || %s::jsonb,
                          updated_at         = now()
                    where id = %s""",
                (
                    failures,
                    json.dumps(
                        {
                            "last_transient": result.notes.get("reason"),
                            "consecutive_transient_failures": failures,
                            "needs_attention": needs_attention,
                        }
                    ),
                    evidence_id,
                ),
            )
            c.commit()
        self._log_check(evidence_id, result)
        if needs_attention:
            log.warning(
                "verify.persistent_failure",
                evidence_id=evidence_id,
                url=row["url"],
                failures=failures,
                reason=result.notes.get("reason"),
            )

    def _mark_dead(
        self, evidence_id: str, doc: AcquiredDoc, result: VerifyOutcome
    ) -> None:
        with db.conn() as c, c.cursor() as cur:
            cur.execute(
                """update public.evidence_documents
                      set verify_status      = 'dead',
                          last_verified_at   = now(),
                          http_status        = %s,
                          transient_failures = 0,
                          verify_detail      = verify_detail || %s::jsonb,
                          updated_at         = now()
                    where id = %s""",
                (
                    doc.http_status,
                    json.dumps({"dead_since": "now", "needs_attention": True}),
                    evidence_id,
                ),
            )
            # Orphaned rather than deleted: the fact and its history stay, and
            # the profile UI falls back to the dated archived snapshot, labelled
            # as an archived copy.
            cur.execute(
                """update public.evidence_claims
                      set status = 'orphaned', updated_at = now()
                    where evidence_id = %s and status <> 'orphaned'""",
                (evidence_id,),
            )
            result.claims_missing = cur.rowcount or 0
            result.claims_checked = result.claims_missing
            c.commit()
        self._log_check(evidence_id, result)
        log.warning("verify.dead", evidence_id=evidence_id, url=result.url)

    def _mark_live(
        self,
        evidence_id: str,
        doc: AcquiredDoc,
        claims: list[dict[str, Any]],
        result: VerifyOutcome,
    ) -> None:
        with db.conn() as c, c.cursor() as cur:
            cur.execute(
                """update public.evidence_documents
                      set verify_status      = 'live',
                          last_verified_at   = now(),
                          http_status        = coalesce(%s, http_status),
                          transient_failures = 0,
                          verify_detail      = verify_detail - 'needs_attention'
                                                            - 'last_transient',
                          updated_at         = now()
                    where id = %s""",
                (doc.http_status, evidence_id),
            )
            if claims:
                cur.execute(
                    """update public.evidence_claims
                          set status            = 'active',
                              last_confirmed_at = now(),
                              updated_at        = now()
                        where evidence_id = %s""",
                    (evidence_id,),
                )
            c.commit()
        self._log_check(evidence_id, result)

    def _apply_changed(
        self,
        evidence_id: str,
        doc: AcquiredDoc,
        confirmed: list[str],
        missing: list[str],
        result: VerifyOutcome,
    ) -> None:
        with db.conn() as c, c.cursor() as cur:
            cur.execute(
                """update public.evidence_documents
                      set verify_status      = %s,
                          last_verified_at   = now(),
                          http_status        = coalesce(%s, http_status),
                          transient_failures = 0,
                          verify_detail      = verify_detail || %s::jsonb,
                          updated_at         = now()
                    where id = %s""",
                (
                    "changed" if missing else "live",
                    doc.http_status,
                    json.dumps(
                        {
                            "content_changed": True,
                            "claims_missing": len(missing),
                            "claims_unverifiable": result.claims_unverifiable,
                            "new_content_sha256": doc.content_sha256,
                            "needs_attention": bool(missing),
                        }
                    ),
                    evidence_id,
                ),
            )
            if confirmed:
                cur.execute(
                    """update public.evidence_claims
                          set status            = 'active',
                              last_confirmed_at = now(),
                              updated_at        = now()
                        where id = any(%s::uuid[])""",
                    (confirmed,),
                )
            if missing:
                cur.execute(
                    """update public.evidence_claims
                          set status     = 'stale',
                              updated_at = now()
                        where id = any(%s::uuid[])""",
                    (missing,),
                )
            c.commit()
        self._log_check(evidence_id, result)
        if missing:
            log.warning(
                "verify.drifted",
                evidence_id=evidence_id,
                url=result.url,
                missing=len(missing),
                confirmed=len(confirmed),
            )

    def _log_check(self, evidence_id: str, result: VerifyOutcome) -> None:
        """Append to the immutable check log.

        Kept separate from the document's current state so "this citation has
        failed the same way for a month" is answerable, which a single mutable
        status column cannot express.
        """
        try:
            with db.conn() as c, c.cursor() as cur:
                cur.execute(
                    """insert into public.evidence_verifications
                         (evidence_id, adapter, http_status, fetch_status,
                          content_sha256, content_changed,
                          claims_checked, claims_confirmed, claims_missing,
                          outcome, credits_used, notes)
                       values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb)""",
                    (
                        evidence_id,
                        result.adapter,
                        result.http_status,
                        result.fetch_status,
                        result.content_sha256,
                        result.content_changed,
                        result.claims_checked,
                        result.claims_confirmed,
                        result.claims_missing,
                        result.outcome,
                        result.credits_used,
                        json.dumps(
                            {
                                **result.notes,
                                "claims_unverifiable": result.claims_unverifiable,
                            }
                        ),
                    ),
                )
                c.commit()
        except Exception as exc:  # noqa: BLE001
            log.error("verify.log_failed", evidence_id=evidence_id, error=str(exc))


class VerifyEvidenceJob:
    """Schedulable job wrapper, so verification runs from the same admin UI.

    Shaped like a scraper (`code`, `run()`, an `etl_runs` row) rather than a
    bespoke script, so it appears in the queue, the timer UI and the run history
    alongside the sources it is checking.
    """

    code = "verify_evidence"
    source_code = ""
    transport = "direct"
    # Set by the queue runner. Verification has no per-record progress worth
    # streaming, so it is accepted and unused rather than special-cased there.
    progress_callback: Any | None = None

    def __init__(
        self,
        limit: int = 500,
        scraper_code: str | None = None,
        interval_hours: int = DEFAULT_INTERVAL_HOURS,
    ) -> None:
        self.log = get_logger("etl.scraper.verify_evidence")
        self.limit = limit
        self.scraper_code = scraper_code
        self.interval_hours = interval_hours
        self.last_run_id: str | None = None

    async def fetch(self) -> AsyncIterator[ScrapedRecord]:  # pragma: no cover
        """Not a source. Present so the queue runner's interface is uniform."""
        if False:
            yield  # type: ignore[unreachable]

    async def run(self) -> dict[str, Any]:
        run_id = self._open_run()
        verifier = EvidenceVerifier()
        counts = {
            "live": 0,
            "changed": 0,
            "dead": 0,
            "inconclusive": 0,
        }
        seen = 0
        credits = 0
        claims_confirmed = claims_missing = 0
        try:
            rows = _select_due(
                self.limit,
                scraper_code=self.scraper_code,
                interval_hours=self.interval_hours,
            )
            self.log.info("verify.due", count=len(rows), limit=self.limit)
            for row in rows:
                seen += 1
                try:
                    outcome = await verifier.verify_document(row)
                except Exception as exc:  # noqa: BLE001
                    # An unexpected error on one document is itself transient
                    # from the citation's point of view; never let it retire one.
                    counts["inconclusive"] += 1
                    self.log.error(
                        "verify.document_failed",
                        evidence_id=str(row["id"]),
                        url=row["url"],
                        error=str(exc)[:300],
                    )
                    continue
                counts[outcome.outcome] = counts.get(outcome.outcome, 0) + 1
                credits += outcome.credits_used
                claims_confirmed += outcome.claims_confirmed
                claims_missing += outcome.claims_missing
                if seen % 50 == 0:
                    self.log.info("verify.progress", seen=seen, **counts)
            self._close_run(run_id, "success", seen, counts, None)
        except Exception as exc:  # noqa: BLE001
            self._close_run(run_id, "failed", seen, counts, str(exc))
            raise
        finally:
            await verifier.aclose()

        return {
            "seen": seen,
            "upserted": counts["live"] + counts["changed"],
            "skipped": counts["inconclusive"],
            "live": counts["live"],
            "changed": counts["changed"],
            "dead": counts["dead"],
            "inconclusive": counts["inconclusive"],
            "claims_confirmed": claims_confirmed,
            "claims_missing": claims_missing,
            "credits_used": credits,
        }

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
        counts: dict[str, int],
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
                (
                    status,
                    seen,
                    counts.get("live", 0) + counts.get("changed", 0),
                    counts.get("inconclusive", 0),
                    error,
                    run_id,
                ),
            )
            c.commit()
        self.log.info("run.end", run_id=run_id, status=status, seen=seen, **counts)


__all__ = [
    "EvidenceVerifier",
    "VerifyEvidenceJob",
    "VerifyOutcome",
    "DEFAULT_INTERVAL_HOURS",
]
