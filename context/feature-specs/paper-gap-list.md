# Paper gap list: what Paper draws that the product cannot do yet

Founder, 5 Oct 2026: "we must have everything that Paper has; if a feature is not in the code, we create it."
Until now each v4 screen was built from the data that exists and the rest was left out (the "Differs from
Paper" notes in section 10 of `handoff-ds-v4-build.md`, B1 to B7). This list turns those notes into work.
Each item needs a new read, column, route or table, so each one is a spec of its own (AGENTS rule 2), and each
migration waits for `--apply` approval (AGENTS rule 15). Items that touch sign-in, sessions or row-level
security are Opus's (handoff section 5a).

## Needs a database change (a new column, table or RPC)

| # | What Paper draws | Where | What is missing |
| --- | --- | --- | --- |
| 1 | HS code on a product, the HS picker, "1,408 suppliers export this" | Product editor, new product | a product has no HS code; a picker read over `hs_catalogue` |
| 2 | HS code and RFQs columns on the product list | Products | `buyer_product_list` returns neither; RFQs per product |
| 3 | Size chart per size with Grade; Unit on materials; "Paste from a spreadsheet" | Product editor | the stored shape has one Base column and free-text quantity |
| 4 | Team and roles: invites, Owner / Approver / Editor / Viewer, last active, resend, cancel | Settings | no members, invites or roles tables |
| 5 | Audit log: who did what, and when | Settings | nothing records it |
| 6 | Security: two-step sign-in, where you are signed in, sign out everywhere else, SSO | Settings | auth work (Opus) |
| 7 | Plan and usage: "This month" counts (RFQs sent, suppliers saved, evidence packs) | Settings | a monthly count read |
| 8 | Evidence pack download dialog; evidence packs for auditors | Compliance, Settings | no export exists |
| 9 | Unread dots, "Unread · 2" tab, "Read" ticks, attachments | Messages | `thread_list` and `thread_messages` carry no read state or files |
| 10 | Sanctions changes "Always on" row; Slack and Teams | Settings, Emails | no setting holds either; nothing sends |
| 11 | Draft statement saved, versions, PDF and DOCX | Modern slavery statement | the statement is composed in the browser only |
| 12 | "None of the 11 is on the lists we read", lists-last-read date, our copy of the list (date, entries) | Compliance | no read gives them |
| 13 | Follow-up: "Not asked yet" column | Compliance | nothing records that a supplier was asked |
| 14 | Email me new matches; "Save your last search?" | Saved | no alert is stored or sent; no last search kept |
| 15 | HS codes "from the export records of N suppliers · checked 14 Aug 2026" | HS codes | the read carries neither figure |

## Needs a route or a screen, no new table

| # | What Paper draws | Where |
| --- | --- | --- |
| 16 | Download CSV | Saved, Compliance, Expiry |
| 17 | Saved search rename | Saved searches |
| 18 | A valid certificate in the first-certificate column | Saved (needs a read of valid certificates) |
| 19 | The hub's within-30-days split and "Coming up in 31 to 90 days" card | Compliance (the one count behind the badge must stay one number) |
| 20 | Phone "Product view" (read-only, then a sheet of simple fields) | Products |
| 21 | Preview-with picker in RFQ templates | Settings |
| 22 | Profile "Current password" (the API takes the new password only) | Settings (auth route, Opus) |
| 23 | Names for every HS chapter | HS codes |
| 24 | Async slot so the sidebar badge never waits on the layout | Shell (Opus) |

## Where the older gaps are

B1 to B6 notes are in section 10 of `handoff-ds-v4-build.md` under "Differs from Paper" and "What the data does
not hold". Any gap named there and not listed above should be added here when it is specced.

## How to work it

One spec per row (or per group that shares one table), in this order: the ones that change what a buyer can
do (4, 9, 14, 8), then the ones that make existing screens complete (1, 2, 3, 12, 13), then the rest.
Each spec names its migration; the migration is written and dry-run, and `--apply` waits for the founder.

## Data side written (dry-run, not applied)

- Row 4: `gap-04-team-and-roles.md`, migration `0111`. Sharing by role is 4b (Opus).
- Row 9: `gap-09-messages-unread-files.md`, migration `0112`.
- Row 14: `gap-14-saved-search-alerts.md`, migration `0113`.

## Screens built

- Row 4: Team and roles page, Invite people, the invite email and `/invite/[token]` built (Sonnet, 5 Oct, PR into `ds-v4`); works once 0111 is applied.
- Row 16: Download CSV on Saved, Compliance and Certificate expiry built (Sonnet, 5 Oct, PR into `ds-v4`); one route, no migration.
- Row 17: Saved search rename built (Sonnet, 5 Oct, PR into `ds-v4`); `PATCH /api/v1/saved-searches`, no migration.
- Row 23: Names for every HS chapter built (Sonnet, 5 Oct, PR into `ds-v4`); 01 to 97 except the reserved 77; no migration.
- Row 21: Preview-with picker in RFQ templates built (Sonnet, 5 Oct, PR into `ds-v4`); twelve most recent saved suppliers; no migration.
- Row 20: phone Product view built (Sonnet, 5 Oct, PR into `ds-v4`); read-only view and an Edit sheet of six fields; the full editor is `?edit=full`; no migration.
- Row 18: A valid certificate in Saved's first-certificate column built (Sonnet, 5 Oct, PR into `ds-v4`); reads the existing 365-day window, no migration; certificates valid past a year are still "Nothing to check" until the read's cap is raised.
- Row 19: Compliance hub split built (Sonnet, 5 Oct, PR into `ds-v4`); three lines inside the one card, the one count and the badge unchanged; Paper's separate card is not drawn (see section 10).
- Row 9: Messages unread, Read ticks and files built (Sonnet, 5 Oct, PR into `ds-v4`); works once 0112 is applied; the sidebar badge waits on row 24.
