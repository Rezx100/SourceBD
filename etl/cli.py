"""SourceBD ETL command-line interface.

Usage:
  python -m etl.cli migrate          # apply pending SQL migrations
  python -m etl.cli ping             # verify DB connectivity
  python -m etl.cli list             # list registered scrapers
  python -m etl.cli run <scraper>    # run a scraper end-to-end
"""
from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any

import typer

from etl.core.db import db
from etl.core.logging import get_logger
from etl.scrapers.btma_spinning import BtmaSpinningScraper
from etl.scrapers.registry import JOBS, RUNNABLE, SCRAPERS
from etl.scrapers.rsc_documents import RscDocumentsScraper

app = typer.Typer(add_completion=False, help="SourceBD ETL")
log = get_logger("etl.cli")

MIGRATIONS_DIR = Path(__file__).parent.parent / "supabase" / "migrations"


@app.command()
def ping() -> None:
    """Check Supabase Postgres connectivity."""
    with db.conn() as c, c.cursor() as cur:
        cur.execute("select current_database(), current_user, version()")
        row = cur.fetchone()
        typer.echo(str(row))


@app.command()
def migrate() -> None:
    """Apply all .sql files under supabase/migrations in lexicographic order."""
    files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    if not files:
        typer.echo("no migration files found")
        raise typer.Exit(1)
    for f in files:
        typer.echo(f"applying {f.name} ...")
        sql = f.read_text(encoding="utf-8")
        with db.conn() as c, c.cursor() as cur:
            cur.execute(sql)
            c.commit()
        typer.echo(f"  ok: {f.name}")


@app.command("list")
def list_scrapers() -> None:
    for code, cls in SCRAPERS.items():
        transport = getattr(cls, "transport", "direct")
        typer.echo(f"{code:15s}  source={cls.source_code:12s}  transport={transport}")
    for code in JOBS:
        typer.echo(f"{code:15s}  (maintenance job)")


@app.command("compare-parity")
def compare_parity_cmd(
    scraper: str = typer.Argument(..., help="Scraper code, e.g. bgmea_web."),
    limit: int = typer.Option(25, help="Compare at most N records per transport."),
    legacy: str = typer.Option("direct", help="Baseline transport."),
    candidate: str = typer.Option("firecrawl", help="Transport being validated."),
    json_out: Path = typer.Option(None, "--json-out", help="Write the full report as JSON."),
) -> None:
    """Diff a scraper's output across two transports. Writes nothing to the DB.

    This is the cutover gate: a source moves to Firecrawl only after its
    payloads match the legacy transport on a sampled set.
    """
    import json as _json

    from etl.parity import compare, format_report

    try:
        report = asyncio.run(compare(scraper, limit=limit, legacy_transport=legacy,
                                     candidate_transport=candidate))
    except ValueError as exc:
        typer.echo(str(exc))
        raise typer.Exit(2) from exc

    typer.echo(format_report(report))
    if json_out is not None:
        json_out.write_text(
            _json.dumps(report.as_dict(), indent=2, ensure_ascii=False), encoding="utf-8"
        )
        typer.echo(f"\nfull report written to {json_out}")

    # 3 for a skip, so a sweep can tell "never comparable" from "regressed"
    # without either being mistaken for a clean pass.
    if report.not_comparable:
        raise typer.Exit(3)
    if not report.passed:
        raise typer.Exit(1)


@app.command()
def run(
    scraper: str,
    full_refresh: bool = typer.Option(
        False,
        "--full-refresh",
        help="bkmea_detail only: re-fetch every member with a detail page, "
        "bypassing the pre-fetch hash gate (founder knob for a periodic full pass).",
    ),
) -> None:
    """Run a scraper or maintenance job end-to-end."""
    cls = RUNNABLE.get(scraper)
    if cls is None:
        typer.echo(f"unknown scraper: {scraper}. Try `list`.")
        raise typer.Exit(1)
    kwargs: dict[str, Any] = {}
    if full_refresh:
        if scraper != "bkmea_detail":
            typer.echo("--full-refresh only applies to bkmea_detail.")
            raise typer.Exit(1)
        kwargs["full_refresh"] = True
    result = asyncio.run(cls(**kwargs).run())
    typer.echo(str(result))


@app.command("verify-evidence")
def verify_evidence_cmd(
    limit: int = typer.Option(500, help="Check at most N due documents."),
    scraper: str = typer.Option(None, help="Restrict to one source's documents."),
    interval_hours: int = typer.Option(
        None,
        help="Re-check documents older than this many hours. 0 means everything is due.",
    ),
    max_credits: int = typer.Option(
        None,
        "--max-credits",
        help="Stop before the run spends more than this many Firecrawl credits. "
        "Default: FIRECRAWL_MAX_CREDITS_PER_RUN; 0 means no ceiling.",
    ),
) -> None:
    """Re-check recorded citations for liveness and excerpt drift.

    Never retires a citation on a single failure: timeouts, blocks and 5xx leave
    the last known good state and back the retry off.
    """
    from etl.evidence.verifier import DEFAULT_INTERVAL_HOURS, VerifyEvidenceJob

    job = VerifyEvidenceJob(
        limit=limit,
        scraper_code=scraper,
        # `is None`, not `or`: 0 is a real instruction ("everything is due"),
        # and swallowing it would make a first-run smoke check 2 documents and
        # a vacuous green exit.
        interval_hours=interval_hours if interval_hours is not None else DEFAULT_INTERVAL_HOURS,
        max_credits=max_credits,
    )
    result = asyncio.run(job.run())
    typer.echo(str(result))


@app.command("refresh-monitors")
def refresh_monitors_cmd(
    dry_run: bool = typer.Option(
        False, help="List the targets that would be registered, and register nothing."
    ),
) -> None:
    """Reconcile Firecrawl monitors with the index pages sources declare.

    Idempotent: a target that already has a monitor id is left alone, so this is
    safe to run on every deploy.
    """
    from etl.evidence.monitors import refresh_monitors

    result = asyncio.run(refresh_monitors(dry_run=dry_run))
    typer.echo(str(result))


@app.command("process-webhooks")
def process_webhooks_cmd(
    limit: int = typer.Option(100, help="Process at most N pending deliveries."),
) -> None:
    """Drain the Firecrawl webhook inbox.

    The API route only records deliveries — it has ten seconds before Firecrawl
    retries — so this is where a change notification is acted on, by moving the
    affected documents to the front of the verify queue.
    """
    from etl.evidence.webhook_inbox import process_pending

    typer.echo(str(process_pending(limit=limit)))


@app.command("enqueue-due-schedules")
def enqueue_due_schedules_cmd(
    limit: int = typer.Option(None, help="Only enqueue the first N due schedules."),
) -> None:
    """Create queue jobs for due admin scraper timers."""
    from etl.jobs.scraper_queue import enqueue_due_schedules

    result = enqueue_due_schedules(limit=limit)
    typer.echo(str(result))


@app.command("run-queue")
def run_queue_cmd(
    limit: int = typer.Option(1, help="Run at most N pending scraper jobs."),
) -> None:
    """Run pending admin-requested scraper jobs."""
    from etl.jobs.scraper_queue import run_queue

    result = run_queue(limit=limit)
    typer.echo(str(result))


@app.command("btma_spinning")
def btma_spinning_cmd(
    dry_run: bool = typer.Option(False, "--dry-run", help="Print cross-source match report without writing to DB."),
) -> None:
    """BTMA spinning-mills register ingestion (Spec 16)."""
    result = asyncio.run(BtmaSpinningScraper(dry_run=dry_run).run())
    typer.echo(str(result))


@app.command("rsc_documents")
def rsc_documents_cmd(
    supplier_slug: str = typer.Option(None, "--supplier-slug", help="Mirror docs for just this supplier slug."),
    limit: int = typer.Option(None, "--limit", help="Mirror docs for only the first N suppliers (debug)."),
) -> None:
    """Mirror per-factory RSC compliance documents to Bunny CDN (Spec 13)."""
    result = asyncio.run(RscDocumentsScraper(supplier_slug=supplier_slug, limit=limit).run())
    typer.echo(str(result))


@app.command()
def sbi(
    limit: int = typer.Option(None, help="Score only the first N suppliers (debug)."),
    force: bool = typer.Option(False, help="Recompute & upsert even when inputs_hash matches."),
    batch_size: int = typer.Option(500, help="Upsert batch size."),
) -> None:
    """Backfill / recompute SBI scores across `public.suppliers` (Spec 11)."""
    from etl.scoring.runner import run as run_sbi

    result = run_sbi(limit=limit, force=force, batch_size=batch_size)
    typer.echo(str(result))


@app.command("normalize-addresses")
def normalize_addresses_cmd(
    limit: int = typer.Option(None, help="Process only the first N candidate suppliers (debug)."),
) -> None:
    """F5a — derive `city` / `district` from EPB / GOTS / address_raw."""
    from etl.jobs.address_norm import run as run_norm

    result = run_norm(limit=limit)
    typer.echo(str(result))


@app.command("geocode-addresses")
def geocode_addresses_cmd(
    limit: int = typer.Option(None, help="Geocode only the first N pending addresses (quota control)."),
    dry_run: bool = typer.Option(False, "--dry-run", help="Report pending count without calling Barikoi."),
) -> None:
    """Barikoi Rupantor geocode backfill into `public.address_geocodes`.

    Populates the coordinate cache the profile locations map reads.
    Rupantor bills 2 API calls per address — use --limit to stay in quota.
    """
    from etl.jobs.barikoi_geocode import run as run_geocode

    result = run_geocode(limit=limit, dry_run=dry_run)
    typer.echo(str(result))


@app.command("merge-contacts")
def merge_contacts_cmd(
    limit: int = typer.Option(None, help="Process only the first N candidate suppliers (debug)."),
) -> None:
    """F5b — cross-source contact merge (tier-ordered COALESCE fill)."""
    from etl.jobs.contact_merge import run as run_merge

    result = run_merge(limit=limit)
    typer.echo(str(result))


@app.command("upgrade-addresses")
def upgrade_addresses_cmd(
    max_len: int = typer.Option(60, help="Only consider suppliers with address_raw shorter than this."),
    limit: int = typer.Option(None, help="Process only the first N candidate suppliers (debug)."),
    dry_run: bool = typer.Option(False, "--dry-run", help="Report candidates without writing."),
) -> None:
    """F11 — upgrade `address_raw` when a strictly-longer same-source
    superstring value exists in the supplier's own source_records.
    First authorised relaxation of Hard Rule #5 (fill-only); scoped to
    `suppliers.address_raw` only and guarded by substring containment."""
    from etl.jobs.address_upgrade import run_bulk

    result = run_bulk(max_len=max_len, limit=limit, dry_run=dry_run)
    typer.echo(str(result))


@app.command("rsc-crosslink")
def rsc_crosslink_cmd() -> None:
    """F6 — backfill district/city for RSC-only suppliers via name-stripped
    cross-link against suppliers already known by Tier 1-3 sources."""
    from etl.jobs.rsc_crosslink import run as run_xlink

    result = run_xlink()
    typer.echo(str(result))


@app.command()
def digest(period: str) -> None:
    """Generate monthly newsletter + blog drafts from rsc_industry_metrics.

    PERIOD: 'YYYY-MM' (e.g. '2026-03') or 'latest' to use the most recent month.
    """
    from datetime import date as _date

    from etl.content.monthly_digest import generate, latest_period

    if period == "latest":
        p = latest_period()
        if p is None:
            typer.echo("no metrics ingested yet — run `rsc_reports` and/or `rsc_updates` first")
            raise typer.Exit(1)
    else:
        try:
            y, m = period.split("-")
            p = _date(int(y), int(m), 1)
        except Exception as exc:  # noqa: BLE001
            typer.echo(f"invalid period {period!r}: expected YYYY-MM or 'latest' ({exc})")
            raise typer.Exit(1) from exc

    result = generate(p)
    if not result:
        typer.echo(f"no metrics found for {p.isoformat()} — nothing generated")
        raise typer.Exit(1)
    typer.echo(f"generated drafts for {p.isoformat()}: {result}")


if __name__ == "__main__":
    app()
