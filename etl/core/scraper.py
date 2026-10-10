"""Base scraper contract. Every source implements this."""
from __future__ import annotations

import abc
import hashlib
import json
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, AsyncIterator, Callable

from etl.core.db import db, get_source_id
from etl.core.logging import get_logger

if TYPE_CHECKING:  # pragma: no cover
    from etl.acquire.models import AcquiredDoc
    from etl.core.breaker import Breaker


@dataclass
class EvidenceAttachment:
    """The provenance a scraper attaches to a record it emits.

    `doc` is the document the values were read from; `locators` maps payload
    field keys to a human-followable position within it. Anything not in
    `locators` falls back to `default_locator`.

    Optional by design: a scraper that has not been migrated yet simply emits
    records without it, and the pipeline behaves exactly as before.
    """

    doc: "AcquiredDoc"
    locators: dict[str, str] = field(default_factory=dict)
    default_locator: str | None = None
    # Override when the values were parsed from a different representation than
    # the document body — e.g. a PDF page's extracted text.
    document_text: str | None = None
    # Force the tag-stripping decision instead of inferring it from content type.
    # Needed for XML feeds, where the facts sit in elements and attributes that
    # stripping would erase, leaving every claim without a checkable excerpt.
    document_is_html: bool | None = None
    subject_table: str = "suppliers"
    skip_keys: tuple[str, ...] = ()
    # Cite a different URL than the one fetched. Needed only where the fetched
    # URL is not durably followable — an expiring session-keyed profile page —
    # so we cite the stable public entry point instead of shipping a link that
    # is guaranteed to be dead by the time anyone clicks it.
    citable_url_override: str | None = None


@dataclass
class ScrapedRecord:
    """One canonical record emitted by a scraper. Pre-normalization."""

    source_code: str                          # e.g. 'BGMEA'
    source_ref: str                           # stable per-source id (reg #, factory id, URL)
    company_name: str
    payload: dict[str, Any] = field(default_factory=dict)   # full raw fields
    contact_name: str | None = None
    contact_role: str | None = None
    email: str | None = None
    phone_raw: str | None = None
    address_raw: str | None = None
    city: str | None = None
    district: str | None = None
    website: str | None = None
    entity_type: str | None = None   # explicit override; falls back to source default
    evidence: EvidenceAttachment | None = None
    # Other refs this same record is (or was) also published under. A chained
    # enrichment scraper carries its parent row's ref here so the upsert's
    # Pass 0 resolves the record to the same supplier instead of minting a
    # duplicate (bkmea_detail carries the bkmea_web list row's ref). Never
    # hashed — the hash is the payload's identity, aliases are linkage.
    alias_refs: tuple[str, ...] = ()
    # True when this record is its source's canonical registry record (e.g.
    # bkmea_detail's member page, versus bkmea_web's directory index row).
    # Canonical records OVERWRITE the supplier's registry columns with the
    # latest scrape; non-canonical records only fill a NULL. Founder rule,
    # 3 Aug 2026: the provider's current page is the truth and must show
    # without a review round-trip.
    canonical_registry: bool = False
    # Attach-only record (founder decision D, 4 Aug 2026): the upsert enriches
    # an existing supplier match but NEVER creates one — an unmatched
    # attach-only record is skipped. The widened EPB category enumeration
    # emits these so covering unflagged RMG exporters cannot mint
    # single-source EPB profiles.
    enrich_only: bool = False
    # Payload keys left out of the change hash: our own bookkeeping that moves
    # on every read (a brand file's mirror path and fallback date) would
    # otherwise make every record look changed (spec-etl-freshness S6).
    hash_exclude: tuple[str, ...] = ()
    # Set by a list-row gate (etl.core.listgate) that skipped the detail fetch
    # because the list row is unchanged: the record IS the stored one, so it
    # reports the stored hash and the upsert takes the unchanged path.
    known_hash: str | None = None
    # Payload keys a buyer can see (directly or through the row a scraper
    # derives from them). When set, a record whose hash moved but whose shown
    # keys did not is a 'refresh' for the C4 breaker: a feed or format change
    # rewrites the raw copy without counting as a change on screen.
    shown_keys: tuple[str, ...] = ()

    def hash(self) -> str:
        if self.known_hash:
            return self.known_hash
        payload = {k: v for k, v in self.payload.items() if k not in self.hash_exclude}
        canonical = json.dumps(payload, sort_keys=True, ensure_ascii=False, default=str)
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


# How often gated() tells the queue a run is alive (records read between beats).
HEARTBEAT_EVERY = 25


class BaseScraper(abc.ABC):
    """Inherit and implement `fetch()`. Lifecycle: run() handles run-log + commit."""

    code: str = ""           # unique scraper code (e.g. 'bgmea_pdf')
    source_code: str = ""    # source catalog code (e.g. 'BGMEA')
    # Which acquisition transport this source uses. Surfaced as the transport
    # badge in /admin/sources; see etl/acquire/ for the adapters.
    transport: str = "direct"
    progress_callback: Callable[[dict[str, Any]], None] | None = None

    def __init__(self) -> None:
        self.log = get_logger(f"etl.scraper.{self.code}")
        self.last_run_id: str | None = None
        self.evidence_claims = 0
        self.credits_used = 0
        # C4 circuit breaker for this run; built on the first record.
        self.breaker: Breaker | None = None
        # Founder knob (`run <code> --accept-changes`): release a held run.
        self.accept_changes = False
        # Documents seen this run. A list page cited by 200 records is one
        # document and one credit, not two hundred.
        self._evidence_doc_ids: set[str] = set()

    @property
    def evidence_documents(self) -> int:
        return len(self._evidence_doc_ids)

    @abc.abstractmethod
    async def fetch(self) -> AsyncIterator[ScrapedRecord]:  # pragma: no cover
        """Async generator yielding ScrapedRecord."""
        if False:
            yield  # type: ignore[unreachable]

    async def gated(self) -> AsyncIterator[ScrapedRecord]:
        """`fetch()`, stopping before the first record that would cross a C4
        limit (etl.core.breaker). Run loops iterate this, never fetch()."""
        from etl.core.breaker import Breaker
        from etl.core.upsert import classify_record  # local import: avoids cycle

        read = 0
        async for rec in self.fetch():
            read += 1
            if read % HEARTBEAT_EVERY == 0 and self.progress_callback is not None:
                # Every run loop reads through here, so this is the one place a
                # long read tells the queue it is alive; without it a 3-hour
                # OEKO-TEX read was reaped as dead while still writing (10 Oct 2026).
                self.progress_callback({
                    "etl_run_id": self.last_run_id,
                    "scraper_code": self.code,
                    "event_type": "heartbeat",
                    "message": f"Read {read:,} records so far.",
                    "records_seen": read,
                })
            with db.conn() as c, c.cursor() as cur:
                if self.breaker is None:
                    cur.execute(
                        "select count(*) as n from public.source_records where source_id = %s",
                        (get_source_id(rec.source_code),),
                    )
                    self.breaker = Breaker(stored=int(cur.fetchone()["n"]),
                                           accept=self.accept_changes)
                kind = classify_record(cur, rec)
                c.rollback()
            if not self.breaker.admit(kind):
                self.log.warning("run.held", reason=self.breaker.tripped,
                                 source_ref=rec.source_ref)
                break
            yield rec

    async def run(self) -> dict[str, int]:
        """Drive a full scrape: open run log, stream upserts, close run log."""
        from etl.core.upsert import upsert_supplier_with_source  # local import: avoids cycle

        from etl.evidence.writer import reset_document_cache

        run_id = self._open_run()
        reset_document_cache()
        seen = upserted = skipped = 0
        self._emit_progress(run_id, "started", "Scraper started.", seen, upserted, skipped)
        try:
            async for rec in self.gated():
                seen += 1
                try:
                    supplier_id = upsert_supplier_with_source(rec)
                except Exception as e:  # noqa: BLE001
                    skipped += 1
                    self.log.error("upsert.failed", source_ref=rec.source_ref, error=str(e))
                else:
                    if supplier_id is None:
                        # Unchanged payload (raw_hash match): the upsert already
                        # touched fetched_at; there is nothing to enrich and no
                        # evidence to rewrite.
                        skipped += 1
                    else:
                        upserted += 1
                        await self._record_evidence(rec, supplier_id, run_id)
                if seen % 50 == 0:
                    self.log.info("progress", seen=seen, upserted=upserted, skipped=skipped)
                    self._update_run_progress(run_id, seen, upserted, skipped)
                    self._emit_progress(
                        run_id,
                        "progress",
                        f"Checked {seen} records.",
                        seen,
                        upserted,
                        skipped,
                    )
            self._close_run(run_id, "success", seen, upserted, skipped, None)
        except Exception as e:  # noqa: BLE001
            self._close_run(run_id, "failed", seen, upserted, skipped, str(e))
            raise
        return {
            "seen": seen,
            "upserted": upserted,
            "skipped": skipped,
            "evidence_documents": self.evidence_documents,
            "evidence_claims": self.evidence_claims,
            "credits_used": self.credits_used,
        }

    async def _record_evidence(
        self, rec: ScrapedRecord, supplier_id: str, run_id: str
    ) -> None:
        """Persist the citation for a record we just upserted.

        Best-effort: a provenance write must never fail an ingest, because the
        fact itself is already stored and correct. A missed citation shows up in
        the admin console as an unverified claim, which is recoverable; a failed
        ingest loses the data.
        """
        if rec.evidence is None:
            return

        from etl.core.upsert import _tier_for  # local import: avoids cycle
        from etl.evidence.writer import record

        att = rec.evidence
        try:
            doc_id, claims = await record(
                att.doc,
                scraper_code=self.code,
                source_code=self.source_code or rec.source_code,
                subject_table=att.subject_table,
                subject_id=supplier_id,
                supplier_id=supplier_id if att.subject_table == "suppliers" else None,
                payload=rec.payload,
                source_tier=_tier_for(rec.source_code),
                etl_run_id=run_id,
                locators=att.locators,
                default_locator=att.default_locator,
                skip_keys=att.skip_keys,
                document_text=att.document_text,
                document_is_html=att.document_is_html,
                citable_url_override=att.citable_url_override,
            )
        except Exception as exc:  # noqa: BLE001
            self.log.error(
                "evidence.record_failed", source_ref=rec.source_ref, error=str(exc)
            )
            return

        if doc_id:
            if doc_id not in self._evidence_doc_ids:
                self._evidence_doc_ids.add(doc_id)
                self.credits_used += att.doc.credits_used
            self.evidence_claims += claims

    # --- run log ----------------------------------------------------------
    def _open_run(self) -> str:
        with db.conn() as c, c.cursor() as cur:
            cur.execute(
                """insert into public.etl_runs (scraper_code, source_id, status)
                   values (%s, %s, 'running') returning id""",
                (self.code, get_source_id(self.source_code) if self.source_code else None),
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
        breaker = self.breaker.summary() if self.breaker is not None else None
        if status == "success" and breaker and breaker["tripped"]:
            status = "held"
        # S3 (§4.9): what the Sources page and the digest read. A held or failed
        # run is not a complete read, so it never refreshes the source's age.
        run_meta = json.dumps({"credits_used": self.credits_used, "complete": status == "success"})
        with db.conn() as c, c.cursor() as cur:
            cur.execute(
                """update public.etl_runs
                     set finished_at = now(),
                         status = %s,
                         records_seen = %s,
                         records_upserted = %s,
                         records_skipped = %s,
                         error = %s,
                         meta = coalesce(meta, '{}'::jsonb) || %s::jsonb
                                || case when %s::jsonb is null then '{}'::jsonb
                                        else jsonb_build_object('circuit_breaker', %s::jsonb) end
                   where id = %s""",
                (status, seen, upserted, skipped, error, run_meta,
                 json.dumps(breaker) if breaker else None,
                 json.dumps(breaker) if breaker else None, run_id),
            )
            c.commit()
        if status == "held":
            from etl.core.notify import slack

            slack(
                f":octagonal_sign: SourceBD: {self.code} stopped itself — {breaker['tripped']}. "
                f"{breaker['changed']} changed and {breaker['created']} new companies landed "
                f"(the allowed amount); the rest waits. Look at run {run_id} in /admin/sources, "
                f"then release with: docker compose run --rm etl run {self.code} --accept-changes"
            )
        self.log.info("run.end", run_id=run_id, status=status,
                      seen=seen, upserted=upserted, skipped=skipped)
        self._emit_progress(
            run_id,
            "success" if status == "success" else "failed",
            "Scraper finished successfully." if status == "success" else (error or "Scraper failed."),
            seen,
            upserted,
            skipped,
        )

    def _update_run_progress(self, run_id: str, seen: int, upserted: int, skipped: int) -> None:
        with db.conn() as c, c.cursor() as cur:
            cur.execute(
                """update public.etl_runs
                     set records_seen = %s,
                         records_upserted = %s,
                         records_skipped = %s
                   where id = %s""",
                (seen, upserted, skipped, run_id),
            )
            c.commit()

    def _emit_progress(
        self,
        run_id: str,
        event_type: str,
        message: str,
        seen: int,
        upserted: int,
        skipped: int,
        matched: int = 0,
    ) -> None:
        if self.progress_callback is None:
            return
        self.progress_callback(
            {
                "etl_run_id": run_id,
                "scraper_code": self.code,
                "event_type": event_type,
                "message": message,
                "records_seen": seen,
                "records_upserted": upserted,
                "records_skipped": skipped,
                "records_matched": matched,
            }
        )
