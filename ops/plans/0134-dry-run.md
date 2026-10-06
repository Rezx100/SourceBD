# 0134 — the record covers accounts, claims, team, saves, partners and reads

Moderation and evidence plan, item 1d. Migration `supabase/migrations/0134_ledger_accounts_reads.sql`:
a second trigger function on twelve more tables, `ledger_note` for reads (searches, record opens,
exports, file downloads, RFQs and orders viewed), and `terms_accept` so suppliers' acceptance of the
terms is recorded too (legal track 4.10).

## What writes from the deploy on

| Where | What the record gets |
| -- | -- |
| Results page (`/app/discover`) | `search.run` with the search and the count |
| A record opened (pane or page) | `supplier.viewed`, with `contact_visible: true` (a signed-in record shows the contact details) |
| A line opened | `supplier.line_viewed` |
| An RFQ opened (buyer pane or page, supplier page) | `rfq.viewed` with the viewer's role |
| An order opened | `order.viewed` |
| Download CSV, search export | `export.downloaded` (the evidence pack already writes its own row, which the trigger records) |
| A message file opened | `file.downloaded` |
| The supplier portal home | the banner to accept the terms; accepting writes `account.terms_accepted` |

A note is best effort: a page or route never waits on it or fails because of it. The database takes
at most 600 notes a minute per account.

## Status: NOT RUN against production (6 Oct 2026)

The migration adds triggers and three functions and changes no row. Read-only checks before applying:

```
select count(*) filter (where terms_version is null) as without_terms, count(*) as profiles from public.profiles;
```

If the first figure is large among suppliers, every supplier sees the banner on their next visit; that is
the point.

CI executes the behaviour on every push: `supabase/ci/assert-0134.sql`.

## To apply (founder's go-ahead only, AGENTS rule 15)

Say "apply 0134" (after 0131; 0109 before it, or `terms_accept` and the banner fail until 0109 is
applied). Deploy order does not matter otherwise: a note against a database without 0134 is refused
quietly.

Rollback: the REVERSE section of the migration.
