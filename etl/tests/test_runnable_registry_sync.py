"""The three places a runnable code must be declared, kept in agreement.

A code can be dispatched from the admin console only if all three agree:
`etl/scrapers/registry.py` (what the worker can construct),
`lib/admin/etl-scrapers.ts` (what the UI offers), and
`admin_etl_allowed_scraper_codes()` in SQL (what the queue's CHECK permits).

Any one of them being behind fails in a way that is easy to misread. Missing from
SQL and the button returns a constraint violation an operator cannot act on.
Missing from the catalog and the job is runnable but invisible. Missing from the
registry and the queue accepts the job and then fails it as an unknown scraper.
So they are compared here rather than by hand at review time.
"""
from __future__ import annotations

import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
TS_CATALOG = REPO / "lib" / "admin" / "etl-scrapers.ts"
MIGRATIONS = REPO / "supabase" / "migrations"
FUNC_DEF = "create or replace function public.admin_etl_allowed_scraper_codes"


def _ts_codes() -> set[str]:
    text = TS_CATALOG.read_text(encoding="utf-8")
    # Only the catalog entries, not the transport map, which is asserted against
    # the catalog on the TypeScript side.
    body = text.split("export const SCRAPER_CATALOG", 1)[1].split(
        "] as const satisfies", 1
    )[0]
    return set(re.findall(r"^\s*code:\s*\"([a-z0-9_]+)\"", body, re.MULTILINE))


def _sql_codes() -> set[str]:
    # Later migrations re-define the allow-list (0086 renamed bgmea_pdf, 0090
    # added sbi_recompute), and the LAST create-or-replace is what production
    # enforces. Reading one historical migration file goes stale the day a
    # later migration touches the function — zero-padded NNNN prefixes sort
    # lexicographically.
    definers = sorted(
        p for p in MIGRATIONS.glob("*.sql") if FUNC_DEF in p.read_text(encoding="utf-8")
    )
    assert definers, "no migration defines admin_etl_allowed_scraper_codes()"
    body = definers[-1].read_text(encoding="utf-8").split(FUNC_DEF, 1)[1].split("$$;", 1)[0]
    return set(re.findall(r"'([a-z0-9_]+)'", body))


def test_python_typescript_and_sql_agree_on_what_can_be_run():
    from etl.scrapers.registry import RUNNABLE

    python_codes = set(RUNNABLE)
    ts_codes = _ts_codes()
    sql_codes = _sql_codes()

    assert python_codes - ts_codes == set(), "runnable in Python but hidden from the admin UI"
    assert ts_codes - python_codes == set(), "offered by the admin UI but not constructible"
    assert python_codes - sql_codes == set(), "not in the SQL allow-list; the queue will reject it"
    assert sql_codes - python_codes == set(), "allowed by SQL but no longer implemented"


def test_the_maintenance_jobs_are_present_in_all_three():
    """These are the codes this system adds, and the ones most likely to be missed."""
    from etl.scrapers.registry import JOBS

    ts_codes = _ts_codes()
    sql_codes = _sql_codes()
    for code in ("verify_evidence", "refresh_monitors", "sbi_recompute"):
        assert code in JOBS
        assert code in ts_codes
        assert code in sql_codes


def test_maintenance_jobs_are_not_listed_as_data_sources():
    """Keeps "every source declares a transport and emits evidence" assertable.

    Folding the jobs into `SCRAPERS` would make that registry-wide check
    meaningless, since a job legitimately has neither.
    """
    from etl.scrapers.registry import JOBS, SCRAPERS

    assert set(JOBS) & set(SCRAPERS) == set()


def test_every_job_exposes_what_the_queue_runner_calls():
    """The runner sets a progress callback, runs, then reads `last_run_id`."""
    from etl.scrapers.registry import JOBS

    for code, cls in JOBS.items():
        job = cls()
        job.progress_callback = lambda _event: None
        assert callable(getattr(job, "run", None)), code
        assert hasattr(job, "last_run_id"), code
        assert job.code == code
