"""Sanctions screening: list ingestion + supplier screening, both directions.

UFLPA / CBP-WRO / OFAC etc. don't create suppliers — they're cross-reference data.
Screening runs in BOTH directions, sharing one pair-level predicate
(`_pair_matches`) so detection cannot drift between them:

  1. Entry side — ingest_sanction_entry() upserts into sanctions_list_entries,
     then _match_and_screen() matches the new entry against existing suppliers.
  2. Supplier side — upsert_supplier_with_source() calls
     screen_supplier_against_entries() inside the upsert transaction, matching
     the newly upserted supplier against every stored list entry.

On a confident match (token_sort_ratio >= _MATCH_THRESHOLD = 95, plus the
screenability, shared-token and order-sensitivity guards in `_pair_matches`)
either side inserts into sanctions_screening; the DB trigger
trg_sanc_propagate then flips suppliers.is_sanctioned + zeros SBI.
"""
from __future__ import annotations

import abc
import json
from dataclasses import dataclass, field
from datetime import date
from typing import Any, AsyncIterator, Callable

from rapidfuzz import fuzz

from etl.core.db import db, get_source_id
from etl.core.logging import get_logger
from etl.core.normalize import normalize_company_name
from etl.core.scraper import EvidenceAttachment
from etl.core.upsert import _names_compatible

log = get_logger("etl.sanctions")

# Sanctions matches are HIGH-stakes (zero a supplier's score). Use a stricter
# threshold than the supplier-dedup pass to keep false positives near zero.
_MATCH_THRESHOLD = 95


@dataclass
class SanctionEntry:
    """One canonical row from a sanctions/forced-labor list."""

    list_code: str               # sanctions_list enum value: 'uflpa','us_wro',...
    source_code: str             # sources.code: 'UFLPA','US_WRO',...
    entry_ref: str               # stable per-list id (e.g. 'uflpa-i-0001', 'wro-china-36')
    entity_name: str
    aliases: list[str] = field(default_factory=list)
    country: str | None = None
    merchandise: str | None = None
    listed_date: date | None = None
    status: str | None = None
    status_notes: str | None = None
    source_url: str | None = None
    raw: dict[str, Any] = field(default_factory=dict)
    evidence: EvidenceAttachment | None = None

    def claim_payload(self) -> dict[str, Any]:
        """The citable facts on this entry.

        `aliases` and `raw` are excluded: a list has no single excerpt, and `raw`
        is our own capture of the scrape rather than an assertion by the
        publisher.
        """
        return {
            k: v
            for k, v in {
                "entity_name": self.entity_name,
                "country": self.country,
                "merchandise": self.merchandise,
                "listed_date": self.listed_date.isoformat() if self.listed_date else None,
                "status": self.status,
                "status_notes": self.status_notes,
            }.items()
            if v not in (None, "")
        }


def ingest_sanction_entry(entry: SanctionEntry) -> dict[str, Any]:
    """Upsert into sanctions_list_entries + match to suppliers.

    Returns: {'entry_id': uuid, 'matched_supplier_ids': [..], 'screened': int}.
    """
    norm = normalize_company_name(entry.entity_name)
    raw_json = json.dumps(entry.raw, sort_keys=True, ensure_ascii=False, default=str)

    with db.conn() as c, c.cursor() as cur:
        cur.execute(
            """insert into public.sanctions_list_entries
                 (list, entry_ref, entity_name, entity_name_norm, aliases,
                  country, merchandise, listed_date, status, status_notes,
                  source_url, raw, fetched_at)
               values (%s,%s,%s,%s,%s, %s,%s,%s,%s,%s, %s, %s::jsonb, now())
               on conflict (list, entry_ref) do update set
                 entity_name      = excluded.entity_name,
                 entity_name_norm = excluded.entity_name_norm,
                 aliases          = excluded.aliases,
                 country          = excluded.country,
                 merchandise      = excluded.merchandise,
                 listed_date      = excluded.listed_date,
                 status           = excluded.status,
                 status_notes     = excluded.status_notes,
                 source_url       = excluded.source_url,
                 raw              = excluded.raw,
                 fetched_at       = now()
               returning id""",
            (
                entry.list_code, entry.entry_ref, entry.entity_name, norm, entry.aliases,
                entry.country, entry.merchandise, entry.listed_date,
                entry.status, entry.status_notes,
                entry.source_url, raw_json,
            ),
        )
        entry_id = str(cur.fetchone()["id"])

        matched = _match_and_screen(cur, entry=entry, norm=norm, entry_id=entry_id)
        c.commit()

    return {"entry_id": entry_id, "matched_supplier_ids": matched, "screened": len(matched)}


# ---------------------------------------------------------------------------
def _significant_tokens(s: str) -> set[str]:
    """Tokens of length >=4 in a normalized name. These are the 'content'
    words after legal suffixes (Ltd, Group, International, Bangladesh, ...)
    have been stripped by `normalize_company_name`."""
    return {t for t in s.split() if len(t) >= 4}


def _is_screenable(s: str) -> bool:
    """A normalized name is screenable iff it has >=2 significant tokens
    (length >=4 each).

    Rationale: after suffix stripping, names like "m s d" (was "M.S.D.
    International"), "s m a" (was "S M A"), "pacific" (was "International
    Pacific Trading, Inc."), or "new horizons" (was "NEW HORIZONS TRADING
    LIMITED") collapse to too little content to be matched safely against
    8,000+ Bangladesh suppliers. token_sort_ratio hits 100 on permuted
    initials and 96+ on shared single common words, generating false
    positives that wrongly flag real suppliers as sanctioned.

    We accept the trade-off of missing one-word brand sanctions (e.g. a
    bare "Beximco") in exchange for zero false positives. Single-word
    sanctioned entities can still be added manually to the verification
    queue.
    """
    return len(_significant_tokens(s)) >= 2


def _pair_matches(a_norm: str, b_norm: str) -> bool:
    """The ONE pair-level screening rule, shared by both directions.

    Entry side (`_match_and_screen`, at list ingest) and supplier side
    (`screen_supplier_against_entries`, at supplier upsert) both decide through
    this predicate so detection cannot drift between directions — the same
    principle as `ops/check_supplier_conflations.py` reusing
    `_names_compatible`.

    A pair of normalized names must clear ALL of:

    - `_is_screenable` on BOTH sides. A name that collapses to fewer than two
      significant tokens ("m s d", "pacific") can never be screened safely,
      whichever side of the comparison it sits on.
    - At least TWO significant tokens (length >= 4) literally shared. A single
      shared common word like "pacific" or "international" is not evidence —
      token_sort_ratio happily scores 96+ on "Pacific Interntional" vs
      "International Pacific Trading" purely on that overlap. Real matches
      almost always share 2+ distinctive tokens (brand + product, or two-part
      company name).
    - `fuzz.token_sort_ratio` >= `_MATCH_THRESHOLD` (95).
    - `_names_compatible` from supplier dedup. token_sort_ratio sorts tokens
      before comparing, so it is blind to word order as a signal: COTTON FAIR
      / FAIR COTTON (two different BKMEA members) scores 100, and a swapped
      leading initials block (A. B. / B. A. KNITWEAR INDUSTRIES) scores 95+.
      A false positive here brands a real factory as sanctioned and zeroes its
      score, so the order-sensitive guard applies with full force.
    """
    if not _is_screenable(a_norm) or not _is_screenable(b_norm):
        return False
    if len(_significant_tokens(a_norm) & _significant_tokens(b_norm)) < 2:
        return False
    if fuzz.token_sort_ratio(a_norm, b_norm) < _MATCH_THRESHOLD:
        return False
    return _names_compatible(a_norm, b_norm)


def _insert_screening_row(
    cur,
    *,
    supplier_id: str,
    list_code: str,
    matched_name: str,
    score: float,
    entry_ref: str,
    entry_id: str,
    source_url: str | None,
) -> None:
    """One active sanctions_screening row for a confirmed match.

    `on conflict do nothing` only dedups once migration 0089's partial unique
    index exists; until then re-ingests can mint duplicate active rows per
    match. The details shape is identical for both directions.
    """
    cur.execute(
        """insert into public.sanctions_screening
             (supplier_id, list, matched_name, match_score,
              list_entry_ref, details, screened_at, active)
           values (%s, %s, %s, %s, %s, %s::jsonb, now(), true)
           on conflict do nothing""",
        (
            supplier_id, list_code, matched_name, score / 100.0,
            entry_ref,
            json.dumps(
                {"sanctions_list_entry_id": entry_id, "source_url": source_url},
                ensure_ascii=False,
            ),
        ),
    )
    log.warning(
        "sanctions.match",
        supplier_id=supplier_id, list=list_code,
        name=matched_name, score=score,
    )


def _match_and_screen(cur, *, entry: SanctionEntry, norm: str, entry_id: str) -> list[str]:
    """Entry side: fuzzy-match a new list entry against suppliers; insert
    sanctions_screening rows on hit."""
    candidates: dict[str, str] = {}

    screenable_targets = [norm] if _is_screenable(norm) else []
    for alias in entry.aliases:
        a = normalize_company_name(alias)
        if a and _is_screenable(a):
            screenable_targets.append(a)
    if not screenable_targets:
        return []

    # Trigram-prefiltered candidate set, plus any alias-equal matches.
    for tgt in screenable_targets:
        cur.execute(
            """select id, company_name_norm
                 from public.suppliers
                where company_name_norm %% %s
                limit 50""",
            (tgt,),
        )
        for r in cur.fetchall():
            candidates.setdefault(str(r["id"]), r["company_name_norm"])

    if not candidates:
        return []

    matched: list[str] = []
    for sid, sup_norm in candidates.items():
        passing = [t for t in screenable_targets if _pair_matches(t, sup_norm)]
        if not passing:
            continue
        best = max(fuzz.token_sort_ratio(t, sup_norm) for t in passing)

        _insert_screening_row(
            cur,
            supplier_id=sid,
            list_code=entry.list_code,
            matched_name=entry.entity_name,
            score=best,
            entry_ref=entry.entry_ref,
            entry_id=entry_id,
            source_url=entry.source_url,
        )
        matched.append(sid)

    return matched


def screen_supplier_against_entries(cur, *, supplier_id: str, norm: str) -> list[str]:
    """Supplier side: screen one supplier against every stored list entry.

    Called from `upsert_supplier_with_source` INSIDE the upsert transaction:
    screening is the P0 invariant, not enrichment, so a failure here raises
    and rolls the supplier record back rather than publishing an unscreened
    supplier. (`BaseScraper.run`'s per-record try/except then contains it as
    records_skipped — loud, and self-healing on the next ingest.) The match
    decision is `_pair_matches`, the same predicate the entry side uses.

    Returns the matched sanctions_list_entries ids.
    """
    if not _is_screenable(norm):
        return []

    # Trigram prefilter over the GIN index idx_sle_name_trgm, best-first so a
    # true match survives the limit even when many entries trigram-match.
    cur.execute(
        """select id, list, entry_ref, entity_name, entity_name_norm, source_url
             from public.sanctions_list_entries
            where entity_name_norm %% %s
            order by entity_name_norm <-> %s
            limit 50""",
        (norm, norm),
    )

    matched: list[str] = []
    for row in cur.fetchall():
        entry_norm = row["entity_name_norm"]
        if not _pair_matches(norm, entry_norm):
            continue
        entry_id = str(row["id"])
        _insert_screening_row(
            cur,
            supplier_id=supplier_id,
            list_code=row["list"],
            matched_name=row["entity_name"],
            score=fuzz.token_sort_ratio(norm, entry_norm),
            entry_ref=row["entry_ref"],
            entry_id=entry_id,
            source_url=row["source_url"],
        )
        matched.append(entry_id)

    return matched


# ---------------------------------------------------------------------------
class BaseSanctionScraper(abc.ABC):
    """Same shape as BaseScraper but yields SanctionEntry and routes through
    ingest_sanction_entry() instead of supplier upsert."""

    code: str = ""
    source_code: str = ""
    progress_callback: Callable[[dict[str, Any]], None] | None = None

    def __init__(self) -> None:
        self.log = get_logger(f"etl.sanctions.{self.code}")
        self.last_run_id: str | None = None
        self.evidence_claims = 0
        self.credits_used = 0
        self._evidence_doc_ids: set[str] = set()

    @property
    def evidence_documents(self) -> int:
        return len(self._evidence_doc_ids)

    @abc.abstractmethod
    async def fetch(self) -> AsyncIterator[SanctionEntry]:  # pragma: no cover
        if False:
            yield  # type: ignore[unreachable]

    async def run(self) -> dict[str, int]:
        from etl.evidence.writer import reset_document_cache

        run_id = self._open_run()
        reset_document_cache()
        seen = upserted = skipped = matched_total = 0
        self._emit_progress(
            run_id, "started", "Sanctions scraper started.", seen, upserted, skipped, matched_total
        )
        try:
            async for entry in self.fetch():
                seen += 1
                try:
                    res = ingest_sanction_entry(entry)
                    upserted += 1
                    matched_total += res["screened"]
                except Exception as e:  # noqa: BLE001
                    skipped += 1
                    self.log.error(
                        "ingest.failed", entry_ref=entry.entry_ref, error=str(e)
                    )
                else:
                    await self._record_evidence(entry, res["entry_id"], run_id)
                if seen % 25 == 0:
                    self.log.info(
                        "progress", seen=seen, upserted=upserted,
                        skipped=skipped, matched=matched_total,
                    )
                    self._update_run_progress(run_id, seen, upserted, skipped, matched_total)
                    self._emit_progress(
                        run_id,
                        "progress",
                        f"Checked {seen} sanctions entries.",
                        seen,
                        upserted,
                        skipped,
                        matched_total,
                    )
            self._close_run(
                run_id, "success", seen, upserted, skipped, matched_total, None
            )
        except Exception as e:  # noqa: BLE001
            self._close_run(
                run_id, "failed", seen, upserted, skipped, matched_total, str(e)
            )
            raise
        return {
            "seen": seen, "upserted": upserted,
            "skipped": skipped, "matched": matched_total,
            "evidence_documents": self.evidence_documents,
            "evidence_claims": self.evidence_claims,
            "credits_used": self.credits_used,
        }

    async def _record_evidence(
        self, entry: SanctionEntry, entry_id: str, run_id: str
    ) -> None:
        """Cite a sanctions entry to the list page it was read from.

        Best-effort, for the same reason as the supplier path: the entry itself
        is already stored, and a missing citation is recoverable while a failed
        ingest of a forced-labor listing is not.
        """
        if entry.evidence is None:
            return

        from etl.core.upsert import _tier_for
        from etl.evidence.writer import record

        att = entry.evidence
        try:
            doc_id, claims = await record(
                att.doc,
                scraper_code=self.code,
                source_code=self.source_code or entry.source_code,
                subject_table="sanctions_list_entries",
                subject_id=entry_id,
                payload=entry.claim_payload(),
                source_tier=_tier_for(entry.source_code),
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
                "evidence.record_failed", entry_ref=entry.entry_ref, error=str(exc)
            )
            return

        if doc_id:
            if doc_id not in self._evidence_doc_ids:
                self._evidence_doc_ids.add(doc_id)
                self.credits_used += att.doc.credits_used
            self.evidence_claims += claims

    # --- run log ---
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
        matched: int,
        error: str | None,
    ) -> None:
        meta = json.dumps({"matched_suppliers": matched})
        with db.conn() as c, c.cursor() as cur:
            cur.execute(
                """update public.etl_runs
                     set finished_at = now(),
                         status = %s,
                         records_seen = %s,
                         records_upserted = %s,
                         records_skipped = %s,
                         meta = coalesce(meta, '{}'::jsonb) || %s::jsonb,
                         error = %s
                   where id = %s""",
                (status, seen, upserted, skipped, meta, error, run_id),
            )
            c.commit()
        self.log.info(
            "run.end", run_id=run_id, status=status,
            seen=seen, upserted=upserted, skipped=skipped, matched=matched,
        )
        self._emit_progress(
            run_id,
            "success" if status == "success" else "failed",
            "Sanctions scraper finished successfully." if status == "success" else (error or "Sanctions scraper failed."),
            seen,
            upserted,
            skipped,
            matched,
        )

    def _update_run_progress(
        self,
        run_id: str,
        seen: int,
        upserted: int,
        skipped: int,
        matched: int,
    ) -> None:
        meta = json.dumps({"matched_suppliers": matched})
        with db.conn() as c, c.cursor() as cur:
            cur.execute(
                """update public.etl_runs
                     set records_seen = %s,
                         records_upserted = %s,
                         records_skipped = %s,
                         meta = coalesce(meta, '{}'::jsonb) || %s::jsonb
                   where id = %s""",
                (seen, upserted, skipped, meta, run_id),
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
        matched: int,
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
