# Buyer app speed: where a click's time goes (29 Sep 2026)

From the founder's dashboard video of 29 Sep ("it has to be lightning fast"),
hand-off `context/feature-specs/handoff-dashboard-video-29sep.md` §1.4.
Measured on the live site (`main` `d7e6c42`) in the founder's own signed-in
Chrome on this machine, 29 Sep 2026 between 04:10 and 04:40 local time.
Script: `ops/measure_app_speed.mjs` (the same in-page timer, ported to
Playwright over the Chrome debugging port; the first runs used the
browser-harness with identical steps). Times are from the click to the thing
being on screen; "shell" is when the URL changed and the pane's first paint
(its skeleton) appeared.

## Before (live, `d7e6c42`)

| Step | Shell | Content | Runs |
| -- | -- | -- | -- |
| Typed search, home to results (server cache cold) | 1.2 s | 1.9–3.1 s | 5 |
| Open a record from the results | 1.6–2.2 s | 3.9–4.9 s | 7 |
| Open a product line from the record | 1.6 s | 3.3–4.3 s | 3 |
| Back from the line to the record | 1.6 s | 4.0–4.1 s | 2 |
| Send RFQ (the composer) | — | 1.9–2.1 s | 3 |
| Close the composer, back to the record | — | 4.2–4.5 s | 2 |

Every click's server response started about 1 s after the click (time to
first byte 940–1,260 ms on all of them), and a record's took a further ~3 s
to finish streaming.

**3 of 12 record opens were dropped**: the request went out and completed,
but the URL never changed and the pane never opened. All three were clicked
while the previous navigation's record was still streaming in. Not
reproduced locally (the dev server cannot reach the database); watch for it
after the deploy, when streams are shorter.

## Where the time goes

1. **Distance.** The app server is in Amsterdam (`109.104.153.228`,
   BrainStorm Network) and the database in `us-west-1` (Northern
   California). Every database or auth call is ~150 ms of travel before any
   work, so the number of calls in a row is what matters.
2. **Every click, before anything is drawn (~1 s):** the buyer to the server,
   then in `middleware.ts` three calls in a row — the sign-in check
   (`auth.getUser`), the rate limit (`rl_check`), the role and suspension read
   (`profiles`) — then the search page's own reads (`supplier_epb_hscodes_batch`
   and `saved_suppliers`, side by side). The search itself comes from the
   two-minute shared cache.
3. **A record (~3 s more):** `buyer_supplier_profile` took a median 1,120 ms
   in the database (timed on production, 8 records). Two of its CTEs JOINED a
   view to the one-row CTE `s`, which the planner cannot push into a view, so
   `v_supplier_registry_ids` was built for every supplier (19,326 rows,
   ~280 ms) and `v_supplier_addresses` too (27,871 rows, ~730 ms). Then a
   second round of calls (workers, saved, the buyer's RFQs) waited for the
   profile's supplier id.
4. **A line:** the pane read the whole record sheet AND the line — the
   profile twice, plus the contact counts, buildings, saved state and RFQs for
   a sheet it never drew — and showed the whole record's silhouette on the way.
5. **The RFQ form:** its two reads (the suppliers, the workspace template)
   were awaited with the search, so nothing was drawn until they answered.

## What PR 1 changes

| Change | Where | Effect |
| -- | -- | -- |
| The profile reads its two views for one supplier (filter, not join) | migration `0107`, founder applies | 1,120 ms → 318 ms median in the database; same payload (59 records compared) |
| A line reads the record once and nothing it does not draw | `loadLineBeside` | one profile call instead of two; no counts, buildings, saved or RFQ reads |
| A record opened from a row starts its id-keyed reads beside the profile | `SheetView.supplierId` | one round of calls fewer (~150–200 ms) |
| The composer reads inside a boundary of its own | `DiscoverComposer` | the pane's silhouette paints with the results |
| A line's own silhouette | `LineSkeleton` | no flash of the whole record on the way to a line |
| A spinner on the clicked link at once | `LinkPending`, `LinkPendingSwap` | the ~1 s wait for the server is visibly "working", not a dead click |
| The rate-limit check and the role read run side by side after the sign-in check | `middleware.ts` (`gateFor`) | ~150 ms off every click; same checks, same answers (founder's choice, 29 Sep) |

Expected after the deploy and 0107: a record ~1.5–1.8 s from click (was
3.9–4.9), a line ~1.3–1.6 s (was 3.3–4.3). Most of the ~1 s before the first
byte stays: see below.

## What is left, and needs the founder

The rest of the first ~1 s of every click (item 2 above). The founder was
asked on 29 Sep and chose to run the rate limit and the role read side by
side (done in PR 1, above). Not taken:

- **Verify the session token on the server itself** (`auth.getClaims`)
  instead of asking Supabase each time. ~150 ms off every click; a signed-out
  or revoked session then stays valid until its token expires (up to an hour).
- **Put the app server and the database on the same continent.** The biggest
  single win: every call's ~150 ms becomes a few ms. An infrastructure move,
  not a code change.
- `v_supplier_addresses` materialises every active source record (22,140
  rows, ~180 ms) on each profile read, and other readers share it; changing
  the view is its own decision.

## After

To be filled after the deploy (the founder's approval) and 0107's apply:
`node ops/measure_app_speed.mjs`.
