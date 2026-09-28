# Migration 0106 (the buyer workspace) — dry run and apply

**Not yet run against production.** Written 27 Sep 2026 with the migration. The
agent that wrote it may not touch production, and the connection pooler times
out from this machine (the 0105 note says the same). Run the dry run below,
paste its output under "Raw output", and only then apply.

Script: `ops/dry_run_0106_buyer_workspace.py`. One transaction, always rolled
back, nothing committed, no approval needed to run it (AGENTS 15). Applying
the file is the part that waits for the founder.

## What 0106 is

`supabase/migrations/0106_buyer_products_rfq_message_workspace.sql`, additive:

| Part | What it adds |
| -- | -- |
| Workspace | `buyer_settings` gains the buyer's company (name, type, description, website, customer base, headcount, logo) and the RFQ composer's defaults (up to 20 questions, an email template). `settings_get()` returns them as `workspace` and `inquiry`, alongside everything it returns today. Two writers: `settings_update_workspace`, `settings_update_inquiry`. |
| Product base | Table `buyer_products` (owner-only RLS, nothing for `anon`), five RPCs `buyer_product_upsert / _list / _get / _delete / _set_status`, and a public-read `product-media` bucket (10 MB; PNG, JPEG, WebP, GIF, PDF) that a buyer can write only under their own folder. |
| RFQs | `rfqs` gains `message`, `questions`, `product_id`. `rfq_create` stores them (the product must be the caller's own); `rfq_get` returns them. Table `rfq_drafts` (owner-only RLS) and four RPCs `rfq_draft_save / _list / _get / _delete`. |

Two decisions worth knowing before approving:

- **`product-media` has no public SELECT policy**, unlike `avatars` (0059).
  A public bucket serves a file by its URL without one; 0059's `to public`
  policy additionally lets anyone *list* the bucket, which here would list
  every buyer's folder. Listing is owner-folder only.
- **Three existing functions are replaced**: `rfq_create`, `rfq_get`,
  `settings_get`. Each is the repo's last definition (0028, 0028, 0059) plus
  additions only. 0105 found production's `buyer_supplier_profile` ahead of the
  repo; if one of these three has drifted the same way, a replace would
  silently delete the live-only part. Step 1 of the dry run compares every live
  body with the repo's and **stops before applying anything** if one differs.

## What the dry run proves

1. **Drift**: live `prosrc` of the three replaced functions equals the repo's.
2. **Re-runnable**: the file is applied **twice** in the transaction.
3. **Shape**: every new function is SECURITY DEFINER with `search_path=public`;
   `anon` holds EXECUTE on none of them (Supabase grants it by name by default;
   0105's finding); the `_input_*` helpers are callable by no API role; both
   new tables have RLS on, one owner policy, no `anon` privilege; the bucket
   and its four owner-folder policies exist.
4. **Behaviour as a real buyer** (`set local role authenticated`, the buyer's
   uid in the JWT claim): workspace and inquiry round-trip and `settings_get`
   keeps its old keys; a product round-trips, a partial patch keeps the name,
   media is reduced to `{url, kind}`; bad input is refused; a second buyer
   cannot read the row (RPC or direct select), patch it, delete it, or name it
   in an RFQ; a draft round-trips; `rfq_create` stores message, questions and
   product and `rfq_get` returns them; `anon` can neither read the table nor
   call the list RPC.

It needs two buyer profiles and one published, unsanctioned supplier; it
stops if it cannot find them.

## The command for the founder

Dry run first (safe, rolled back):

```
python ops/dry_run_0106_buyer_workspace.py
```

It must end with `every check passed` and `ROLLED BACK`. If it prints
`STOP: production is ahead of the repo`, do not apply: the diff it prints is
what 0106 must carry forward first.

Then, only after the output above is pasted below and still current, one
transaction:

```
psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -1 -f E:/SourceBD/supabase/migrations/0106_buyer_products_rfq_message_workspace.sql
```

`psql` is not installed on this machine; the dry-run script applies the same
file through psycopg. The migration goes **before or with** the deploy that
ships the product pages and the new API actions, never after: the routes call
RPCs that do not exist until it is applied (a missing function is a 400/500
from PostgREST, not a crash, but every product page would fail).

Afterwards, confirm read-only (Supabase MCP): `buyer_products` and
`rfq_drafts` exist with RLS on, `anon` holds nothing on either, the
`product-media` bucket exists, and `settings_get()` for a signed-in buyer
returns `workspace` and `inquiry`. Then add the ledger row in
`context/current-state.md`.

## The file

```
file          : supabase/migrations/0106_buyer_products_rfq_message_workspace.sql
bytes         : 53569 (working tree, LF, 27 Sep 2026)
sha256        : 7be57eebb6a7c819b33773e33591bee23eee570a9b3dde4c95a1fe72999e2f57
```

`core.autocrlf` is on here, so a fresh checkout may hash differently; the
script prints the hash of the file it actually applies.

Checked offline so far: `python ops/validate_sql_syntax.py` (libpg_query via pglast 8.4)
parses all 81 statements, and every PL/pgSQL body parses. CI's migration
replay on Postgres 16 is the first execution; this dry run is the first
against real data.

## Raw output

_(not yet run — paste the script's output here)_
