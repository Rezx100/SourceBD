# Gap 14 — "Email me new matches" and "Save your last search?" (data and access)

Paper gap list row 14. Boards: `10-…/Saved-saved-searches-with-alerts-…[5TW-0]`, `Save-this-search-popover-…
[67S-0]`, phone twins `[BSE-0]`, `[E3O-0]`, `[F1O-0]`, `[EZP-0]`. Status: **migration written and dry-run, not
applied** (`0113_saved_search_alerts.sql`, `ops/plans/0113-dry-run.md`).

## What is stored

- `saved_searches.alert_weekly` (default off): "Tell me about new matches". The owner's own row policies (0104)
  already allow the update, so the switch writes the column directly (`.update({ alert_weekly })`).
- `saved_search_alerts(search_id, seen_ids, checked_at, sent_at)`: what the weekly job has seen. No grant to buyers.
- `buyer_settings.last_search_state` / `last_search_at`: the buyer's last search.

## The calls

| Call | Who | What |
| --- | --- | --- |
| `saved_search_alerts_due(limit)` | service_role | searches with the switch on, not checked for 6 days, owner not suspended: `search_id, owner_id, email, name, query_state, checked_at, sent_at` |
| `saved_search_alert_new(id, ids[])` | service_role | today's matches not seen before; `null` on the first check (a baseline: email nothing) |
| `saved_search_alert_record(id, ids[], sent)` | service_role | stores today's matches as seen, stamps the check, and `sent_at` when `sent` |
| `buyer_last_search_set(state)` | the buyer | keeps the search they just ran (a jsonb object, 8 KB at most) |
| `buyer_last_search()` | the buyer | `{state, searched_at, saved}` or null; `saved` is true when a saved search holds the same state |

## For Sonnet (the screens and the job)

1. Save this search (popover and sheet): the "Tell me about new matches" switch, "One email on Monday, only when
   something new matches", saved with the search.
2. Saved searches: "Email me new matches every Monday" or "No email for new matches" per row, as a switch.
3. "Save your last search?" card from `buyer_last_search()` when it is not null, not `saved`, and from the last
   7 days; the search page calls `buyer_last_search_set` with the same state it would save.
4. The weekly job: a cron route (Monday morning, Vercel cron or the existing job runner) with the service-role
   client: `saved_search_alerts_due` → for each, run the search the way the results page does (the smart query,
   sanctioned suppliers hidden) and take the matching supplier ids → `saved_search_alert_new` → when it returns
   at least one id, one email (name, how many new, up to five names, "Run search" link, how to turn it off) →
   `saved_search_alert_record(id, ids, sent)`. Record after a failed send with `sent = false` only if the send
   is not retried, or the new ids are lost.

Not built: an unsubscribe link that works signed out (the email links to Saved searches, where the switch is).
