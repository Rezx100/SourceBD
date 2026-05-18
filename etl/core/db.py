"""Postgres connection pool + helpers. Uses SUPABASE_DB_URL (direct, port 5432)."""
from __future__ import annotations

from contextlib import contextmanager
from functools import lru_cache
from typing import Iterator

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from etl.core.config import settings
from etl.core.logging import get_logger

log = get_logger("etl.db")


class _DB:
    def __init__(self) -> None:
        self._pool: ConnectionPool | None = None

    def _ensure(self) -> ConnectionPool:
        if self._pool is None:
            if not settings.supabase_db_url:
                raise RuntimeError(
                    "SUPABASE_DB_URL is not set. Add it to .env "
                    "(Supabase Dashboard -> Settings -> Database -> Connection string -> URI)."
                )
            def _configure(conn: psycopg.Connection) -> None:
                # Supabase transaction pooler (port 6543) does not support
                # server-side prepared statements; disable them.
                conn.prepare_threshold = None

            self._pool = ConnectionPool(
                conninfo=settings.supabase_db_url,
                min_size=1,
                max_size=5,
                kwargs={"row_factory": dict_row, "autocommit": False},
                configure=_configure,
                open=True,
            )
        return self._pool

    @contextmanager
    def conn(self) -> Iterator[psycopg.Connection]:
        pool = self._ensure()
        with pool.connection() as c:
            yield c


db = _DB()


@lru_cache(maxsize=64)
def get_source_id(code: str) -> str:
    with db.conn() as c, c.cursor() as cur:
        cur.execute("select id from public.sources where code = %s", (code,))
        row = cur.fetchone()
        if not row:
            raise RuntimeError(f"unknown source code: {code}")
        return str(row["id"])
