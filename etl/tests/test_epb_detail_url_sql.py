"""Pins for EPB exporter Open URL + HS-code RPC (migration 0103)."""

from __future__ import annotations

import os
from pathlib import Path

import pytest
from dotenv import load_dotenv

REPO = Path(__file__).resolve().parents[2]
load_dotenv(REPO / ".env")
MIGRATION = REPO / "supabase" / "migrations" / "0103_epb_detail_url_and_hscodes.sql"
CLI = REPO / "etl" / "cli.py"
SCRAPER = REPO / "etl" / "scrapers" / "epb_web.py"
QUEUE = REPO / "etl" / "jobs" / "scraper_queue.py"

FOREIGN_HOST_REFS = (
    ("az-apparels", "4821"),
    ("bsa-apparels", "4491"),
    ("deluxe-apparels", "2850"),
    ("kds-apparels", "3710"),
    ("mim-apparel", "1762"),
    ("univogue-garments-co-ltd-unit-2", "3084"),
)

HS_PROBE = [
    {
        "code": "6103",
        "description": "Men's or boys' suits",
        "source_url": "https://edb.epb.gov.bd/hscode-exporters/813",
    }
]
FOREIGN_HS_PROBE = [
    {
        "code": "9999",
        "description": "foreign-probe-4821",
        "source_url": "https://edb.epb.gov.bd/hscode-exporters/1",
    }
]


def _dsn() -> str | None:
    return os.environ.get("SUPABASE_DB_URL") or os.environ.get("DATABASE_URL")


def _statements(blob: str) -> list[str]:
    """Split 0103 into executable statements, keeping $$ function bodies."""
    out: list[str] = []
    buf: list[str] = []
    in_dollar = False
    for line in blob.splitlines(keepends=True):
        stripped = line.strip()
        if not in_dollar and (stripped.startswith("--") or stripped == ""):
            continue
        buf.append(line)
        if "$$" in line:
            # Opening or closing a dollar-quote. Functions use a single $$ pair
            # per create, closed by $$;
            if in_dollar and "$$;" in stripped:
                in_dollar = False
                out.append("".join(buf).strip())
                buf = []
                continue
            if not in_dollar:
                in_dollar = True
        if not in_dollar and stripped.endswith(";"):
            out.append("".join(buf).strip())
            buf = []
    if "".join(buf).strip():
        out.append("".join(buf).strip())
    return out


def test_0103_epb_open_url_is_the_stored_exporter_page() -> None:
    text = MIGRATION.read_text(encoding="utf-8")
    assert MIGRATION.is_file()
    assert "create or replace view public.v_supplier_registry_ids_direct" in text
    assert "epb_detail_url" in text
    assert "https://edb.epb.gov.bd/exporter/" in text
    assert "|| sr.source_ref ||" in text
    assert "'https://epb.gov.bd/'" not in text
    assert "create or replace function public.supplier_epb_hscodes" in text
    assert "s.is_published = true" in text
    assert "src.code = 'EPB'" in text
    assert "hscode-exporters/" in text
    assert r"hscode-exporters/[0-9]+" in text
    assert "|| btrim(elem->>'code')" not in text
    assert "like 'https://edb.epb.gov.bd/exporter/' || sr.source_ref || '/%'" in text
    assert "create or replace function public.buyer_supplier_profile" not in text
    assert "execute format" not in text.lower()
    assert "grant execute on function public.supplier_epb_hscodes(text) to anon, authenticated" in text
    assert "epb_record_is_foreign_to_host" in text
    assert "source_ref ~ '^[0-9]+$'" in text
    assert "with ordinality" in text
    for slug, ref in FOREIGN_HOST_REFS:
        assert f"('{slug}', '{ref}')" in text
    assert "and not public.epb_record_is_foreign_to_host(s.slug, sr.source_ref)" in text


def test_backfill_script_is_apply_gated_and_does_not_mint() -> None:
    path = REPO / "ops" / "backfill_epb_hscodes.py"
    text = path.read_text(encoding="utf-8")
    assert path.is_file()
    assert "--apply" in text
    assert "--expect-fingerprint" in text
    assert "should_write_hscodes" in text
    assert "parse_epb_hscodes" in text
    assert "insert into public.suppliers" not in text.lower()
    assert "epb_hscodes" in text
    assert "/rest/v1/source_records" in text
    assert "apply_via_rest" in text


def test_backfill_skips_empty_parse_and_requires_fingerprint() -> None:
    from ops.backfill_epb_hscodes import should_write_hscodes

    existing = [{"code": "6103", "source_url": "https://edb.epb.gov.bd/hscode-exporters/813"}]
    assert should_write_hscodes(existing, []) is False
    assert should_write_hscodes(None, []) is False
    assert should_write_hscodes(None, [{"code": "6103"}]) is True


def test_epb_web_default_is_attach_only_mint_is_opt_in() -> None:
    scraper = SCRAPER.read_text(encoding="utf-8")
    cli = CLI.read_text(encoding="utf-8")
    queue = QUEUE.read_text(encoding="utf-8")
    assert "existing_only: bool = True" in scraper
    assert '"--mint"' in cli
    assert "kwargs[\"existing_only\"] = False" in cli
    assert "scraper = scraper_cls()" in queue


def test_0103_statement_split_covers_helper_view_and_rpc() -> None:
    stmts = _statements(MIGRATION.read_text(encoding="utf-8"))
    joined = "\n".join(stmts)
    assert any("epb_record_is_foreign_to_host" in s and "create or replace function" in s.lower() for s in stmts)
    assert any("create or replace view public.v_supplier_registry_ids_direct" in s for s in stmts)
    assert any("create or replace function public.supplier_epb_hscodes" in s for s in stmts)
    assert "set search_path = public;" in joined


@pytest.fixture(scope="module")
def epb_0103_conn():
    dsn = _dsn()
    if not dsn:
        pytest.skip("SUPABASE_DB_URL not set")
    import psycopg
    from psycopg.rows import dict_row

    try:
        conn = psycopg.connect(
            dsn, autocommit=False, row_factory=dict_row, connect_timeout=10
        )
    except Exception as exc:  # noqa: BLE001 — live DB is optional in CI
        pytest.skip(f"Postgres unreachable: {exc}")
    try:
        with conn.cursor() as cur:
            for stmt in _statements(MIGRATION.read_text(encoding="utf-8")):
                cur.execute(stmt)
        yield conn
    finally:
        conn.rollback()
        conn.close()


def test_executed_0103_hides_homepage_and_foreign_extras(epb_0103_conn) -> None:
    with epb_0103_conn.cursor() as cur:
        for slug, ref in FOREIGN_HOST_REFS:
            cur.execute(
                "select public.epb_record_is_foreign_to_host(%s, %s) as flagged",
                (slug, ref),
            )
            assert cur.fetchone()["flagged"] is True, (slug, ref)
        cur.execute(
            "select public.epb_record_is_foreign_to_host('za-apparels', '4821') as flagged"
        )
        assert cur.fetchone()["flagged"] is False

        cur.execute(
            """
            select count(*)::int as n
              from public.v_supplier_registry_ids_direct v
             where v.source_code = 'EPB'
               and v.source_url = 'https://epb.gov.bd/'
            """
        )
        assert cur.fetchone()["n"] == 0

        cur.execute(
            """
            select count(*)::int as homepage,
                   count(*) filter (
                     where v.source_url like 'https://edb.epb.gov.bd/exporter/%'
                   )::int as exporter_page,
                   count(*)::int as epb_pills
              from public.v_supplier_registry_ids_direct v
             where v.source_code = 'EPB'
            """
        )
        row = cur.fetchone()
        assert row["homepage"] == 0
        assert row["exporter_page"] == row["epb_pills"]
        assert row["epb_pills"] > 0

        cur.execute(
            """
            select v.value, v.source_url
              from public.v_supplier_registry_ids_direct v
              join public.suppliers s on s.id = v.supplier_id
              join public.source_records sr
                on sr.supplier_id = s.id
               and sr.source_ref = '4821'
              join public.sources src
                on src.id = sr.source_id and src.code = 'EPB'
             where s.slug = 'az-apparels'
               and v.source_code = 'EPB'
               and v.value = sr.fields->>'epb_reg_no'
            """
        )
        assert cur.fetchall() == []


def test_executed_0103_rpc_published_only_and_skips_foreign_host(epb_0103_conn) -> None:
    import json

    with epb_0103_conn.cursor() as cur:
        cur.execute(
            """
            select s.slug, sr.id
              from public.source_records sr
              join public.sources src on src.id = sr.source_id and src.code = 'EPB'
              join public.suppliers s on s.id = sr.supplier_id
             where s.is_published = true
               and sr.status = 'active'
               and s.slug <> 'az-apparels'
               and not public.epb_record_is_foreign_to_host(s.slug, sr.source_ref)
             order by sr.source_ref
             limit 1
            """
        )
        host = cur.fetchone()
        assert host is not None
        cur.execute(
            """
            update public.source_records
               set fields = jsonb_set(fields, '{epb_hscodes}', %s::jsonb, true)
             where id = %s
            """,
            (json.dumps(HS_PROBE), host["id"]),
        )
        cur.execute(
            "select public.supplier_epb_hscodes(%s) as rows",
            (host["slug"],),
        )
        rows = cur.fetchone()["rows"]
        if isinstance(rows, str):
            rows = json.loads(rows)
        assert isinstance(rows, list)
        assert rows[0]["code"] == "6103"
        assert rows[0]["source_url"] == "https://edb.epb.gov.bd/hscode-exporters/813"

        cur.execute(
            """
            select sr.id
              from public.source_records sr
              join public.sources src on src.id = sr.source_id and src.code = 'EPB'
              join public.suppliers s on s.id = sr.supplier_id
             where s.slug = 'az-apparels'
               and sr.source_ref = '4821'
               and sr.status = 'active'
            """
        )
        foreign = cur.fetchone()
        assert foreign is not None
        cur.execute(
            """
            update public.source_records
               set fields = jsonb_set(fields, '{epb_hscodes}', %s::jsonb, true)
             where id = %s
            """,
            (json.dumps(FOREIGN_HS_PROBE), foreign["id"]),
        )
        cur.execute("select public.supplier_epb_hscodes('az-apparels') as rows")
        az_rows = cur.fetchone()["rows"]
        if isinstance(az_rows, str):
            az_rows = json.loads(az_rows)
        assert all(r.get("code") != "9999" for r in (az_rows or []))

        cur.execute(
            "select public.supplier_epb_hscodes('univogue-garments-co-ltd-unit-2') as rows"
        )
        unpublished = cur.fetchone()["rows"]
        if isinstance(unpublished, str):
            unpublished = json.loads(unpublished)
        assert unpublished == []
