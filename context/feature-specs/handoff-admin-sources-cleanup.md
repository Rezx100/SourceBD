# Handoff: make /admin/sources a one-screen control room (written 6 Oct 2026)

For a fresh session. Frontend-only. Load the `impeccable` skill first (global CLAUDE.md).

## The founder's complaint, in their words

> "The sources and integration page is messy. I have to scroll way down to find the ETL or the
> runner. It doesn't have stats that instantly tell me what is going on and what needs to be done."

## What the page is today (`origin/development`, 6 Oct 2026)

- Route: `app/(app)/(old-shell)/admin/sources/page.tsx` (50 lines). It fetches four things and hands
  them to one component.
- Component: `components/admin-scraper-monitor.tsx` (729 lines). Top to bottom it renders:
  1. the head ("Sources & ingestion"), with auto-refresh and generated-at;
  2. four summary cards: last success, running now, failed, next scheduled run;
  3. the **Freshness table** (`components/admin/source-freshness.tsx`, data from
     `admin_source_freshness()`, migration 0123): one row per source with age against its limit,
     interval, the last five runs, failures in a row, safety stops, credits and "no longer listed";
  4. Evidence health;
  5. Live monitor (running and queued jobs);
  6. **one section per scraper group, each a grid of big ScraperCards** (Run now, schedule toggle,
     interval). This is the long scroll: about 30 cards before the runner history;
  7. Recent queue jobs and Recent scraper reports, side by side, at the very bottom.
- Data shapes: `lib/admin/etl-monitoring.ts` (`DashboardDoc`), `lib/admin/source-freshness.ts`
  (`FreshnessDoc`, tested in `lib/admin/source-freshness.test.ts`), `lib/admin/evidence.ts`.
- Actions already exist and must keep working unchanged: `/api/v1/admin/etl/enqueue` (Run now),
  `/api/v1/admin/etl/schedule` (toggle, interval), `/api/v1/admin/etl/status`,
  `/api/v1/admin/etl/jobs/[id]/decision`.

## What to build

One screen that answers three questions at a glance, without scrolling:
**Is anything broken? What is running? What do I need to do?**

1. **A "Needs you" strip at the top.** It shows only items that need the founder, each with its
   one action:
   - runs held at the safety stop, which need `--accept-changes`;
   - certificate or sanctions removals held, which need `--accept-delistings`;
   - failed runs;
   - sources past their age limit while switched on;
   - near-match records waiting in `/admin/queue`.

   Show the exact server command to copy beside each held run (same text as
   `context/feature-specs/handoff-etl-freshness-golive.md`, "What held means"). Empty state: one
   calm line.
2. **Stat tiles, one row:**
   - running and queued;
   - failed in the last 24 h;
   - sources over their limit;
   - schedules on, out of the total;
   - Firecrawl credits this month against 1,500;
   - last successful read.
3. **Live runs right under the tiles:** progress, elapsed time and latest event, as today's
   LiveJobCard does, but compact.
4. **One dense sources table replaces both the scraper cards and the Freshness table.** Group the
   rows (sanctions, certificates, registers, brands, other), with one row per source:
   - status dot;
   - age against its limit;
   - schedule on/off toggle and interval;
   - last run's result and numbers (seen, changed, skipped);
   - Run now.

   Clicking a row opens its detail (the last five runs, errors, evidence strip, `meta.reconcile`
   and `meta.circuit_breaker`) in a side pane or drawer, following the split-pane pattern the
   buyer app already uses. Keep the column order the founder scans in: name, health, age, schedule,
   last run, action.
5. **Run history** (queue jobs and reports) moves to a tab or collapsed section, filterable by
   source. It is not the page's bottom.
6. Evidence health becomes one tile plus its detail in the source drawer, not its own section.

Mobile: the table becomes rows with the action at the right edge; no horizontal page scroll.

## Rules for this session

- **Frontend only.** No migration, no new RPC, no ETL change. Everything above is already in
  `DashboardDoc` and `FreshnessDoc`. If a number truly is missing, stop and ask the founder; do not
  add SQL.
- The ETL go-live (`handoff-etl-freshness-golive.md`) is running in another session. Do not touch
  `etl/`, migrations or schedules, and never toggle a schedule on production while testing.
- Keep every existing action and its API route working. The founder uses Run now and the toggles daily.
- Local dev server is unusable (11-minute compiles, no database). Screenshot with the static
  harness recipe in memory ("Static harness to PNG", "Phone harness"). Before pushing, grep
  `*.test.ts` for the old markup you removed (CI has gone red on this twice).
- The founder takes the recommended option: build it, then show screenshots at desktop and phone
  widths rather than asking which layout.
- Workflow: branch off `development`, run `lib/admin/source-freshness.test.ts` plus any test you
  add, one `/code-review` pass, PR to `development` with `gh pr merge --auto --squash`.
- A test at the boundary: the page's "Needs you" strip lists a held run and a failed run from a
  fixture doc, and shows the right copy-paste command for each.

## Done when

- The founder opens `/admin/sources` and, without scrolling on a laptop, sees what's broken,
  what's running, and what needs them.
- Every source, its schedule toggle and Run now are reachable within one table, grouped.
- Screenshots (desktop and phone) are posted on the PR.

## Ready-to-paste prompt

```
Follow context/feature-specs/handoff-admin-sources-cleanup.md. Rebuild /admin/sources as a one-screen control room: a "Needs you" strip with copy-paste release commands, a row of stat tiles, compact live runs, and one grouped sources table with a detail drawer, replacing the long scroll of scraper cards. Frontend only, keep every existing action working, screenshots at desktop and phone, PR with auto-merge. Plain words, five-line updates.
```
