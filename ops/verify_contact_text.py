"""Population guard for the contact stripper (REZ-C, audit cycle 4).

Reads, read-only, every published record's filed address texts, principal
products and gated contact columns, and runs `ops/check_contact_text.mjs`
over them: the real `withoutContactDetails` from `lib/contact-text.ts`, then a
check that no gated phone, e-mail, website or contact name — and nothing
e-mail-, URL-, mobile- or named-contact-shaped — survives it on any text.

    python ops/verify_contact_text.py

Exit 0 when clean, 1 with every offending text printed — which prints the
contact detail it leaks, so run it locally and do not paste the failure output
anywhere public. The rows go to a temp file that is deleted afterwards.
Needs Node 22.18+ (imports the .ts module directly).
Nothing is written to the database (AGENTS 15).
"""
import json
import os
import pathlib
import subprocess
import sys
import tempfile

import psycopg
from psycopg.rows import dict_row

REPO = pathlib.Path(__file__).resolve().parents[1]

SQL = """
with addr as (
  select va.supplier_id, array_agg(va.address) as addresses
    from public.v_supplier_addresses va
   where va.address is not null
   group by va.supplier_id
),
-- The record's buildings (unpublished children, `facility_of`): the Facilities
-- section prints their addresses under the published record, and
-- `v_supplier_addresses` covers published records only.
bld as (
  select f.facility_of as supplier_id, array_agg(vd.address) as addresses
    from public.suppliers f
    join public.v_supplier_addresses_direct vd on vd.supplier_id = f.id
   where f.facility_of is not null and vd.address is not null
   group by f.facility_of
)
select s.slug, s.address_raw, s.principal_products, s.email_primary, s.phones, s.website, s.contact_name,
       coalesce(addr.addresses, '{}') as addresses,
       coalesce(bld.addresses, '{}') as building_addresses
  from public.suppliers s
  left join addr on addr.supplier_id = s.id
  left join bld on bld.supplier_id = s.id
 where s.is_published
"""


def _dsn() -> str:
    """`SUPABASE_DB_URL` from the environment, else this checkout's `.env`,
    else the main checkout's — `.env` is git-ignored, so a worktree has none."""
    if os.environ.get("SUPABASE_DB_URL"):
        return os.environ["SUPABASE_DB_URL"]
    common = subprocess.run(
        ["git", "rev-parse", "--path-format=absolute", "--git-common-dir"],
        cwd=REPO, capture_output=True, text=True, check=True,
    ).stdout.strip()
    for env in (REPO / ".env", pathlib.Path(common).parent / ".env"):
        if env.exists():
            for line in env.read_text(encoding="utf-8", errors="replace").splitlines():
                if line.startswith("SUPABASE_DB_URL="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("SUPABASE_DB_URL is not set and no .env holds it")


with psycopg.connect(_dsn(), row_factory=dict_row, connect_timeout=30) as conn:
    conn.read_only = True
    with conn.cursor() as cur:
        cur.execute("set statement_timeout = '900s'")
        cur.execute(SQL)
        rows = cur.fetchall()
    conn.rollback()

fd, path = tempfile.mkstemp(suffix=".json")
try:
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(rows, f, default=str, ensure_ascii=False)
    sys.exit(subprocess.run(["node", str(REPO / "ops" / "check_contact_text.mjs"), path]).returncode)
finally:
    os.unlink(path)
