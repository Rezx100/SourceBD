"""Transport parity harness.

Runs one scraper twice — legacy transport and Firecrawl — and diffs the emitted
records field by field. Neither side writes to the database: we consume
`fetch()` directly rather than `run()`, so a parity check can never contaminate
the data moat it is meant to protect.

This is the cutover gate. A source is only switched to Firecrawl once its
payloads match on a sampled set, because Firecrawl changes *how bytes arrive*
and it is entirely possible for a page fetched through a proxy with different
headers to be served different markup — pagination stripped, a table rendered
client-side, prices localised. A diff catches that before it reaches suppliers.

    python -m etl.cli compare-parity bgmea_web --limit 25

Exit code is non-zero when parity fails, so it can gate a deploy.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

from etl.core.logging import get_logger
from etl.core.scraper import BaseScraper, ScrapedRecord
from etl.scrapers.registry import SCRAPERS

log = get_logger("etl.parity")

# Compared separately from `payload` because these are the columns that land on
# `suppliers` directly.
TOP_LEVEL_FIELDS = (
    "company_name",
    "contact_name",
    "contact_role",
    "email",
    "phone_raw",
    "address_raw",
    "city",
    "district",
    "website",
    "entity_type",
)

# The pipeline has two record shapes and the watchlist sources yield the other
# one, keyed on `entry_ref` with no `payload`. Comparing only `ScrapedRecord`
# would leave every sanctions source permanently unvalidated — and those are the
# sources whose false positives brand a real factory as sanctioned.
# `raw` is excluded deliberately: it is our own capture of the scrape rather than
# something the publisher asserts, so it differs between transports by design.
SANCTION_FIELDS = (
    "list_code",
    "source_code",
    "entity_name",
    "aliases",
    "country",
    "merchandise",
    "listed_date",
    "status",
    "status_notes",
    "source_url",
)


def record_ref(rec: Any) -> str:
    """The stable per-source key, whichever record shape this source yields."""
    ref = getattr(rec, "source_ref", None)
    if ref is None:
        ref = getattr(rec, "entry_ref", None)
    if ref is None:
        raise TypeError(
            f"{type(rec).__name__} has neither source_ref nor entry_ref, so its "
            "records cannot be matched across transports"
        )
    return str(ref)


def comparable_fields(rec: Any) -> dict[str, Any]:
    """Flatten a record to the fields a transport could plausibly change."""
    if isinstance(rec, ScrapedRecord):
        out: dict[str, Any] = {name: getattr(rec, name) for name in TOP_LEVEL_FIELDS}
        out.update({f"payload.{k}": v for k, v in rec.payload.items()})
        return out
    return {name: getattr(rec, name, None) for name in SANCTION_FIELDS}


@dataclass
class FieldDiff:
    source_ref: str
    field: str
    legacy: Any
    candidate: Any

    def as_dict(self) -> dict[str, Any]:
        return {
            "source_ref": self.source_ref,
            "field": self.field,
            "legacy": _trim(self.legacy),
            "candidate": _trim(self.candidate),
        }


@dataclass
class ParityReport:
    scraper_code: str
    legacy_transport: str
    candidate_transport: str
    legacy_count: int = 0
    candidate_count: int = 0
    only_in_legacy: list[str] = field(default_factory=list)
    only_in_candidate: list[str] = field(default_factory=list)
    compared: int = 0
    identical: int = 0
    diffs: list[FieldDiff] = field(default_factory=list)
    legacy_error: str | None = None
    candidate_error: str | None = None
    # Set when a comparison is impossible by construction rather than failing.
    # Kept distinct from an error so a sweep does not report a source we never
    # could have compared as a regression: a harness that cries wolf gets
    # ignored, and then a real failure gets ignored with it.
    not_comparable: str | None = None
    # Billable spend, reported because a sweep across every source is a real
    # cost and there is otherwise no way to know what a comparison charged.
    legacy_credits: int = 0
    candidate_credits: int = 0

    @property
    def passed(self) -> bool:
        if self.not_comparable:
            return False
        return (
            self.legacy_error is None
            and self.candidate_error is None
            and not self.diffs
            and not self.only_in_legacy
            and not self.only_in_candidate
            and self.compared > 0
        )

    @property
    def verdict(self) -> str:
        """PASS, FAIL, or SKIP. SKIP is never a pass — it is an absence of
        evidence, and a source still needs validating some other way."""
        if self.not_comparable:
            return "SKIP"
        return "PASS" if self.passed else "FAIL"

    @property
    def field_failure_counts(self) -> dict[str, int]:
        counts: dict[str, int] = {}
        for d in self.diffs:
            counts[d.field] = counts.get(d.field, 0) + 1
        return dict(sorted(counts.items(), key=lambda kv: -kv[1]))

    def as_dict(self) -> dict[str, Any]:
        return {
            "scraper_code": self.scraper_code,
            "legacy_transport": self.legacy_transport,
            "candidate_transport": self.candidate_transport,
            "legacy_count": self.legacy_count,
            "candidate_count": self.candidate_count,
            "compared": self.compared,
            "identical": self.identical,
            "only_in_legacy": self.only_in_legacy[:50],
            "only_in_candidate": self.only_in_candidate[:50],
            "diff_count": len(self.diffs),
            "diffs_by_field": self.field_failure_counts,
            "diffs": [d.as_dict() for d in self.diffs[:200]],
            "legacy_error": self.legacy_error,
            "candidate_error": self.candidate_error,
            "not_comparable": self.not_comparable,
            "verdict": self.verdict,
            "legacy_credits": self.legacy_credits,
            "candidate_credits": self.candidate_credits,
            "credits_total": self.legacy_credits + self.candidate_credits,
            "passed": self.passed,
        }


def _trim(value: Any, limit: int = 160) -> Any:
    if isinstance(value, str) and len(value) > limit:
        return value[:limit] + f"…(+{len(value) - limit})"
    if isinstance(value, (list, dict)):
        text = json.dumps(value, ensure_ascii=False, sort_keys=True, default=str)
        if len(text) > limit:
            return text[:limit] + f"…(+{len(text) - limit})"
        return text
    return value


def _canonical(value: Any) -> Any:
    """Normalise a value for comparison.

    Whitespace and key order are not facts. Everything else is: we do not
    lowercase, strip punctuation, or coerce types, because a transport that
    changes `1,240` into `1240` or drops a trailing `Ltd.` is a transport we
    need to know about before cutover.
    """
    if isinstance(value, str):
        return " ".join(value.split())
    if isinstance(value, dict):
        return {k: _canonical(v) for k, v in sorted(value.items())}
    if isinstance(value, list):
        return [_canonical(v) for v in value]
    return value


async def collect(
    scraper: BaseScraper, limit: int | None
) -> tuple[dict[str, Any], str | None]:
    """Consume `fetch()` without upserting. Returns (records_by_ref, error)."""
    out: dict[str, Any] = {}
    error: str | None = None
    try:
        async for rec in scraper.fetch():
            out[record_ref(rec)] = rec
            if limit is not None and len(out) >= limit:
                break
    except Exception as exc:  # noqa: BLE001
        error = f"{type(exc).__name__}: {exc}"
        log.error("parity.collect_failed", scraper=scraper.code, error=error)
    finally:
        closer = getattr(scraper, "aclose", None)
        if closer is not None:
            try:
                await closer()
            except Exception:  # noqa: BLE001, S110
                pass
    return out, error


def diff_records(
    legacy: dict[str, Any],
    candidate: dict[str, Any],
) -> tuple[list[FieldDiff], int, int, list[str], list[str]]:
    legacy_refs = set(legacy)
    candidate_refs = set(candidate)
    shared = sorted(legacy_refs & candidate_refs)

    diffs: list[FieldDiff] = []
    identical = 0

    for ref in shared:
        a = comparable_fields(legacy[ref])
        b = comparable_fields(candidate[ref])
        row_diffs: list[FieldDiff] = []

        for key in sorted(set(a) | set(b)):
            av, bv = _canonical(a.get(key)), _canonical(b.get(key))
            if av != bv:
                row_diffs.append(FieldDiff(ref, key, av, bv))

        if row_diffs:
            diffs.extend(row_diffs)
        else:
            identical += 1

    return (
        diffs,
        len(shared),
        identical,
        sorted(legacy_refs - candidate_refs),
        sorted(candidate_refs - legacy_refs),
    )


async def compare(
    scraper_code: str,
    limit: int | None = 25,
    legacy_transport: str = "direct",
    candidate_transport: str = "firecrawl",
) -> ParityReport:
    cls = SCRAPERS.get(scraper_code)
    if cls is None:
        raise ValueError(f"unknown scraper: {scraper_code}")

    try:
        legacy_scraper = cls(transport=legacy_transport)  # type: ignore[call-arg]
        candidate_scraper = cls(transport=candidate_transport)  # type: ignore[call-arg]
    except TypeError as exc:
        raise ValueError(
            f"{scraper_code} does not support transport switching yet — it must "
            f"subclass AcquiringScraper to be parity-tested ({exc})"
        ) from exc

    report = ParityReport(
        scraper_code=scraper_code,
        legacy_transport=legacy_transport,
        candidate_transport=candidate_transport,
    )

    # Refuse before spending anything, rather than fetching twice to discover
    # there was never anything to compare.
    if not getattr(cls, "yields_records", True):
        report.not_comparable = (
            f"{scraper_code} does not emit records from fetch() — it overrides "
            "run() and writes its own tables, so there is nothing to diff. "
            "Validate it by running it and checking what it wrote."
        )
        return report
    if not getattr(cls, "fallback_transport", None):
        report.not_comparable = (
            f"{scraper_code} has no {legacy_transport} fallback (it needs "
            f"{candidate_transport} to be fetchable at all), so there is no "
            "baseline to compare against."
        )
        return report

    legacy_recs, report.legacy_error = await collect(legacy_scraper, limit)
    report.legacy_count = len(legacy_recs)

    candidate_recs, report.candidate_error = await collect(candidate_scraper, limit)
    report.candidate_count = len(candidate_recs)

    # Read after collect, so an aborted run still reports what it spent before
    # aborting — which is the figure that matters when a budget guard fires.
    report.legacy_credits = getattr(legacy_scraper, "credits_spent", 0)
    report.candidate_credits = getattr(candidate_scraper, "credits_spent", 0)

    # A baseline that cannot fetch is not evidence against the candidate. DHS
    # serves our address a 403 for the UFLPA list, which is precisely why that
    # source moved to Firecrawl — reporting it as a parity failure forever would
    # be reporting the migration's success as a regression.
    if report.legacy_error and not report.candidate_error and candidate_recs:
        report.not_comparable = (
            f"the {legacy_transport} baseline could not fetch it "
            f"({report.legacy_error}), so there is nothing to compare against. "
            f"{candidate_transport} returned {len(candidate_recs)} record(s), "
            f"which is the case for using it."
        )
        return report

    (
        report.diffs,
        report.compared,
        report.identical,
        report.only_in_legacy,
        report.only_in_candidate,
    ) = diff_records(legacy_recs, candidate_recs)

    return report


def format_report(report: ParityReport) -> str:
    lines: list[str] = []
    lines.append(f"parity {report.verdict}: {report.scraper_code}")
    if report.not_comparable:
        lines.append(f"  not comparable — {report.not_comparable}")
        return "\n".join(lines)
    lines.append(
        f"  {report.legacy_transport}={report.legacy_count} records, "
        f"{report.candidate_transport}={report.candidate_count} records"
    )
    lines.append(f"  compared {report.compared}, identical {report.identical}")
    lines.append(
        f"  credits: {report.legacy_transport}={report.legacy_credits}, "
        f"{report.candidate_transport}={report.candidate_credits}, "
        f"total={report.legacy_credits + report.candidate_credits}"
    )

    if report.legacy_error:
        lines.append(f"  {report.legacy_transport} ERROR: {report.legacy_error}")
    if report.candidate_error:
        lines.append(f"  {report.candidate_transport} ERROR: {report.candidate_error}")

    if report.compared == 0 and not (report.legacy_error or report.candidate_error):
        if report.legacy_count and report.candidate_count:
            # Both sides produced records but sampled different ones. Sources that
            # fetch detail pages concurrently do not yield in a fixed order, so a
            # small --limit takes whichever finished first on each side. That is a
            # property of the sample, not a disagreement about the data, and
            # calling it a failure would send someone hunting a bug that is not
            # there.
            lines.append(
                f"  nothing to compare — both transports returned records but no "
                f"refs overlapped. This source does not yield in a fixed order, so "
                f"--limit {report.legacy_count} sampled different records on each "
                f"side. Re-run with a larger --limit before treating it as a "
                f"regression."
            )
        else:
            lines.append(
                "  nothing to compare — no overlapping source_refs. Check the sample "
                "size, or whether one transport returned an unusable page."
            )

    if report.only_in_legacy:
        lines.append(
            f"  MISSING from {report.candidate_transport} ({len(report.only_in_legacy)}): "
            + ", ".join(report.only_in_legacy[:10])
        )
    if report.only_in_candidate:
        lines.append(
            f"  EXTRA in {report.candidate_transport} ({len(report.only_in_candidate)}): "
            + ", ".join(report.only_in_candidate[:10])
        )

    if report.diffs:
        lines.append(f"  {len(report.diffs)} field differences:")
        for fname, count in report.field_failure_counts.items():
            lines.append(f"    {fname}: {count}")
        lines.append("  first differences:")
        for d in report.diffs[:15]:
            lines.append(f"    [{d.source_ref}] {d.field}")
            lines.append(f"      {report.legacy_transport}:   {_trim(d.legacy)!r}")
            lines.append(f"      {report.candidate_transport}: {_trim(d.candidate)!r}")

    return "\n".join(lines)
