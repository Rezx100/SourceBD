# REZ-C (the company profile) — migration 0105 dry run

Run 25 Sep 2026 against production, in one transaction, always rolled back.
Script: `ops/dry_run_0105_supplier_record.py`. Re-run it before applying and
compare — if the set moved, the approval is void (AGENTS 16).

## What 0105 is, and what it deliberately is not

`0105_supplier_record_v32.sql` adds **one** function,
`supplier_contact_counts(p_slug text)`. The record sheet's locked card has to
say how much contact detail a record holds without ever carrying a value to
the browser, and 0083 revoked the contact columns from `authenticated`, so the
count has to be taken inside a security-definer function.

Four things handoff §4.3 asks for are not built, each checked against
production on 25 Sep 2026:

| Asked for | Why not |
| -- | -- |
| `contact_counts` **on `buyer_supplier_profile`** | Production's copy of that 16 KB function is **ahead of this repo**: it emits `'fetched_at', rr.fetched_at` on every `rsc_remediation` row, which no migration in `supabase/migrations/` adds (0099 is the last to redefine it). A `create or replace` built from the repo would silently delete that key, and `lib/dashboard/build-models.ts` reads it for the Safety section's read date. A separate function adds the counts with zero blast radius. The dry run proves the md5 of `pg_get_functiondef(buyer_supplier_profile)` is identical before and after. |
| `read_at` | Already there. `buyer_supplier_profile` returns `provenance[].last_seen_at`, which *is* `source_records.fetched_at`, and `buildSheet` already reduces it to the record's read date. |
| `pages_changed_since_read` | Not buildable. It needs the hash a page had at `fetched_at` compared with a **later** hash. `source_records` holds one `raw_hash` per row, updated in place alongside `fetched_at`, and this database has no history table (only `source_records` and `firecrawl_webhook_events` match). The comparison has no second operand, so the value could only ever be null — which §4.3 itself says means the caption reads "read &lt;date&gt;" only, exactly what the sheet renders today. |
| `rfq_count` | No migration needed. `rfqs` already carries `pol_rfqs_select_buyer (buyer_id = auth.uid())`, so the calling buyer counts its own RFQs through PostgREST. A security-definer wrapper would only widen what is already correct. |

§4.5 ("`rfq_create` gains `and s.is_sanctioned = false`") is **already true in
production**: the live `rfq_create` validates every target with
`s.is_published = true and s.is_sanctioned = false` and raises otherwise. No
change was needed. `etl/tests/test_rfq_create_sanctioned_sql.py` pins that at
the boundary by calling the real function inside a rolled-back transaction.

## Finding fixed during the dry run

The first run showed **`anon` holding EXECUTE** on the new function.
`revoke all ... from public` does not remove it: Supabase's default privileges
grant EXECUTE on new functions to `anon` and `authenticated` *by name*, and a
revoke from PUBLIC does not touch a named grant. The founder's rule of 23 Sep
is that contact details are sign-in gated, and how many a record holds is part
of that same locked card — so 0105 now revokes `anon` explicitly. The run
below is after that fix.

## The file

```
file          : supabase/migrations/0105_supplier_record_v32.sql
bytes         : 4795
line endings  : CRLF
sha256        : e848c54da236791282240ff7655dedcd9008c6b856910f6718eb9e52b0211bd6
```

## Raw output

```
file          : supabase/migrations/0105_supplier_record_v32.sql
bytes         : 4795
line endings  : CRLF
sha256        : e848c54da236791282240ff7655dedcd9008c6b856910f6718eb9e52b0211bd6

=== BEFORE ===
supplier_contact_counts exists:
    {'n': 0}

buyer_supplier_profile md5:
    {'md5': '63ee7ea06bacb0d30a537d78bc38ae28'}

=== APPLYING 0105 (this transaction only) ===
applied without error

=== AFTER ===
supplier_contact_counts exists:
    {'n': 1}

buyer_supplier_profile md5 (must be unchanged):
    {'md5': '63ee7ea06bacb0d30a537d78bc38ae28'}

security / volatility / search_path:
    {'security_definer': True, 'volatility': 's', 'config': 'search_path=public'}

grants (anon must NOT appear):
    {'grantee': 'authenticated', 'privilege_type': 'EXECUTE'}
    {'grantee': 'postgres', 'privilege_type': 'EXECUTE'}
    {'grantee': 'service_role', 'privilege_type': 'EXECUTE'}

=== BEHAVIOUR ON REAL ROWS ===
the 11-source record (aboni):
    {'slug': 'aboni-knitwear', 'counts': {'emails': 1, 'phones': 6, 'website': True, 'representatives': 1}}

three more published records:
    {'slug': '1-world-apparel', 'counts': {'emails': 1, 'phones': 0, 'website': False, 'representatives': 1}}
    {'slug': '1046-am-fashion', 'counts': {'emails': 1, 'phones': 1, 'website': False, 'representatives': 1}}
    {'slug': '1st-and-fair-fashion-wear', 'counts': {'emails': 0, 'phones': 0, 'website': False, 'representatives': 1}}

a record with no contact detail at all, if one exists:
    {'slug': 'rb-knitwear-ltd-new', 'counts': {'emails': 0, 'phones': 0, 'website': False, 'representatives': 0}}

an UNPUBLISHED record must return null:
    {'slug': 'versatile-textiles-ltd-extension', 'counts': None}

an unknown slug must return null:
    {'counts': None}

=== TOTALS ACROSS THE PUBLISHED SET ===
what the locked cards will say, in aggregate:
    {'published': 10266, 'with_email': 8741, 'with_phone': 8593, 'with_website': 1808, 'with_rep': 8365}

=== ROLLED BACK -- nothing was committed ===
```

## Reading it

- `buyer_supplier_profile` md5 is `63ee7ea06bacb0d30a537d78bc38ae28` before and
  after. 0105 does not touch it.
- `anon` is absent from the grants. `authenticated`, `service_role` and
  `postgres` hold EXECUTE.
- The counts are right on real rows, and both "not published" and "no such
  slug" return null rather than a row of zeros — a caller cannot tell them
  apart from a missing record, which is correct: neither is a record.
- Aggregate over the 10,266 published records: 8,741 hold an email, 8,593 hold
  at least one phone number, 1,808 a website, 8,365 a named representative.
  These match a direct count over `suppliers` taken the same day, so the
  function is not filtering anything out by accident.
- Nothing about which **register** filed a contact detail is returned. §4.3's
  example includes `"registers": ["BGMEA", …]`, and that attribution does not
  exist in this database: no row of `source_records.fields` carries a contact
  key (0 of 22,190 active rows across all 14 registers), and
  `v_supplier_addresses.phone` / `.email` are empty for every one of its
  10,835 rows. Printing register names beside the counts would be an invented
  receipt, so the card says the counts alone.

## The command for the founder

Dry run again first (safe, rolled back, no approval needed):

```
python ops/dry_run_0105_supplier_record.py
```

Then, only after the output above is confirmed still current, one transaction:

```
psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -1 -f E:/SourceBD/supabase/migrations/0105_supplier_record_v32.sql
```

`psql` is not installed on this machine; the dry-run script is the psycopg
equivalent and applies the same file. The migration goes **before or with**
the deploy, never after (the deploy-order hazard in `current-state.md`).

Afterwards, confirm with the read-only Supabase MCP: one
`supplier_contact_counts` function, `anon` absent from its grants, and
`buyer_supplier_profile` md5 still `63ee7ea06bacb0d30a537d78bc38ae28`. Then
add the ledger row in `context/current-state.md`.
