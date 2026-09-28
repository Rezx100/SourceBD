# Buyer app — the founder's 29 Sep dashboard video — hand-off

Written 29 Sep 2026 from the founder's screen recording
(`2567a399-086e-41ac-951c-494bce4994cf.webm`, 11 min 42 s, Bengali narration).
The video is on the founder's machine only and is not in the repo. The rough
English translation is the appendix, so you do not need the video. It was
recorded on the live build (`main` `d7e6c42`). Every file:line below was read
at `development` `237b511`; re-check before you rely on one (AGENTS 13, 16).

## Before you start

- Branch off `development` at `237b511` or later. Start with a clean tree.
- Load the impeccable skill (global CLAUDE.md). Surface `app-app-app`, mode
  Operate. Read `DESIGN.md`, `.impeccable/surfaces/app-app-app.md` and
  `lib/design/tokens.ts`. Do not read the 'must stay' spec
  (`ds-rebuild-must-stay.md`) whole; §3 and §9 are the only parts that matter
  here.
- Take screenshots without a server:
  `.impeccable/preview/search-first.cjs` (PAGE=landing|results|record|saved),
  then `shoot-sf.cjs`.
- One PR per group below, in this order (AGENTS 2). The founder said "fix these
  issues first" about speed and stability (10:53), so PR 1 needs no design
  decision. PRs 3 to 6 wait for the founder's picks from PR 2.

## Rules this review overturns

The design record contradicts the founder on seven points. Change the record in
the same PR as the code. Otherwise the next agent restores the old rule.

| Rule today | Where it lives | The founder now says |
| -- | -- | -- |
| Spent Green: brand green on the primary button, links, the active nav row (tint plus ring), the logo; `brand-tint-strong` on the open row, active filter chips and text selection | DESIGN.md Colors, "Named Rules"; surface brief OWN-WORLD | Green is overused and looks "tacky". It stays, but rarely. Everything else takes colours from a Material colour system. (4:07, 11:10–11:43) |
| Search field: "its outline steps to `brand` with a 2px `brand-tint-strong` ring" | DESIGN.md Navigation, "Search field" | No green border and no shadow. Depth comes the Material way, not from a shadow or a gradient. It should look native. (0:10–0:46) |
| Locked contact block: a 135° stripe (`.locked-pattern`); "stripe the block" | DESIGN.md Shapes, Record Sheet, Do/Don't | Diagonal stripes are banned everywhere on SourceBD. (8:56–9:23) |
| A row with no mark gets a dashed pending square | DESIGN.md Do (28 Sep) | It looks like a tick box you must click. Use a custom icon instead. (9:23–9:46) |
| Wrapping Name: names use `overflow-wrap: anywhere` and never truncate | DESIGN.md Typography | Names that wrap onto two lines, or break mid-word, "cause a lot of issues". See question Q1. (4:29) |
| Icons are Phosphor regular. The agent brief allows "no new icon sets unless approved" | DESIGN.md Do; `context/agent-brief.md` | The founder asked for a custom icon set to replace the generic ones (9:36–10:00). That is the approval. Draw the icons as in-repo SVGs; add no package. |
| Type scale: body 14, table 14, sublines 13, sidebar 13, captions 12, eyebrow 11 | `lib/design/tokens.ts:209-215`; DESIGN.md Hierarchy | Everything is too small and there is room to spare. Make it bigger across the app. (2:17–3:19) |

"Material" here means Material 3 principles built into our own tokens: tonal
surface containers, state layers and colour roles. It does not mean MUI or any
new package (AGENTS 4). See Q3.

## PR 1 — stability and speed (no design decision)

**1.1 The whole app scrolls when a record tab is clicked (7:28–8:01).**
Clicking "Products" makes the results' filter bar slide off the top and leaves
an empty strip at the bottom.
- Cause: `SheetTabs` renders `<a href="#products">` (`sheet.tsx:189-191`), and
  the hrefs are built at `build-models.ts:1291-1300`. Following a fragment
  scrolls every scrollable ancestor, including `overflow:hidden` ones. The only
  clamp is `md:overflow-hidden` on the AppShell root (`app-shell.tsx:255`),
  which stops user scrolling but not programmatic scrolling.
- Fix both places:
  - Intercept the tab click and scroll only the pane's own scroller
    (`SheetScroll`, `sheet.tsx:162`), allowing for the sticky tabs. Use
    `replaceState` rather than a history entry. Keep the href for no-JS.
  - Make ancestors that should never scroll `overflow-clip`, not
    `overflow-hidden`. `clip` refuses programmatic scrolling too, so any
    fragment or `scrollIntoView` elsewhere is covered as well.
- Guard: a test that the shell root and the workbench carry `overflow-clip`,
  and that the tab links carry the handler.

**1.2 Worker figures overlap the row's Save and RFQ icons (3:45–4:01).**
- `RESULTS_COLUMNS` (`results-table.tsx:53-56`) gives Workers 100px, which
  leaves 68px for text after `px-4`. The `WorkersCell` subline (e.g. "11,119
  with buildings") is `whitespace-nowrap` and about 130px wide
  (`workers-cell.tsx:29-31`), so it spills into the actions column.
- The compact actions column (64px, 48px after `px-2`) holds two 28px buttons,
  so it overflows on its own too.
- Fix the arithmetic in wide, compact and composer-open layouts at 1280 and
  1440. Shoot all three.

**1.3 Names break mid-word ("Benchmar k", "Internation al", "Narayangan j")
with the RFQ form open (10:54–11:30).**
- `[overflow-wrap:anywhere]` sits on the name wrapper and link
  (`results-table.tsx:193,201`). With the composer open, the table is
  `min-w-[28rem]` and the supplier column is about 132px.
- Break at word boundaries only. Give the name column room (see 6.1). The
  fuller treatment depends on Q1.

**1.4 Opening things is slow (1:35–2:17, 10:13–10:22, 10:47).** The founder:
"it has to be lightning fast". The VPS has power to spare, so the cost is round
trips, not CPU. Measure first: click-to-content times on the live site for
home to results, open record, open line and Send RFQ. Put the before and after
numbers in the PR. What is known:
- `discover/page.tsx` is `force-dynamic` (:85). Every URL-parameter change
  (open record, open line, `?rfq=`) re-runs the whole page:
  - the search itself, cached 2 min (`search-cache.ts:49-63`);
  - `supplier_epb_hscodes_batch` (:170), not cached;
  - `saved_suppliers` (:171-179), not cached;
  - plus the pane's own reads.
- Opening a line runs the record reads twice: `DiscoverRecord` calls both
  `loadRecordSheet` and `loadRecordLine` (:439-459). `loadRecordLine`
  (`load-record.ts:347-361`) re-reads the profile, the HS codes and the
  workers. Load once and share the result (React `cache()` or pass it down).
- The pane's `<Suspense>` is keyed `${slug}:${line}:${all}` (:369-376), so
  opening a line remounts the pane and shows `RecordSkeleton`. Key the record by
  its slug and stream the line inside it.
- Send RFQ: the composer branch (:330-340) has no Suspense. `LinkPending`
  (`controls.tsx:144-147`) spins until the whole page resolves. Give the
  composer its own boundary so it paints at once.
- Line tiles use `prefetch={false}` (`photo-tiles.tsx:190`), and so does the
  landing form (`search-landing.tsx:103-107`, `app-shell.tsx:151`). Home to
  results also shows `discover/loading.tsx` because it is a new segment.
- `middleware.ts` runs three round trips before the page starts, on every
  navigation: `auth.getUser` (:88), the rate-limit `rlCheck` (:96, with
  `/app/discover` classed `api_read` in `lib/rate-limit/limits.ts:79`) and a
  `profiles` select (:195). Time them. Do not drop the auth or the rate limit
  to save time (AGENTS 7). Ask before changing either.
- Guard: a route test that opening a line calls the profile read once.

**1.5 Source logos pop in while scrolling the line view (10:22–10:32).**
- A logo mark is a CSS `maskImage` span (`marks.tsx:59-79`). It is an empty
  square until its PNG arrives. The files are
  `public/icons/sources/**/*.png` (0.8–11.5 KB, mapped in
  `lib/dashboard/source-logos.ts:9-22`), and nothing preloads them.
- Preload them once in the buyer layout, or inline them.

**1.6 Small display defects I found (the founder did not mention them).**
- The "Registers & certifiers" header wraps: a 150px column (120px compact)
  minus padding and the sort caret (`results-table.tsx:153`).
- Two data problems. Both are data changes: the dry run first, then the founder
  applies it (AGENTS 15). Not in this PR:
  - "(B)" is a literal item in `suppliers.principal_products` for 335
    published suppliers, always the second entry.
  - The GOTS certifier "Clean Globe Globe International (Pty) Ltd" appears on
    38 `certifications.issuer` rows. The scraper copies it as-is
    (`etl/scrapers/gots.py:240,316`). Check the GOTS register first. If the
    typo is the register's own, canonical-latest-wins applies (Q4).

## PR 2 — the decision page (the founder picks, nothing is built yet)

Build one impeccable decision page with two or three options each, drawn with
real records (use the long names in the 'must stay' spec, §3). The founder
picks once. Record the picks in the surface brief, DESIGN.md and `tokens.ts`.

1. **Colour roles.** A Material-style tonal system: surface containers, a
   neutral or secondary role for selection, the active nav, chips and focus,
   and green only for the one primary action per screen and the logo. The
   status hues (positive, caution, danger, sanction) stay as they are. Add
   every new pair to `contrastPairs`.
2. **The search field.** Tonal depth with no outline, no glow and no shadow.
   Show its focus and hover states.
3. **Filters.** Replace the four labelled pill rows (PRODUCT / CERTIFICATE /
   PLACE / COMPANY) and the chip bar. The founder wants them "precise, noise
   free, easy, not confusing" (0:46–1:35). For example: one row of facet menus
   with counts inside, versus a single facet bar.
4. **The type scale, one step up.** For example: body 15, table 15, sublines
   14, sidebar 14, captions 13. Show it at 1280 and 1440, with the record open.
5. **The custom icon set.** Its scope and style: source pending, open record,
   save, send RFQ, expand, sidebar collapse, and the icons that replace text in
   the record (5.2). Draw it on Phosphor's grid so it sits with the icons that
   stay.
6. **The record head.** Each source shown once (5.1).
7. **Q1 and Q2**, shown side by side.

## PR 3 — the shell: sidebar, account, full view

**3.1 A sidebar collapse switch, and a redone sidebar (4:37–4:55).**
- No collapse exists today (`app-shell.tsx:51-131`, nav in
  `sidebar-nav.tsx:58-75`). The founder: "very poorly done", "no proper
  contrast".
- Build an icon-only rail with a toggle. Remember the state in a cookie so the
  server draws the same state (no flash).
- Restyle it with the PR 2 colours. The active row loses its green tint and
  ring (`sidebar-nav.tsx:69`).

**3.2 The account corner (5:33–6:02).**
- It is a plain link to `/app/settings` (`app-shell.tsx:94-113`). It shows the
  full email because `account.name` is empty (:108). The plan line comes from
  `load-buyer-shell.ts:85,133`.
- Both avatars show initials only (`app-shell.tsx:207-216` and the rail). A
  photo upload exists (`settings-avatar-form.tsx`, and the old shell's
  `components/shell/user-avatar.tsx`), but the shell loader never reads
  `avatar_url`.
- Make it one account menu: photo, name (or the email's name part), Settings,
  Subscription, Sign out. Wire the photo into both avatars.

**3.3 Expand the record (6:09–6:43).** The founder wants two states: the record
filling the content region beside the sidebar, and the record with no sidebar
at all.
- The pane bar has no expand control (`supplier-sheet.tsx:138-157`). The
  pattern exists as a ghost "Full page" button (`rfq-pages.tsx:604-606`,
  `orders.tsx:569`).
- Page mode exists at `/app/suppliers/[slug]` (`mode="page"`,
  `sheet.tsx:62-70`), and `fullHref` is set at `discover/page.tsx:443`.
- Add Expand to the bar. Carry the search so Back returns to it. Combined with
  3.1's collapse, that gives the full-screen view.

**3.4 Do not touch the logo or the wordmark (4:55–5:22).** Both are
placeholders, parked for the animation step.

## PR 4 — search landing and results list

- **4.1 The search bar** (0:10–0:46), per PR 2.2. The classes are on the
  `<Form>` at `search-landing.tsx:108`; the topbar field is `app-shell.tsx:166`.
- **4.2 Filters** (0:46–1:35), per PR 2.3.
  - Landing: `search-landing.tsx:125-150`, with the data in
    `lib/dashboard/search-templates.ts` (`QUICK_FILTERS` :87-117).
  - Chip bar: `search-composer.tsx:56,76,98,180`; chip tone `on` is
    `chips.tsx:21`.
- **4.3 Bigger text and logo tile** (2:17–3:19), per PR 2.4. The initials
  tile is `LogoTile size="sm"` (24px, `marks.tsx:149`). The founder wants it as
  tall as the name plus its "Factory · Gazipur" line.
- **4.4 An open icon people recognise** (3:19–3:37). "I didn't know I need to
  click that icon to expand the full profile." Today it is
  `Icon name="pane"`, which is Phosphor `SidebarSimple`
  (`results-table.tsx:263-276`), hidden when compact. Use the custom icon, with
  a visible label on hover and focus.
- **4.5 The open row** (4:01–4:15). It uses `brand-tint` plus brand hairlines
  (`page.tsx:317-321`), and the selected row a brand inset rule (:318-321).
  Restyle both with the PR 2 colours.
- **4.6 Names on two lines beside the record** (4:29–4:37). The compact
  columns are `[40, null, 120, 92, 64]`. Apply Q1.

## PR 5 — the record

- **5.1 The source marks fight each other (6:53–7:20).** "RSC, then RSC again…
  BGMEA again… I'm getting confused. Don't reduce data." The head shows a
  source up to three times:
  - the marks row (`supplier-sheet.tsx:173`);
  - the meta line's inline marks, "793 workers [RSC]" and "BGMEA 6843 [mark]"
    (`build-models.ts:574-590`, drawn by `MetaLine` in
    `supplier-result-card.tsx:29-47`);
  - the Registers fact row (`build-models.ts:1247`).

  The row dedupes itself; nothing dedupes across the three. Show each source
  once in the head, per the PR 2.6 pick. Keep every fact.
- **5.2 Too much text, no hierarchy (8:01–8:33).** Cut most of the words.
  Carry facts with icons and signals, and lose no fact. On screen now:
  - the legend "A dashed square: source pending…";
  - "Illustrative photo, keyed to the HS code…";
  - "items on file · source pending";
  - "not on 4 brand lists read";
  - "registers and RSC checked";
  - the action bar's "Source marks link to their register page…".

  Explain once, in a tooltip or one legend.
- **5.3 The Products summary boxes waste space (8:33–8:56).** Three boxes hold
  one line; one holds five. `Stats` is at `supplier-sheet.tsx:233`, the box at
  `sheet.tsx:456+`.
- **5.4 Remove the stripes (8:56–9:23).** `.locked-pattern` is at
  `app/ds.css:97-106`. It is used in `LockCard` (`sheet.tsx:425`) and the
  gallery (`app/dev/ds/page.tsx:321`). Delete the pattern and its token, and
  change the DESIGN.md rules that require it.
- **5.5 Pending squares look like tick boxes (9:23–9:46).** `PendingMark`
  (`sheet.tsx:272-283`) becomes the custom icon, and `PENDING_LEGEND` (:297)
  shrinks.
- **5.6 Product photos (10:00–10:13).** "Not the proper way to view the
  product." These are stock photos keyed to the HS code
  (`public/products/hs/`, `lib/dashboard/hs-photos.ts:26-30`, `PhotoGrid` at
  `supplier-sheet.tsx:263`). Apply Q2.

## PR 6 — the RFQ form

- The founder calls it "okay but needs refinement" (10:53–11:10). It gets the
  green reduction and the new type scale.
- The wide pane (`clamp(640px,68%,1100px)`, `sheet.tsx:110`) crushes the list
  to 28rem. While composing, the list should become a slim rail or step aside,
  not a crushed table.
- The workspace note is at `rfq-composer.tsx:460-467`, the questions at
  :479-491, and the footer at :547-568.

## Questions for the founder (ask once, before PR 2 is built)

- **Q1 Long names.** One option: wrap at word boundaries and give the name
  column the width (recommended). About 1,630 names end in "Unit 2" or a
  bracket, and that tail is often the only thing telling sister factories
  apart (the 'must stay' spec, §3). The other: one line, cut with "…", and
  the full name on hover. That lifts the rule that nothing cuts a name.
- **Q2 Product photos.** Remove the stock photos until suppliers upload their
  own and show the export lines compactly (recommended), or keep them
  presented differently.
- **Q3 Material** means its principles built into our tokens, with no new
  package (recommended). Confirm.
- **Q4 Register typos** such as "Clean Globe Globe". If the register itself
  prints it, the register wins. Should we show it as filed, or correct it on
  display?

## How to check your work

- **Tests.** `pnpm exec tsc -p tsconfig.npm-test.json` (check the exit code;
  do not pipe it into `head`). Then run `node --test` on only the
  `.tests-build/**` files you touched. These cover this work:
  - `components/dashboard/{search-first,render,record-sheet,craft,links}.test.ts`;
  - `app/(app)/app/record-routes.test.ts`;
  - `lib/search-suggest.test.ts`;
  - `lib/design/tokens.test.ts`, which fails on any hand-typed colour or a
    pair below its contrast.

  Leave the rest to CI.
- **Screenshots** of every changed screen at 1280 and 1440, with the record,
  the line and the composer open. Put before and after in the PR.
- **Done** means merged by CI after one `/code-review` pass
  (`.cursor/rules/sourcebd-closed-loop.mdc`). The founder approves only the
  deploy.

## Appendix — the narration, translated

A rough machine translation from Bengali. "Source" often means "search",
and "source bt" is SourceBD.

```
00:00 Now I will talk about the rest of the issues the SourceBD dashboard has. Let's dive into the app first.
00:10 The first is the search bar, which is okay, but there is this green border line on the search bar with a shadow.
00:22 I want you to use Material design here and blend it so it has visual depth, but not achieved by shadow or colour gradient.
00:38 It must be very, very native design so it looks proper. And it's a very noisy interface: you have enabled a lot of pills
00:53 for searching specific things like place, certificate, company — which is good — but the filter should not look like this.
01:09 The filter should be more precise and noise-free, and it should feel easy to use, not confusing. That is the main concern here. Redesign it.
01:35 Let's search — routed to this, which is fairly fast, but it must be faster, because we have a lot of power on the VPS.
02:03 The routing speed, the navigation speed, is not there yet.
02:10 The company name and the alignment look okay, but I want you to increase the size of the font overall a little so it's properly visible.
02:34 And the company logo should be the same height as "SM Sourcing" plus "Factory · Gazipur", or use visual hierarchy.
02:49 The overall goal is to increase the sizes of elements that are too small and hard to read. We have a lot of space sitting there.
03:19 The main issue: expanding the company profile is very confusing. I didn't know I need to click that icon to expand the full profile.
03:28 Use familiar icons that represent an open action.
03:37 The UI is overlapping: 2,700 is overlapped by the Save and Send RFQ buttons. Here is another overlap. Fix the overlaps.
04:01 This green border, this green shadow, is not looking good. Use a different approach. The brand green stays, but no overuse
04:21 of brand green on the interface; it must be moderate. Also the big company names are breaking into two lines — that is causing a lot of issues.
04:37 There is no collapsible sidebar. There should be a sidebar switch. The overall sidebar is very poorly done — no proper contrast.
04:55 The logo and the wordmark are our placeholders. Do not touch them; keep them on the list — we will generate the animation in the next step.
05:22 Now fix these sections: the full email address is showing here, the owner photo is not visible on the profile icon,
05:40 and I don't know what happens when I click here — settings? payment? Clear the confusion first, then redesign this section,
05:56 coherent with the overall SourceBD design.
06:02 Now the supplier record section. There is no way to full-screen just this part — view only the supplier record, no sidebar, nothing.
06:23 At least with the sidebar, maybe I want to expand this to full view — with the sidebar collapsed or expanded.
06:43 The logos are okay now, distributed and aligned, but they are fighting each other: RSC, then RSC again, RMG Sustainability Council,
07:01 then again BGMEA here — what is going on? I'm getting confused. Address this properly. Do not reduce data, but present it so the user is not confused.
07:20 This part is very poorly done. In the product section, if I click here, a bar shows up — an empty bar — just from clicking this icon/link.
07:39 It should not trigger viewport movement. It must be really stable. The dashboard must be very stable when the user interacts.
08:01 There is a lot of text, no hierarchy; it's text heavy. Reduce most of the text, 95% of it, and use icons and signals that show the user
08:16 the data without compromising the data. The goal is less text and proper hierarchy.
08:33 This section is very confusing and text heavy. These boxes waste a lot of real estate: three boxes have three lines and this box has a lot of lines.
08:56 Make it clear, not text heavy. Also the contact details: this dashed cross-line design — please do not do that anywhere in SourceBD.
09:11 It should be high-quality Material design; this 90s blog design is not allowed.
09:23 The registration section: these boxes look like I need to click them to tick. Why is that design there?
09:36 Generate a high-quality custom icon set to replace these generic designs. These are not allowed; implement custom design here.
10:00 The pictures shown here are not the proper way to view the product. And if I click on a product it takes a lot of time — really slow loading.
10:22 Please fix that. And when I scroll, the icon is moving here. The overall design is poor and to be fixed.
10:47 You see, the routing is really slow. Then click Send RFQ — this has to be lightning fast, not like this. Fix these issues first.
10:53 The overall design here is okay but needs to be refined properly. And the greens here, and here — everywhere — need to be readdressed
11:16 with other Material colours, a Material design system. The green will stay but be used rarely.
11:32 With green used everywhere it looks like a tacky website.
```
