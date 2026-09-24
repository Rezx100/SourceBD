# Start here: REZ-C — the company profile (supplier record sheet and product line)

Written 25 Sep 2026, the day REZ-B went live. This is the prompt for the
session that builds the next piece. Step three of nine in
`handoff-dashboard-v3.2-implementation.md` §7; the build order there is
A → B → C → D → H → G → E → F → I, and A and B are done.

## 0. Where things stand (verified 25 Sep)

- `development` = `cfbbf4a` (the results page, PR #164). `main` = `1780c2c`
  (PR #165), deployed and live. `/api/health` reports that commit.
- Migration `0104_discover_v32` applied to production 25 Sep after a clean
  dry run. Live database: 9 `discover_v32%` functions, `saved_searches` with
  4 RLS policies, `discover_suppliers` at 25 arguments.
- The live results page renders: 24 results on the public `/discover?q=knit`,
  no contact fields in the HTML, signed-in search working.
- REZ-B's follow-up list is in `handoff-rez-b-live-migration.md` §5. None of
  it blocks REZ-C. The first item — the stale line "Selection arrives with
  the results work" on the RFQ list page — is a two-minute fix and can ride
  along in this PR.

## 1. What REZ-C is

From the spec, read these sections and nothing else of that 84 KB file until
a finding names another: **§3.3** (the sheet and the full page), **§3.4**
(`ProductSheet`), **§3.5** (`/app/products`, the HS catalogue), **§4.3**
(migration `0105_supplier_record_v32.sql`), **§4.5** (`rfq_create` gains
`and s.is_sanctioned = false`), and **§7** (the sequence and the gates).

In the founder's words: clicking a company from the results should open its
profile without losing the search behind it, and clicking a product line
inside that profile should open the line. Today both still land on the old
profile page.

The pieces:

- `/app/suppliers/[slug]` and the sheet → `SupplierSheet`, one component
  serving both the overlay (`?record=<slug>`, a parallel/intercepting route
  under `app/(app)/app/discover/@sheet/`) and the full page for deep links.
- Tabs: Overview · Products · Certificates · Safety RSC · Sources ·
  Locations · Facilities · RFQs, mapped onto today's profile tabs as §3.3
  spells out.
- The **locked contact card**: counts only, never values —
  `contact_counts jsonb` computed server-side in `0105`.
- `/app/suppliers/[slug]/lines/[hs]` → `ProductSheet`.
- `/app/products` → the HS catalogue table.
- Sanctioned suppliers: banner under the action bar on every tab, Send RFQ
  disabled in the UI **and** refused by `rfq_create`.

## 2. Two things the founder must settle before or during

1. **The HS photos.** `ProductSheet` shows one per line. 12 are in the repo
   under `design/assets/products/aboni-knitwear/`; 34 exist only on the
   Higgsfield CDN, which the org proxy blocks. The founder runs this once, in
   a normal PowerShell window (idempotent, public URLs, no secrets):
   ```
   powershell -ExecutionPolicy Bypass -File design\assets\products\hs\fetch.ps1
   ```
   Without them, the line sheet falls back to the caption alone. Decide
   before building §3.4, not after.
2. **Facilities.** That tab is REZ-73's roll-up, on branch
   `rez-73-facilities-lean`, not landed. Until it lands the tab renders the
   quiet empty state. Do not fold REZ-73 into this PR.

## 3. How to run it

Everything about how this repo works is in `AGENTS.md` and `CLAUDE.md`;
the loop is `.cursor/rules/sourcebd-closed-loop.mdc`, loaded when
implementation ends and verification begins.

- Branch from `development` **after** PR #166 (the REZ-B hand-off and ledger)
  has landed. Never from an unmerged feature branch.
- One spec at a time. Implement exactly §3.3–§3.5 and §4.3; no drive-by
  refactors, no renaming what the spec names.
- Migration `0105` is written but **never applied by the agent**: dry run in
  one rolled-back transaction, post the raw output, and the founder applies
  it. `psql` is not installed on this machine; the dry run that worked for
  `0104` used psycopg (the project's own driver) — the script is in the
  session scratchpad pattern described in `handoff-rez-b-live-migration.md` §2.
- Boundary tests are not optional and must assert at the outside edge, not on
  a helper (closed-loop; AGENTS 16): the contact card's counts render with
  **no** `email_primary` / `phones` / `contact_name` / `contact_role` anywhere
  in the HTML for a caller without entitlement; the sanctioned banner appears
  in **every** tab's HTML; `rfq_create` refuses a sanctioned supplier.
- Verification gate, all four commands, raw output compared to the baselines
  in `CLAUDE.md`. `pnpm test` needs Node 21 or 22, takes about 25 minutes, and
  sits a long time on one CPU-bound suite near the end — that is not a hang.
- End with the closed-loop protocol and stop at `ACCEPTED_FOR_HUMAN_REVIEW`.
  Then the three gates, asked for one at a time and never chained: land on
  `development`, promote to `main`, deploy. The migration goes before or with
  the deploy, never after.

## 4. Hard limits (unchanged)

Never touch `37.49.227.151`; no `ssh`, no `rsync`; never write `.env`; never
apply a migration, run `--apply`, merge, or trigger a deploy — print the
command and stop. Supabase MCP is read-only. Replies five lines or fewer,
plain words. Every Linear issue, PR and SHA carries a plain description on
first mention.

## 5. Prompt for the new session (paste this)

Build REZ-C — the company profile (supplier record sheet and product line) —
the third of nine pieces in the buyer dashboard v3.2 plan. Read
`context/feature-specs/handoff-rez-c-start.md` first, then the sections of
`handoff-dashboard-v3.2-implementation.md` it names (§3.3, §3.4, §3.5, §4.3,
§4.5, §7) and nothing else of that file. Branch from `development` once
PR #166 has landed. Run the closed-loop protocol to
`ACCEPTED_FOR_HUMAN_REVIEW`, then ask me for each of the three gates
separately. Never apply the migration, merge or deploy yourself — print the
command for me. Keep every update to five lines or fewer, in plain words.
