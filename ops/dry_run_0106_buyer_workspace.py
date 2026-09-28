"""Dry run of migration 0106 (the buyer workspace) in ONE transaction that is always rolled back.

1. DRIFT. 0106 replaces rfq_create, rfq_get and settings_get with the repo's
   last definitions (0028, 0028, 0059) plus additions. 0105 found production's
   buyer_supplier_profile AHEAD of the repo; if any of these three has drifted
   the same way, the replace would silently delete what production has. So the
   live `prosrc` of each is compared with the repo body first, and on any
   difference the script prints the diff and STOPS without applying anything.
2. APPLY the file TWICE in the transaction: the second run proves it is
   re-runnable against the real schema, not just CI's empty one.
3. SHAPE: every new function is SECURITY DEFINER with search_path=public and
   `anon` holds EXECUTE on none of them; both new tables have RLS on, one
   owner policy, and nothing granted to `anon`; the bucket and its four
   owner-folder policies exist, with no public SELECT policy.
4. BEHAVIOUR as a real buyer (`set local role authenticated`, the buyer's uid
   in the JWT claim), each step in its own rolled-back savepoint: workspace +
   inquiry round-trip, a product round-trip, another buyer cannot see or
   delete it, a draft round-trip, and rfq_create storing message / questions /
   product_id that rfq_get returns.

Then it rolls back. Nothing is committed, and nothing here is `--apply`
(AGENTS rule 15). Reads `SUPABASE_DB_URL` from `.env`.

    python ops/dry_run_0106_buyer_workspace.py

The plan and the command to apply: `ops/plans/0106-dry-run.md`.
"""
import difflib
import hashlib
import json
import pathlib
import re
import sys
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row

REPO = pathlib.Path("E:/SourceBD")
MIGS = REPO / "supabase" / "migrations"
MIG = MIGS / "0106_buyer_products_rfq_message_workspace.sql"
# The function 0106 replaces -> the migration holding the repo's last definition before 0106.
REPLACED = {
    "rfq_create": "0028_rfqs.sql",
    "rfq_get": "0028_rfqs.sql",
    "settings_get": "0059_profile_avatars.sql",
}
NEW_FUNCTIONS = [
    "settings_update_workspace", "settings_update_inquiry",
    "buyer_product_upsert", "buyer_product_list", "buyer_product_get",
    "buyer_product_delete", "buyer_product_set_status",
    "rfq_draft_save", "rfq_draft_list", "rfq_draft_get", "rfq_draft_delete",
    "_input_text", "_input_number", "_input_strings", "_input_rows",
]

env = (REPO / ".env").read_text(encoding="utf-8", errors="replace")
dsn = next(
    line.split("=", 1)[1].strip().strip('"').strip("'")
    for line in env.splitlines()
    if line.startswith("SUPABASE_DB_URL=")
)


def norm(src: str) -> str:
    """Line endings and trailing blanks only; every other byte must match."""
    return "\n".join(line.rstrip() for line in src.replace("\r\n", "\n").split("\n")).strip()


def repo_body(name: str, file: str) -> str:
    """The text between the dollar quotes of `create or replace function public.<name>(` in `file`."""
    sql = (MIGS / file).read_text(encoding="utf-8").replace("\r\n", "\n")
    m = re.search(
        r"create or replace function public\." + name + r"\(.*?\bas \$\$(.*?)\$\$;",
        sql,
        flags=re.S | re.I,
    )
    assert m, f"{file} does not define {name}"
    return norm(m.group(1))


raw = MIG.read_bytes()
print("file          : " + MIG.relative_to(REPO).as_posix())
print("bytes         : %d" % len(raw))
print("line endings  : " + ("CRLF" if b"\r\n" in raw else "LF"))
print("sha256        : " + hashlib.sha256(raw).hexdigest())
print()

conn = psycopg.connect(dsn, autocommit=False, row_factory=dict_row, connect_timeout=30)
cur = conn.cursor()


def show(label, sql, args=()):
    cur.execute(sql, args)
    rows = cur.fetchall()
    print(label + ":")
    for r in rows:
        print("   ", dict(r))
    if not rows:
        print("    (no rows)")
    print()
    return rows


@contextmanager
def as_user(uid: str):
    """A rolled-back savepoint in which the session is `authenticated` with `uid` in the claim."""
    with conn.transaction(force_rollback=True):
        cur.execute("select set_config('request.jwt.claims', %s, true)", (json.dumps({"sub": uid, "role": "authenticated"}),))
        cur.execute("select set_config('request.jwt.claim.sub', %s, true)", (uid,))
        cur.execute("set local role authenticated")
        cur.execute("select auth.uid()::text as uid")
        assert cur.fetchone()["uid"] == uid, "auth.uid() did not take the claim"
        yield


def one(sql, args=()):
    cur.execute(sql, args)
    return cur.fetchone()


def refused(label, sql, args=()):
    """Run `sql` expecting a raise; print the message. A success is a failure of the dry run."""
    try:
        with conn.transaction(force_rollback=True):
            cur.execute(sql, args)
    except psycopg.Error as e:
        print(f"    refused as expected -- {label}: {e.diag.message_primary}")
        return
    raise SystemExit(f"NOT REFUSED: {label}")


try:
    print("=== 1. DRIFT: live body vs the repo's, for each function 0106 replaces ===")
    drifted = False
    for name, file in REPLACED.items():
        live = one(
            "select p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace "
            "where n.nspname = 'public' and p.proname = %s",
            (name,),
        )
        repo = repo_body(name, file)
        live_src = norm(live["prosrc"] if live else "")
        if live_src == repo:
            print(f"    {name:14s} same as {file}")
        else:
            drifted = True
            print(f"    {name:14s} DIFFERS from {file}:")
            for line in difflib.unified_diff(repo.splitlines(), live_src.splitlines(), "repo", "live", lineterm="", n=1):
                print("      " + line)
    print()
    if drifted:
        print("STOP: production is ahead of the repo for a function 0106 replaces.")
        print("Carry the live-only lines into 0106's definition, then re-run this script.")
        sys.exit(1)

    print("=== BEFORE ===")
    show(
        "0106 objects already present (expect none)",
        "select 'table' as kind, relname as name from pg_class where relnamespace = 'public'::regnamespace "
        "  and relname in ('buyer_products', 'rfq_drafts') "
        "union all select 'column', table_name || '.' || column_name from information_schema.columns "
        "  where table_schema = 'public' and ((table_name = 'rfqs' and column_name in ('message', 'questions', 'product_id')) "
        "    or (table_name = 'buyer_settings' and column_name in ('company_name', 'inquiry_questions'))) "
        "union all select 'bucket', id from storage.buckets where id = 'product-media'",
    )
    show("buyer_settings rows", "select count(*)::int as n from public.buyer_settings")

    print("=== 2. APPLYING 0106 TWICE (this transaction only) ===")
    text = MIG.read_text(encoding="utf-8")
    cur.execute(text)
    print("first apply  : without error")
    cur.execute(text)
    print("second apply : without error (re-runnable)")
    print()

    print("=== 3. SHAPE ===")
    show(
        "functions: definer / search_path (every row must be True, search_path=public)",
        "select p.proname, p.prosecdef as definer, array_to_string(p.proconfig, '|') as config "
        "from pg_proc p join pg_namespace n on n.oid = p.pronamespace "
        "where n.nspname = 'public' and p.proname = any(%s) and p.proname not like '\\_input%%' order by 1",
        (NEW_FUNCTIONS + list(REPLACED),),
    )
    rows = show(
        "EXECUTE held by anon on a new function (must be none)",
        "select routine_name from information_schema.role_routine_grants "
        "where routine_schema = 'public' and grantee = 'anon' and routine_name = any(%s) order by 1",
        (NEW_FUNCTIONS,),
    )
    assert not rows, "anon holds EXECUTE on a 0106 function"
    rows = show(
        "EXECUTE held by authenticated on an _input helper (must be none)",
        "select routine_name from information_schema.role_routine_grants "
        "where routine_schema = 'public' and grantee = 'authenticated' and routine_name like '\\_input%%'",
    )
    assert not rows, "authenticated holds EXECUTE on an _input helper"
    show(
        "RLS and policies on the new tables",
        "select c.relname, c.relrowsecurity as rls, "
        "  (select string_agg(polname, ',') from pg_policy where polrelid = c.oid) as policies "
        "from pg_class c where c.relnamespace = 'public'::regnamespace and c.relname in ('buyer_products', 'rfq_drafts')",
    )
    rows = show(
        "table privileges held by anon on the new tables (must be none)",
        "select table_name, privilege_type from information_schema.role_table_grants "
        "where table_schema = 'public' and grantee = 'anon' and table_name in ('buyer_products', 'rfq_drafts')",
    )
    assert not rows, "anon holds a privilege on a 0106 table"
    rows = show(
        "write privileges held by authenticated on the new tables (must be none: writes go through the functions)",
        "select table_name, privilege_type from information_schema.role_table_grants "
        "where table_schema = 'public' and grantee = 'authenticated' and table_name in ('buyer_products', 'rfq_drafts') "
        "and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')",
    )
    assert not rows, "authenticated can write a 0106 table directly, around the functions' checks"
    show("bucket", "select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'product-media'")
    show(
        "storage policies for product-media (four, owner-folder; no public select)",
        "select policyname, cmd, roles::text from pg_policies "
        "where schemaname = 'storage' and tablename = 'objects' and policyname like 'pol_product_media%%' order by 1",
    )
    show("buyer_settings rows (unchanged)", "select count(*)::int as n from public.buyer_settings")

    print("=== 4. BEHAVIOUR (as authenticated, each step rolled back) ===")
    cur.execute("select id from public.profiles where role::text = 'buyer' order by id limit 2")
    buyers = [str(r["id"]) for r in cur.fetchall()]
    assert len(buyers) == 2, "need two buyer profiles for the ownership checks"
    supplier = one(
        "select id::text from public.suppliers where is_published and not is_sanctioned order by id limit 1"
    )["id"]
    me, other = buyers

    with as_user(me):
        cur.execute(
            "select public.settings_update_workspace(%s::jsonb)",
            (json.dumps({"company_name": "  Dry Run Ltd  ", "company_type": "brand", "website": "https://dry.example"}),),
        )
        cur.execute(
            "select public.settings_update_inquiry(%s::jsonb)",
            (json.dumps({"questions": ["What is your MOQ?", "  ", "Lead time?"], "email_template": "Hello"}),),
        )
        got = one("select public.settings_get() as s")["s"]
        print("    settings_get().workspace :", got["workspace"])
        print("    settings_get().inquiry   :", got["inquiry"])
        assert got["workspace"]["company_name"] == "Dry Run Ltd"
        assert got["inquiry"]["questions"] == ["What is your MOQ?", "Lead time?"]
        assert "notifications" in got and "avatar_url" in got, "settings_get lost a key it returned before"
        refused("website without a scheme", "select public.settings_update_workspace('{\"website\": \"dry.example\"}')")
        refused("company_type outside the list", "select public.settings_update_workspace('{\"company_type\": \"x\"}')")

        pid = one(
            "select public.buyer_product_upsert(%s::jsonb)::text as id",
            (json.dumps({
                "name": "Dry run tee", "price_usd": "4.20", "tags": ["cotton", " "],
                "media": [{"url": "https://x.example/a.png", "kind": "image", "extra": 1}],
                "variants": {"options": [{"name": "Size", "values": ["S", "M"]}], "rows": [{"Size": "S"}]},
                "size_chart": [{"code": "A", "base": 52}],
            }),),
        )["id"]
        cur.execute("select public.buyer_product_upsert(%s::jsonb)", (json.dumps({"id": pid, "moq": 500}),))
        prod = one("select public.buyer_product_get(%s::uuid) as p", (pid,))["p"]
        print("    buyer_product_get        :", {k: prod[k] for k in ("name", "price_usd", "moq", "tags", "media", "status")})
        assert prod["name"] == "Dry run tee" and prod["moq"] == 500 and prod["tags"] == ["cotton"]
        assert prod["media"] == [{"url": "https://x.example/a.png", "kind": "image"}], "media item not reduced to {url, kind}"
        assert "owner_id" not in prod
        lst = one("select public.buyer_product_list() as l")["l"]
        print("    buyer_product_list[0]    :", lst[0])
        assert lst[0]["id"] == pid and lst[0]["media_count"] == 1 and lst[0]["first_image"] == "https://x.example/a.png"
        cur.execute("select public.buyer_product_set_status(%s::uuid, 'active')", (pid,))
        refused("a product with no name", "select public.buyer_product_upsert('{\"name\": \" \"}')")
        refused("a negative price", "select public.buyer_product_upsert('{\"name\": \"x\", \"price_usd\": -1}')")
        refused("a media url that is not http(s)", "select public.buyer_product_upsert('{\"name\": \"x\", \"media\": [{\"url\": \"javascript:x\", \"kind\": \"image\"}]}')")

        did = one(
            "select public.rfq_draft_save(null, %s::jsonb)::text as id",
            (json.dumps({"product_title": "Dry run", "target_supplier_ids": [supplier], "product_id": pid}),),
        )["id"]
        drafts = one("select public.rfq_draft_list() as l")["l"]
        print("    rfq_draft_list[0]        :", {k: drafts[0][k] for k in ("id", "target_supplier_ids", "product_id")})
        assert drafts[0]["id"] == did and drafts[0]["target_supplier_ids"] == [supplier]
        refused("a draft naming another buyer's product", "select public.rfq_draft_save(null, %s::jsonb)",
                (json.dumps({"product_id": "00000000-0000-4000-8000-000000000000"}),))

        rid = one(
            "select public.rfq_create(%s::jsonb)::text as id",
            (json.dumps({
                "product_title": "Dry run - rolled back", "quantity": 100, "quantity_unit": "pcs",
                "target_supplier_ids": [supplier], "message": "Please quote.",
                "questions": ["MOQ?", ""], "product_id": pid,
            }),),
        )["id"]
        rfq = one("select public.rfq_get(%s::uuid) as r", (rid,))["r"]
        print("    rfq_get message/questions/product_id :", rfq["message"], rfq["questions"], rfq["product_id"])
        assert rfq["message"] == "Please quote." and rfq["questions"] == ["MOQ?"] and rfq["product_id"] == pid
        assert rfq["targets"] and rfq["quotes"] == [] and rfq["viewer_role"] == "buyer"
        cur.execute("select public.rfq_draft_delete(%s::uuid)", (did,))

        # The product still exists here; the other buyer must not reach it.
        with as_user(other):
            print("    another buyer, get       :", one("select public.buyer_product_get(%s::uuid) as p", (pid,))["p"])
            assert one("select public.buyer_product_get(%s::uuid) as p", (pid,))["p"] is None
            assert one("select count(*)::int as n from public.buyer_products where id = %s::uuid", (pid,))["n"] == 0, \
                "RLS let another buyer read the row directly"
            refused("another buyer deleting it", "select public.buyer_product_delete(%s::uuid)", (pid,))
            refused("another buyer patching it", "select public.buyer_product_upsert(%s::jsonb)", (json.dumps({"id": pid, "name": "x"}),))
            refused("another buyer's rfq_create naming it", "select public.rfq_create(%s::jsonb)", (json.dumps({
                "product_title": "x", "quantity": 1, "quantity_unit": "pcs", "target_supplier_ids": [supplier], "product_id": pid}),))

    with conn.transaction(force_rollback=True):
        cur.execute("set local role anon")
        refused("anon reading buyer_products", "select count(*) from public.buyer_products")
        refused("anon calling buyer_product_list", "select public.buyer_product_list()")
    print()
    print("every check passed")
finally:
    conn.rollback()
    conn.close()
    print("=== ROLLED BACK -- nothing was committed ===")
