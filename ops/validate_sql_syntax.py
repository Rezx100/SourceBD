"""Offline PostgreSQL syntax validation for migration files.

Uses libpg_query (via `pglast`) — the actual PostgreSQL parser — so a migration
can be checked without a database connection and without touching production.

    python ops/validate_sql_syntax.py supabase/migrations/0084_evidence_provenance.sql
    python ops/validate_sql_syntax.py            # validates every migration

Note: this validates SYNTAX only. It cannot catch a reference to a table or
column that does not exist; that still needs a real apply.
"""
from __future__ import annotations

import sys
from pathlib import Path

try:
    import pglast
    from pglast import parse_sql
    from pglast.parser import ParseError
except ImportError:  # pragma: no cover
    print("pglast is not installed. Install with: python -m pip install pglast")
    raise SystemExit(2)

MIGRATIONS = Path(__file__).parent.parent / "supabase" / "migrations"


def validate(path: Path) -> tuple[bool, str]:
    sql = path.read_text(encoding="utf-8")
    try:
        statements = parse_sql(sql)
    except ParseError as exc:
        line = sql[: getattr(exc, "location", 0) or 0].count("\n") + 1
        return False, f"line ~{line}: {exc}"
    except Exception as exc:  # noqa: BLE001
        return False, f"{type(exc).__name__}: {exc}"
    return True, f"{len(statements)} statements"


def main(argv: list[str]) -> int:
    if argv:
        targets = [Path(a) for a in argv]
    else:
        targets = sorted(MIGRATIONS.glob("*.sql"))

    failures = 0
    for path in targets:
        if not path.exists():
            print(f"MISSING  {path}")
            failures += 1
            continue
        ok, detail = validate(path)
        if ok:
            print(f"OK       {path.name}  ({detail})")
        else:
            print(f"FAIL     {path.name}  {detail}")
            failures += 1

    print(f"\nlibpg_query {pglast.__version__}: {len(targets) - failures}/{len(targets)} valid")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
