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

import typer

from etl.core.db import db
from etl.core.logging import get_logger
from etl.scrapers.bgmea_pdf import BgmeaPdfScraper
from etl.scrapers.bgmea_web import BgmeaWebScraper
from etl.scrapers.bkmea_web import BkmeaScraper
from etl.scrapers.bkmea_detail import BkmeaDetailScraper
from etl.scrapers.bgapmea_web import BgapmeaScraper
from etl.scrapers.epb_web import EpbScraper
from etl.scrapers.rsc import RscScraper
from etl.scrapers.rsc_reports import RscReportsScraper
from etl.scrapers.rsc_updates import RscUpdatesScraper
from etl.scrapers.rsc_documents import RscDocumentsScraper
from etl.scrapers.uflpa import UflpaScraper
from etl.scrapers.cbp_wro import CbpWroScraper
from etl.scrapers.ofac_sdn import OfacSdnScraper
from etl.scrapers.uk_ofsi import UkOfsiScraper
from etl.scrapers.eu_sanctions import EuSanctionsScraper
from etl.scrapers.ilab_tvpra import IlabTvpraScraper
from etl.scrapers.gots import GotsScraper
from etl.scrapers.sa8000 import Sa8000Scraper
from etl.scrapers.oeko_tex import OekoTexScraper
from etl.scrapers.btma_spinning import BtmaSpinningScraper
from etl.scrapers.brand_disclosures import (
    BrandHmScraper,
    BrandInditexScraper,
    BrandPrimarkScraper,
    BrandAsosScraper,
    BrandMsScraper,
    BrandNextScraper,
)

app = typer.Typer(add_completion=False, help="SourceBD ETL")
log = get_logger("etl.cli")

SCRAPERS = {
    "bgmea_pdf": BgmeaPdfScraper,
    "bgmea_web": BgmeaWebScraper,
    "bkmea_web": BkmeaScraper,
    "bkmea_detail": BkmeaDetailScraper,
    "bgapmea_web": BgapmeaScraper,
    "epb_web": EpbScraper,
    "rsc": RscScraper,
    "rsc_reports": RscReportsScraper,
    "rsc_updates": RscUpdatesScraper,
    "rsc_documents": RscDocumentsScraper,
    "uflpa": UflpaScraper,
    "cbp_wro": CbpWroScraper,
    "ofac_sdn": OfacSdnScraper,
    "uk_ofsi": UkOfsiScraper,
    "eu_sanctions": EuSanctionsScraper,
    "ilab_tvpra": IlabTvpraScraper,
    "gots": GotsScraper,
    "sa8000": Sa8000Scraper,
    "oeko_tex": OekoTexScraper,
    "btma_spinning": BtmaSpinningScraper,
    "brand_hm": BrandHmScraper,
    "brand_inditex": BrandInditexScraper,
    "brand_primark": BrandPrimarkScraper,
    "brand_asos": BrandAsosScraper,
    "brand_ms": BrandMsScraper,
    "brand_next": BrandNextScraper,
}

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
        typer.echo(f"{code:15s}  source={cls.source_code}")


@app.command()
def run(scraper: str) -> None:
    """Run a scraper end-to-end."""
    cls = SCRAPERS.get(scraper)
    if cls is None:
        typer.echo(f"unknown scraper: {scraper}. Try `list`.")
        raise typer.Exit(1)
    result = asyncio.run(cls().run())
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


@app.command("merge-contacts")
def merge_contacts_cmd(
    limit: int = typer.Option(None, help="Process only the first N candidate suppliers (debug)."),
) -> None:
    """F5b — cross-source contact merge (tier-ordered COALESCE fill)."""
    from etl.jobs.contact_merge import run as run_merge

    result = run_merge(limit=limit)
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
