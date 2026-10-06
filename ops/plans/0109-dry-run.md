# 0109 dry run: where the buyer onboarding keeps its answers

Migration: `supabase/migrations/0109_buyer_onboarding_answers.sql`.
Behaviour test: `supabase/ci/assert-0109.sql` (runs in CI's migration replay).
Source of the columns: `context/feature-specs/ds-v4/onboarding-data-map.md`,
"Migration order" step 1.

## What it changes

Additive and nullable only. No existing row changes and nothing a buyer sees
today changes, because no page calls the two new functions yet (v4 PR B8 will).

- `profiles`: `job_role`, `terms_accepted_at`, `terms_version`.
- `buyer_settings`: `company_country`, `sourcing_hs_headings`,
  `required_cert_kinds` (`cert_kind[]`), `sell_markets`.
- `onboarding_save_buyer(jsonb)` and `onboarding_get_buyer()`, signed-in
  buyers only, each touching only the caller's own rows.

## Dry run, 3 Oct 2026, production (`stnrfxrxfonwexzcvvpv`)

Before: none of the seven columns and neither function exist; 0106's helpers
(`_input_text`, `_input_strings`) and `buyer_settings.company_name` do.

The whole file ran inside `begin`, then a `do` block read the result and raised,
so the transaction could only abort:

```
DRYRUN-0109 new_columns=7 anon_save=f auth_save=t anon_get=f profiles=39 buyer_settings=29
```

Every constraint was added against the 39 profiles and 29 settings rows
without a violation. Afterwards: 0 of the columns and 0 of the functions in
production. Nothing persisted.

## The command for the founder

On the founder's go-ahead in chat, the agent applies it through the Supabase
MCP (`apply_migration`, as 0107 was), or, by hand, one transaction:

```
psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -1 -f E:/SourceBD/supabase/migrations/0109_buyer_onboarding_answers.sql
```

or paste the file into the Supabase SQL editor. No deploy order: no code reads
these columns yet. Rollback is in the file's header.
