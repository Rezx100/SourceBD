# 0123 source freshness: dry run (6 Oct 2026)

Migration: `supabase/migrations/0123_source_freshness.sql`
sha256 (LF, as committed): `2fe614a989d67bd300d25434721a347dd443c20a8745da7190ab6c56867845ee`
Spec: `context/feature-specs/spec-etl-freshness.md`, slice S3. **Apply 0122 first**: 0123 counts
certificates "no longer listed".

## How it was run

Production `stnrfxrxfonwexzcvvpv`, Supabase MCP `execute_sql`, in one `DO` block.

- The block added 0122's certificate columns and then ran 0123.
- It ended in `raise exception`, so everything rolled back.
- A read afterwards found 10 schedules (as before), no `etl_source_freshness`, and no certificate column.

## Result

```
DRY RUN OK (rolled back) | schedules=14 | sources=30 over_sla=9 |
  bkmea_detail: last complete read 2 Aug, 1546 h old, no age limit set (S5 sets it)
  ofac_sdn: last complete read 27 Jun, 2427 h old, limit 48 h → over
  wrap: last complete read 24 Jul, 1775 h old, limit 72 h → over
```

- **4 new schedule rows, all off:**
  - GOTS and WRAP: daily, window 03:00 UTC, age limit 72 h;
  - OEKO-TEX and SA8000: weekly, window 04:00 UTC, age limit 10 days.
- **The five sanctions schedules** gain a 02:00 UTC window.
- **30 sources are measured.** 9 are past their limit today: the S1 lists and the four certificate bodies, because none has been read since June or July. That is why the schedules exist.

## What changes when it is applied

- **`/admin/sources`** gains a Freshness table, one line per source:
  - its age against the limit;
  - how often it runs;
  - the last five runs;
  - failures in a row;
  - the last safety-limit stop;
  - Firecrawl credits this month, against 1,500;
  - rows no longer listed.
- **Slack.** From 09:00 Dhaka each day, one digest posts: sources past their limit, failing sources, safety stops, and credits.
  - Sanctions and certificate changes still post the moment they happen.
  - Before 0123 is applied, the digest stays silent.
- **No buyer-facing change.**

## Code in the same PR (no migration needed)

- **The queue claim** runs at most 2 jobs at once and never two of one scraper; an advisory lock serialises claims.
- **A failed job** is retried after 15 min, then after 1 h. After its third failure it is dead-lettered, and Slack says so.
- **The minute cron** drains and enqueues under `flock`, so overlapping ticks skip those steps.
- **Runs record** `meta.credits_used` and `meta.complete`.

## To apply (founder)

Say "apply 0122" and then "apply 0123". Each is applied through the Supabase MCP `apply_migration`, gated on its sha256.

After deploy, enable schedules one at a time in `/admin/sources`: the five sanctions lists first, then GOTS, WRAP, OEKO-TEX and SA8000.

## Rollback

The REVERSE block is in the migration header.
