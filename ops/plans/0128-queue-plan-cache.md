# 0128 — review queue "All open": the Release answer kept, not worked out fifty times a page

Moderation and evidence plan, item 0d. Migration
`supabase/migrations/0128_admin_queue_plan_cache.sql`.

## The numbers: NOT MEASURED yet (6 Oct 2026)

The founder asked for production timings before the fix. This machine cannot reach production
(no psql, no Python, the pooler times out, the Supabase MCP is not authorised in this session),
so the measurement is ready to run instead of run:

```
python ops/time_admin_queue_list.py --print
```

Paste the output into the Supabase SQL editor (or the MCP `execute_sql`). It is read-only and
rolls back. It reports, as the first active admin:

| Figure | Meaning |
| -- | -- |
| `admin_queue_list_open_50_ms` | the "All open" tab exactly as the page calls it (or `admin_queue_list_error` if it hits the statement timeout, which is the symptom itself) |
| `plan_total_ms_newest_50` | the sum of the fifty Release plans the old list computed on every load |
| `plan_slowest_10` | which rows cost the most, with their queue type and rule |
| `plan_by_type` | rows, total and worst ms per queue type |

Run it once before applying 0128 and once after. Record both here, in place, with the date.

## The likely cause, from the code

`admin_queue_list` (0102) runs `admin_queue_release_plan(p.id)` for every row of the page in
a lateral join. For a `group_parent_review` or `fuzzy_match_review` row with a building-shaped
name, the plan calls `_queue_mother_hits`, which scans every published supplier through up to
twenty regular expressions per candidate base name. Fifty rows can mean fifty full-table
passes. The 0121 wrapper short-cuts only ETL holds.

## The fix

- `verification_queue.release_plan` and `release_plan_at` keep the plan as last worked out.
- `admin_queue_list` reads the kept plan. A page row with no plan, or one older than a day,
  is worked out afresh, at most ten rows per call (newest first), and kept. The rest answer
  `plan_pending: true`; the page says "Not yet classified" and the next load takes the next
  ten. First load of a cold queue: at most ten plans. Every load after: none.
- `admin_queue_decide` is untouched and still works the plan out fresh when the admin clicks
  Release, so a kept plan can only affect the label on the list, never what Release does.

Executed by CI on every push: `supabase/ci/assert-0128.sql` (ten kept on the first load, the
two oldest pending, the second load fills them without touching the ten, a decided row is
left alone, a buyer and anon are refused).

## Dry run and apply (founder's go-ahead only, AGENTS rule 15)

0128 adds two nullable columns and replaces one function; it changes no row a buyer can see
(the queue is admin-only). Say "apply 0128": the agent applies it through the Supabase MCP
`apply_migration` as 0107 was, then re-runs the timing script and records the after figures
above.

Rollback: restore `admin_queue_list` from `0102_admin_queue_release.sql`; drop the two columns.
