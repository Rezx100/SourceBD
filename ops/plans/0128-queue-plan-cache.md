# 0128 — review queue "All open": the Release answer kept, not worked out fifty times a page

Moderation and evidence plan, item 0d. Migration
`supabase/migrations/0128_admin_queue_plan_cache.sql`.

## The numbers (measured read-only on production, 10 Oct 2026)

Before 0128, `python ops/time_admin_queue_list.py --print` run through the Supabase MCP:

| Figure | Value |
| -- | -- |
| open rows | 60 |
| `admin_queue_list_open_50_ms` | 71,719 ms (the API's limit for a signed-in user is 8 s, so the page always failed) |
| `plan_total_ms_newest_50` | 34,898 ms |
| by type | brand_disclosure_match_review 34 rows, 34,895 ms, worst 3,336 ms; fuzzy_match_review 12 rows, 3 ms; group_parent_review 4 rows, 0 ms |

The cause is the brand-disclosure plans, not the building-shaped names the code suggested.

0128 as first written (ten rows per call), applied inside a rolled-back block on production:
load 1 15 ms, load 2 6,223 ms, load 3 11,573 ms. Load 3 would pass the 8 s limit, roll back
what it kept, and every load after would fail the same way. So 0128 now also stops after about
2.5 s of plan work per call. The same rolled-back test, eight loads in a row:

| load | ms | still pending |
| -- | -- | -- |
| 1 | 15 | 40 |
| 2 | 3,274 | 31 |
| 3 | 3,506 | 29 |
| 4 | 3,344 | 28 |
| 5 | 2,665 | 24 |
| 6 | 4,238 | 22 |
| 7 | 3,488 | 20 |
| 8 | 3,259 | 17 |

Every load stays under the limit, and the queue is fully classified after about fifteen loads.
After applying, re-run the timing script and add the after figures here.

## The likely cause, from the code

`admin_queue_list` (0102) runs `admin_queue_release_plan(p.id)` for every row of the page in
a lateral join. For a `group_parent_review` or `fuzzy_match_review` row with a building-shaped
name, the plan calls `_queue_mother_hits`, which scans every published supplier through up to
twenty regular expressions per candidate base name. Fifty rows can mean fifty full-table
passes. The 0121 wrapper short-cuts only ETL holds.

## The fix

- `verification_queue.release_plan` and `release_plan_at` keep the plan as last worked out.
- `admin_queue_list` reads the kept plan. A page row with no plan, or one older than a day,
  is worked out afresh, at most ten rows and about 2.5 s per call (newest first), and kept. The rest answer
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
