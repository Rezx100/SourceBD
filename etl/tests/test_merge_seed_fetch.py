"""Seeded-merge fetch widening (founder decision E, 4 Aug 2026).

`--pair` mode loads the named slugs even when UNPUBLISHED — the 6
slug-blocked identity-backfill pairs each have an unpublished holder row the
published winner must absorb before the backfill can take the slug. The
audit/detector universe itself must stay published-only.
"""
from __future__ import annotations

from ops.audit_cross_register_coverage import _fetch
from etl.tests.conftest import FakeCursor


def test_fetch_default_stays_published_only() -> None:
    cur = FakeCursor()
    _fetch(cur)
    assert not any("s.slug = any" in sql for sql, _ in cur.executed)


def test_fetch_widens_to_named_unpublished_slugs() -> None:
    cur = FakeCursor()
    _fetch(cur, extra_slugs=("paramount-textile-ltd",))
    widened = [(sql, p) for sql, p in cur.executed if "s.slug = any" in sql]
    assert len(widened) == 1
    # The named slugs go in as a parameter, never string-interpolated.
    assert widened[0][1] == (["paramount-textile-ltd"],)
