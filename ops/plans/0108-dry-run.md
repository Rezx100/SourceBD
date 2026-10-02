# 0108 — expired certificates on the Compliance hub: dry run

Migration: `supabase/migrations/0108_compliance_expired_certs.sql`
(LF: 4,283 bytes, md5 `0184e262f3f0f70058df6f4f27b6348e`, sha256
`a7626751565b9528e5ffaf1a96207defbe9a9d8943f66d23ce07b258d57cc520`; a CRLF
checkout hashes differently, the SQL is the same). Script:
`ops/dry_run_0108_compliance_expired_certs.py`. **Not applied.**

## What it does

Adds one function, `compliance_expired_certs()`. Nothing live is rewritten:
`compliance_expiring_certs` (the hub's 90-day list) and `buyer_dashboard`
(Saved's alerts) keep their bytes, and the pages call the new function beside
them. It lists every certificate on the signed-in buyer's saved suppliers that
has expired with no later certificate of the same scheme on file, most
recently lapsed first, in the hub's existing row shape.

## Dry run, 3 Oct 2026 (02:09 Dhaka, 2 Oct 20:09 UTC)

The pooler timed out again, so the script's block (`--print`) was run through
the Supabase MCP. It applies the file inside a `do` block, refuses unless the
literal's md5 is the file's and the function does not exist yet, checks, then
raises `DRYRUN_RESULT`, which rolls everything back. Afterwards
`to_regprocedure('public.compliance_expired_certs()')` was null again.

| Check | Result |
| -- | -- |
| `compliance_expiring_certs(int)`, `buyer_dashboard()` byte-identical before and after | true |
| STABLE · SECURITY DEFINER · `search_path=public` | true · true · true |
| `anon` can execute / `authenticated` can execute | false / true |
| Signed out | `{"total": 0, "rows": []}` |

Every buyer with saved suppliers, the function against an independent count
(the certificate's expiry is the latest of its scheme on that supplier, and is
past):

| Buyer | Saved | Expired listed | Independent count | All in the past | Time | Most recent |
| -- | -- | -- | -- | -- | -- | -- |
| `750bea13` | 11 | 4 | 4 | yes | 6.5 ms | GOTS, GCL International, `next-export-zone`, 5 Sep |
| `7df1899d` | 17 | 15 | 15 | yes | 2.6 ms | GOTS, Intertek, `tm-jeans`, 22 Sep |
| `dfb78c50` | 11 | 6 | 6 | yes | 1.8 ms | WRAP, `aboni-knitwear`, 29 Sep |

So today 25 expired certificates on these three buyers' saved suppliers are
invisible on the hub and on Saved.

Across all published suppliers: 503 expired certificates, 30 with a later one
of the same scheme on file, 473 qualify (262 GOTS, 207 WRAP, 4 SA8000). None
had only an undated certificate of its scheme beside it.

## For the founder: apply

Dry run again first (safe, rolled back, no approval needed):

```
python ops/dry_run_0108_compliance_expired_certs.py
```

It prints the table above as JSON and ends `rolled back: nothing committed`. If
the pooler times out, `--print` gives the same block for the SQL editor. Then
apply the file in one transaction (or paste it into the Supabase SQL editor):

```
psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -1 -f supabase/migrations/0108_compliance_expired_certs.sql
```

Order: apply before the deploy that carries the hub change. If the code goes
live first, nothing breaks: the hub says "Expired certificates did not load"
and Saved says they "could not be read just now" until the function exists.

Rollback: `drop function public.compliance_expired_certs();`
