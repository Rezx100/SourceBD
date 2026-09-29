# Buyer app — one-line names, fact icons and what is left — hand-off

> **Superseded on colour (founder, 29 Sep 2026, after this shipped):** no slate.
> Where this says slate (the icons, the open account row, the state marks),
> read greys and near-black: icons `ink-muted`, state the hueless `accent`
> role. `DESIGN.md` (Colour) and `.impeccable/surfaces/app-app-app.md` hold it.

Written 29 Sep 2026, after the six PRs of `handoff-dashboard-video-29sep.md`
(the founder's 29 Sep dashboard video) were built and merged to
`development`. The founder then sent two screenshots of the live build and two
instructions, below. After those PRs went live (`main` `79a59f8`, deployed 29
Sep 03:04 UTC, smoke test passed) the founder reviewed the live app and sent
nine more issues: see "The founder's review of the live build". Everything
else in this file is what the video hand-off left unfinished. Every file:line
below was read at `development` `f7a18b4` (after PR #203); re-check before you
rely on one (AGENTS 13, 16).

## The founder's two instructions (29 Sep 2026, verbatim)

> 1. company name must not break into a lot of lines it must be single line,
>    apply a fix that apple or Microsoft will do on their software, check
>    mobbing for references.
> 2. the text needs visual and color hierarchy and most importantly icons for
>    address on the company, group, entity, company and things if that nature
>    that deserves a icon.

"mobbing" is Mobbin (the UI reference library; this machine has its MCP:
`search_screens`). The founder also said "I like everything you recommended",
so the defaults below are decisions, not open questions. Build them.

The two screenshots were taken on the live build before the video PRs shipped
(`main` `d7e6c42`):

- **Screenshot 1** — the search list beside an open record (compact columns).
  "Zaheen Knitwears Limited (Shed - 3, 4, 5, 10, 11, 12, 13) & (Building -
  Security, ETP and Fire Pump)" takes six lines, and "S M Knitwears Limited",
  "A.R. Fashion" and the place lines wrap too. Rows are uneven heights.
- **Screenshot 2** — the record's Overview facts (Company: Registered name,
  Type, Parent group, Established; Location: Factory address; Workforce and
  capacity: Workers). Every label and value is the same weight and colour, the
  mono uppercase group headings are the loudest text, and nothing carries an
  icon.

Neither is fixed by the video PRs: names still wrap by design (the founder's
earlier Q1 answer), and fact rows still have no icons. The video PRs did add
the SourceBD icon set this work needs (`components/dashboard/sb-icons.tsx`).

## The founder's review of the live build (29 Sep 2026, after the deploy)

The founder's words, verbatim: "below content bleed the section nav bar",
"certification section very text heavy", "search sidebar view on the rfq page
it text heavy and breaks into many line", "here is another ui bleedings issue",
"this sidebar section is still really under done and low quality design"
(items 8 and 9 quote their own). The ten screenshots show, on the live build:

1. **The record's section tabs, scrolled (Products).** Product photos of rows
   that have scrolled up paint over the sticky tabs; a photo hides "Overview".
2. **The search list's sticky header, scrolled (wide table, 1280+).** Source
   marks and row text show over the header. "Registers & certifiers" wraps
   onto two lines with the sort caret on top of its words; "Export lines"
   wraps too.
3. **The sort menu of the list beside the RFQ composer.** It opens with the
   rows' names and initials tiles painted over its items.
4. **Certificates.** Every card prints the scheme, the number, the status,
   every Operations and Products part, the certifier and a link. The two
   OEKO-TEX cards each repeat "Scope OEKO-TEX STANDARD 100"; a "WRAP Gold" card
   says "Scope Gold". Far too much text.
5. **The list beside the RFQ composer.** Its header ("pants · Sanctioned
   hidden", "1,120 suppliers · 51–75") wraps onto five lines beside the sort and
   save icons, and the names wrap.
6. **Send RFQ shows "⌘↵" on Windows.**
7. **The sidebar's foot** ("admin ⌄" over "Free … public beta") looks plain
   and unfinished.
8. **The results' card view.** "we also need a big refinement of the card
   view because it really text heavy with no visual hierarchy." One card for
   "Modele De Capital Ind Ltd" is about 400px tall: a 48px tile, the name, nine
   source marks and "9 sources"; three bordered buttons (Save, Open record,
   Send RFQ); a facts line that wraps ("Factory · Dhaka, Narayanganj · Est.
   2009 · 1,300 workers · on the supplier record · 3,546 workers · across this
   record and its buildings · 9 registers & certifiers"); four status chips;
   four tiles (Certificates, Export lines, Listed by, Registers) that repeat the
   chips and the marks; six 132px product photos with captions and a note.
9. **The card view beside an open record.** "also the open record view of the
   card view section gets really cramped and ux become nighmare." With a record
   open, the same cards are squeezed into the results column (about 650px at
   1375): the facts break into one fact per line, the three buttons wrap under
   them, the four tiles stack two by two and the photos are cut off.

**The root cause of 1, 2 and 3** (found 29 Sep): `tailwind.config.ts` sets
`theme.zIndex` (line ~100) to the token scale in `lib/design/tokens.ts`
(`base` 0, `raised` 10, `sticky` 100, `overlay` 200, `modal` 300, `toast` 400),
and a theme key replaces Tailwind's numeric scale. So `z-10`, `z-20` and
`z-50` compile to nothing. The compiled CSS has no `.z-10{` and no
`xl\:z-10`, while `.z-raised{` is there. That is 77 uses in 40 files. In the
buyer app: the section tabs (`sheet-tabs.tsx:63`), the sticky table header
(`page.tsx:219`, `results-table.tsx:161`), every `Menu` (`controls.tsx:418`:
sort, density, per page, the filter menus), the report-a-problem popover
(`report-problem.tsx:84`), the selection bar (`selection-bar.tsx:143`), the
row's Open tooltip (`results-table.tsx:323`), `products.tsx:233,245`, the skip
link (`app-shell.tsx:267`), and the onboarding tour's scrim
(`components/onboarding/tour.tsx`, `fixed inset-0 z-50`). A test pins that
last class (`search-first.test.ts:151`), which is why the guard passed while
the class did nothing. Each of those elements has had no z-index at all, so
anything positioned later in the page paints over it.

## Before you start

- Boot lean (AGENTS 3), then load the impeccable skill (global CLAUDE.md).
  Surface `app-app-app`, mode Operate. Read `DESIGN.md`,
  `.impeccable/surfaces/app-app-app.md` (the section "The founder's video, 29
  Sep 2026" has the seven design picks) and `lib/design/tokens.ts`.
- Branch off `development` at `f7a18b4` or later, with a clean tree (AGENTS 11).
- Five PRs, in this order (AGENTS 2): **0** the bugs on the live site (content
  bleeding over sticky bars and menus; header labels; the "⌘↵" hint), **A**
  one-line names (with the list beside the RFQ composer), **B** fact hierarchy
  and icons (with Certificates), **C** the card view, rebuilt on A and B, **D**
  the leftovers (with the sidebar's foot). PR 0 is small and visible on the
  live site; ship it first. A, B and C all touch the same name and facts
  components, so do not run them in parallel.
- Screenshots without a server (the dev server is unusable here; see memory
  "Local dev server unusable"): `.impeccable/preview/video29.cjs` renders
  PAGE = results | results-menu | record | record-collapsed | full | line |
  rfq | landing | landing-menu | account, and
  `node .impeccable/preview/build-shell30.cjs [pages…]` shoots them at 1280 into
  `.impeccable/review/shell30/`. Both files are gitignored and exist only on
  this machine (`E:\SourceBD`). They render from `.tests-build`, so run
  `pnpm exec tsc -p tsconfig.npm-test.json` first. Add 375 and 768 viewports
  to the builder for the phone and tablet shots this hand-off asks for.
- Tooling that tripped the last session (Windows):
  - Git and `gh` from PowerShell; Git Bash here has no `git`, `grep` or `awk`.
  - Lint with `node node_modules/eslint/bin/eslint.js <files>` and
    `ESLINT_USE_FLAT_CONFIG=false`. The pnpm PowerShell shim joins the file
    arguments into one string and eslint then finds no files.
  - A new `*.test.ts` must be added to the explicit `files` list in
    `tsconfig.npm-test.json`, or it never compiles.
  - The guard hook refuses force pushes. When a PR's base branch is squashed
    into `development`, replay its commits onto a new branch from
    `origin/development` with `git cherry-pick`, and check the tree matches
    with `git diff --stat <old> <new>`.
  - In PowerShell, do not build multi-line replacement strings with `+`
    inside an `@(…)` array literal (the comma binds first and the edit
    silently corrupts the file), and do not put `` `a `` in a double-quoted
    string (it is the bell character). Use the Edit tool for multi-line edits.

## Rules this overturns

Change the record in the same PR as the code, or the next agent restores the
old rule.

| Rule today | Where it lives | The founder now says |
| -- | -- | -- |
| The Wrapping Name Rule: a name wraps between words, never truncates; every name column keeps room for its longest word | DESIGN.md Typography, Named Rules (~line 408); Key Characteristics "Names wrap at every size; nothing truncates a company name" (~333); Ledger Grid "a name wraps between words and never ellipsises" (~490); Don't "truncate a name with an ellipsis" (~542); surface brief, Q1 answer (29 Sep) | One line, the way Apple and Microsoft do it. (29 Sep, after the video PRs) |
| Facts are plain label and value rows with a mark at the end; group headings are mono uppercase eyebrows | DESIGN.md Record Sheet; `FactsPanel` in `components/dashboard/sheet.tsx` (~289) | The text needs a visual and colour hierarchy, and icons for the facts that deserve one. |
| A certificate is a card that prints every part of its scope ("laid out as the register's own labelled parts (Operations, Products)") | DESIGN.md Record Sheet; `CertCard`, `CertScope`, `CertGrid` in `sheet.tsx` (~487-560) | "certification section very text heavy." One line per certificate; the scope on demand. |

The test guards that enforce the old name rule, all to be rewritten in PR A,
not deleted blindly:

- `components/dashboard/render.test.ts:101-102` `TRUNCATION`, used at 164,
  205, 327, 523, 970, 1181, 1206, 1215, 1230, 1503, 1526. Most of those pages
  also contain chips, facts and captions that must still never be cut. Narrow
  the guard so it exempts only the elements that carry a name (mark them, for
  example `data-name=""`), and keep it for everything else.
- `render.test.ts:1483-1505` "the 125-character name… print it whole and let
  it wrap": keep "the whole name is in the DOM and in the accessible name";
  replace "wraps" with "one line, cut with an ellipsis, full name on hover".
- `components/dashboard/pane-stability.test.ts:175-195` (the supplier column
  keeps its longest word whole at the table's minimum width) and its header
  comment: replace with a guard that the name cell truncates and a row never
  grows past two lines.
- `components/dashboard/compliance-settings.test.ts:112` refuses `truncate`
  on its page; check whether a supplier name appears there before changing it.

## PR 0 — the bugs on the live site (do first)

**0.1 Nothing may paint over a sticky bar or an open menu.** Replace every
numeric z-index class in the buyer app with the token that says what it is:

| Element | Today (compiles to nothing) | Use |
| -- | -- | -- |
| The record's section tabs (`sheet-tabs.tsx:63`) | `z-10` | `z-raised` |
| The sticky table header (`page.tsx:219`, `results-table.tsx:161`) | `[&_thead_th]:xl:z-10` | `[&_thead_th]:xl:z-raised` |
| Every `Menu` panel (`controls.tsx:418`), the report-a-problem popover (`report-problem.tsx:84`), the row's Open tooltip (`results-table.tsx:323`) | `z-20`, `z-10` | `z-overlay` |
| The selection bar (`selection-bar.tsx:143`) | `z-20` | `z-sticky` |
| The product row's inline controls (`products.tsx:233,245`) | `relative z-10` | `relative z-raised` (check what they must sit above) |
| The skip link (`app-shell.tsx:267`) | `focus:z-50` | `focus:z-toast` |
| The onboarding tour's scrim (`components/onboarding/tour.tsx`) and its card | `z-50` | `z-modal`, card above it; fix the comment at `app-shell.tsx:191` and the pin at `search-first.test.ts:151` |

PR 4 worked around the same bug for the filter menus without finding it:
`relative z-[1]` on `SearchComposer` (`search-composer.tsx`) and `isolate` on
`Panel` (`results-panel.tsx`). Once `Menu` is `z-overlay`, drop the `z-[1]`,
and keep `isolate` only if the scrolled-header check below still needs it.

Then add the guard that would have caught it. `lib/design/tokens.test.ts`
already walks the design-system files for hand-typed colours (`OLD_PALETTE`,
~line 88). Add a second pattern there that fails on any numeric
`z-<number>` class (plain or behind a variant, e.g. `xl:z-10`,
`[&_thead_th]:xl:z-10`) in `components/dashboard/`, `app/(app)/app/` and
`components/onboarding/`, with a message naming the token scale. Also check
that `.z-raised{`, `.z-sticky{` and `.z-overlay{` are in the compiled CSS of
the harness build, as a one-off.

Outside the buyer app (the marketing site, the old shell, `components/ui`)
there are about 60 more. Those pages were built and reviewed with the classes
doing nothing, so switching them on can change what the founder has already
approved. Do not change them in this PR. List them in a Linear issue with
before and after screenshots of the marketing home, then decide there.

Verify with the harness: scroll the record under its tabs on Products (photo
rows) and Certificates, scroll the wide list under its header at 1280 and
1440, and open every menu over rows (sort, density, per page, each filter
menu, the rail's sort beside the composer). Nothing may show through or over.

**0.2 Table header labels fit on one line and nothing sits on them.** At the
app's new text size, "Registers & certifiers" (wide) and "Export lines" wrap,
and the sort caret lands on the words. Rename the wide header "Sources" (the
compact table and the record already say "Sources"), and size or rename
"Export lines" so it fits its column with the caret. Keep the test that no
header is held to one line with `whitespace-nowrap`
(`dashboard-screens.test.ts:354`); add one that each header label's measured
width at 13px plus the caret fits its column (measure in Geist, as
`pane-stability.test.ts` does).

**0.3 The Send RFQ hint says the buyer's own keys.** `rfq-composer.tsx:572`
always prints `⌘↵`; the handler (line 306) already takes Ctrl+Enter. Show
"Ctrl ↵" unless `isApplePlatform` (`topbar-search-slot.tsx:31`, the helper the
topbar's `ShortcutHint` uses) says Apple, and keep the screen-reader hint in
step. Fix the file's header comment (line 14) too.

## PR A — company names on one line

**What Apple and Microsoft do** (paraphrased from their platforms, not
quoted): in lists and tables, text stays on one line and is cut at the end
with an ellipsis, so every row is the same height and the eye can scan down a
column. The full text is never lost. macOS shows it in an expansion tooltip
when the pointer rests on a truncated cell, and in the detail view. Finder
cuts long file names in the middle so the distinguishing end stays visible.
Outlook's message list and Windows Explorer's details view cut subjects and
names at the end and show the whole text on hover. Nothing wraps inside a list
row.

**Mobbin references** (web):

- One line in the list, the whole title in the detail pane:
  [Asana split view](https://mobbin.com/screens/95628ff8-7999-4c30-9820-5924b8fd9c59),
  [Evernote notes list](https://mobbin.com/screens/bbacc3f5-731d-4591-8dd2-2ba6d92e4f5d),
  [Midday documents](https://mobbin.com/screens/016b019a-db13-4a2f-a14b-50b5a339ce93).
- Company tables with one-line names and cut addresses:
  [Twenty companies](https://mobbin.com/screens/f8bd66b5-e935-465b-93d6-cf2f74b3c078),
  [Attio companies](https://mobbin.com/screens/2d5eaf6b-ce01-4a0c-a514-8df3c9f87c2c).
- Cut in the middle so the end survives, as Finder does ("Shareholder
  Cer…h - JMobbin.pdf"):
  [Cake Equity documents](https://mobbin.com/screens/57e1bb7b-2e69-4a72-bb3d-f35f4a6cb513).

**The data** (production, read-only, 29 Sep 2026; re-run the query below
rather than writing a new one, AGENTS 14):

- 10,266 published suppliers. Name length: median 21 characters, 90th
  percentile 31, 99th 44, longest 100. 1,126 names are over 30 characters and
  85 are over 45.
- 212 names end in a bracket. 12 of those are "(Bangladesh)", "(BD)" or
  "(Pvt.)" and are part of the name; the other 200 are a qualifier: a unit
  ("(U-2)", "(Shafipur Unit)", "(New Unit)"), a building ("(new building)",
  "(Extension)"), a division ("(Textile Division)"), a group or parent ("(
  INDET GROUP)", "(Concern of Orba Bangladesh)", "( A sister concern of R.PH.
  Label & Accessories)"), a former name ("(Previously THE ROSE GARMENTS
  DESIGNERS LTD)"), or several joined ("Zaheen Knitwears Limited (Shed - 3, 4,
  5, 10, 11, 12, 13) & (Building - Security, ETP and Fire Pump)"). 62 names
  say "unit"; 25 end in a unit number. The older hand-off's "about 1,630"
  counted differently; these numbers replace it.
- Some registers file an address inside the name ("Liz Fashion Industry
  Limited Holding-1, Block-C, Shaheed Mosharaf Hossain Road,"). Per Q4 the
  name is shown as filed; that is a data issue for the ETL, not this PR. File
  it in Linear.

```sql
select count(*) as published,
  count(*) filter (where company_name ~ '\)\s*$') as ends_in_bracket,
  count(*) filter (where company_name ~ '\)\s*$'
    and company_name !~* '\(\s*(bangladesh|bd|pvt\.?)\s*\)\s*$') as trailing_qualifier,
  count(*) filter (where length(company_name) > 30) as over_30,
  percentile_disc(0.5) within group (order by length(company_name)) as p50,
  percentile_disc(0.99) within group (order by length(company_name)) as p99,
  max(length(company_name)) as max_len
from public.suppliers where is_published;
```

**The decision** (build this):

1. **Every list, table row, card title, menu, picker and chip shows a company
   name on one line.** Cut at the end with an ellipsis (`truncate` with
   `min-w-0` on its flex or grid parent). The full name stays in the DOM, so
   a screen reader reads it whole, and goes in `title` so the pointer shows it
   (the macOS expansion-tooltip pattern). The row's accessible name (the
   `<tr aria-label>`) is already the full name.
2. **The qualifier moves to the second line, so sister factories stay
   apart.** This is Finder's "keep the end visible", done by structure rather
   than a middle cut. Add a pure `splitQualifier(name)` next to `displayName`
   in `lib/dashboard/facts.ts`: it returns the base name and the trailing
   bracketed group or groups as one qualifier (brackets dropped, groups joined
   with " · ", inner spaces trimmed; handle a missing space before the
   bracket, as in "Ltd.(Textile Division)", and a bare trailing "Unit-2" or
   "U-2"). It never splits "(Bangladesh)", "(BD)" or "(Pvt.)", a bracket in
   the middle of a name ("Indochine Apparel (Bangladesh) Limited, …"), or
   unbalanced brackets. Test it with the real names above.
   - Line 1: the base name, one line, `font-medium text-ink-strong`.
   - Line 2: qualifier · type · place, one line, the quieter style it has
     today ("Unit-2 · Factory · Narayanganj"; "Shed - 3, 4, 5, 10, 11, 12, 13 ·
     Building - Security, ETP and Fire Pump · Factory · Narayanganj", cut).
     Its `title` carries the full line.
   - Rows are then always two lines high: the list scans evenly (screenshot
     1's six-line row becomes two).
3. **The record's head (the detail view) shows the base name on one line at
   heading size**, cut only when it is longer than the pane (the rare 45+
   character base names), with the qualifier as its own line under it
   (before the facts line) and the full registered name in the "Registered
   name" row just below. That is where Apple and Microsoft put the whole
   title: in the detail. If the founder, looking at the PR screenshots, wants
   the head allowed to wrap, it is a one-class change.
4. **Column widths are no longer sized for the longest word.**
   `RESULTS_COLUMNS` and `RESULTS_MIN_WIDTH` in
   `components/dashboard/results-table.tsx` (~66-75) were set so a name never
   broke mid-word; with truncation, lower the minimum widths so the compact
   table and the rail never scroll sideways, and keep every other column's
   content whole (the workers and actions checks in `pane-stability` stay).

Where names are drawn (grep `\.name}` and `[overflow-wrap:anywhere]` in
`components/dashboard/` for the rest): `results-table.tsx` (wide, compact and
the composer rail), `supplier-result-card.tsx` (cards view title),
`saved-list.tsx`, `rfq-composer.tsx` (targets list ~383 and the preview's "To"
line), `supplier-picker.tsx` (~304), `search-typeahead.tsx` (company
suggestions), `supplier-sheet.tsx` (head ~189), `product-sheet.tsx` (the line
page head), `orders.tsx` and `rfq-pages.tsx` (supplier names in rows),
`sheet.tsx` `FacilitiesList` (~705, building names). Building names in
Facilities and chips that carry a building's name follow the same rule.

**The list beside the RFQ composer (the 18rem rail, review item 5).** It is
the same `PanelHeader` (compact), `ResultsTable` (`rail`) and `PanelFooter`
as the list, squeezed. In rail mode:

- The header is one line: the count ("1,120 suppliers") in `text-sm
  font-medium`, then the search's words ("pants · Sanctioned hidden") as a
  one-line `text-xs text-ink-subtle` caption that truncates, with the whole
  title in its `title`. No sort, save or density controls
  (`results-panel.tsx` ~65-100 draws them in compact mode): the rail is for
  ticking suppliers into the RFQ, and sorting there opened a menu the rows
  painted over (review item 3).
- Each row is the same two one-line rows as the list (item 2 above) at the
  rail's width: the box, a 24px tile, the base name, and "qualifier · type ·
  place" under it, each cut to one line. Every row is the same height.
- The footer is one line: "51–75 of 1,120" with previous and next icon
  buttons; no rows-per-page menu.

**Also rewrite:** DESIGN.md's Wrapping Name Rule becomes a "One-Line Name
Rule" (the four places in the table above), and the surface brief records the
new decision under the 29 Sep section, marking the Q1 answer superseded.

**Done when:** at 1280 beside a record, at 1440 without one, and at 375,
every name in every list is one line; Zaheen's row is two lines; "(Unit-2)"
and its siblings are still told apart on line 2; hovering a cut name shows the
whole name; the record head shows the base name and qualifier and the full
registered name below; the rail beside the composer has a one-line header,
one-line rows and a one-line footer; the rewritten guards pass.

## PR B — the facts' hierarchy, colour and icons

**Mobbin references** (web): record details as rows of icon, muted label and
stronger value, grouped:
[Attio record details](https://mobbin.com/screens/8b95ad8d-7e53-4ea1-ac7a-3f8be1b1ab3a),
[Twenty company fields (General, Business, Contact)](https://mobbin.com/screens/68c2f8c3-60b2-4294-9e73-b674998b0713),
[Lightfield account details](https://mobbin.com/screens/b47a2904-f608-414d-ac6c-241ff0642556),
[Intercom company card](https://mobbin.com/screens/211bbb33-b824-4733-9d5f-e548a0683aea),
[Pipedrive organisation summary (address with a pin)](https://mobbin.com/screens/6178b5a8-b478-4aed-99bc-d74b07a68383),
[Jobber client property (pin and address)](https://mobbin.com/screens/4ee9338b-de48-4168-9069-38d3307446ff).

**The decision** (build this; all colours are existing tokens):

- **Three levels of text and one colour.**
  - Group heading: sentence case, `text-sm font-semibold text-ink-strong`
    ("Company", "Location", "Workforce and capacity", "Registrations"),
    replacing the mono uppercase eyebrow that was the loudest thing on the
    page.
  - Label: `text-sm text-ink-muted`, with its icon before it.
  - Value: `text-base text-ink-strong`; `font-medium` for the facts a buyer
    reads first (registered name, type, workers, address). A value's note
    ("across 2 sites", "as filed") stays `text-sm text-ink-subtle`.
  - Icons: 16px, SourceBD's own line set (the founder's pick "A"), in the slate
    `accent` (6.8:1 on the canvas, so it passes 3:1 as a graphic). That is the
    colour in the hierarchy. Status hues stay reserved for status, and green
    stays on the primary action and the logo only.
- **Icons on every fact that deserves one**, from
  `components/dashboard/sb-icons.tsx` (`SbIcon`). Drawn and unused today:
  `workers`, `established`, `machines`, `address`, `register`, `certificate`,
  `brand-list`, `receipt`. Draw the rest on the same 24px grid, 1.5px stroke,
  round ends, one path each, in that file:

  | Fact | Icon |
  | -- | -- |
  | Registered name | new `company` (a building with a door) |
  | Type | new `factory` for a factory, new `buying-house` (a briefcase) for a buying house: the icon follows the value |
  | Parent group | new `group` (three linked buildings) |
  | Established | `established` |
  | EPZ zone | new `zone` (a fenced plot) |
  | Factory address, every Locations row | `address` |
  | Workers | `workers` |
  | Women · men | new `women-men` |
  | Sewing machines | `machines` |
  | Capacity, as filed | new `capacity` (a gauge) |
  | Registers | `register` |
  | Certificates section, a certificate card | `certificate` |
  | Brand lists | `brand-list` |
  | Export lines, Products | `receipt` |
  | Locked contact card: email, phone, website, contact person | new `email`, `phone`, `website`, `person` |

- **Where:** the Overview facts (`FactsPanel` in `sheet.tsx`, grouped by
  `FACT_GROUPS` in `supplier-sheet.tsx` ~104), the line sheet's facts (the same
  panel, `product-sheet.tsx`), the record head's facts line (`MetaLine` in
  `supplier-result-card.tsx`: the type, place, established, workers and
  register number each get their icon, the way a place card or a LinkedIn
  company header shows them), the Locations rows, and the locked contact card.
  The results list's second line stays text: density matters more there.
- **The model carries the icon**, not the view: add `icon?: SbIconName` to
  `FactRow` and `FactWithMark` (`lib/dashboard/models.ts`) and set it where
  the facts are built (`lib/dashboard/build-models.ts`, facts from ~1220,
  meta from ~574). A test fails when a label in `FACT_GROUPS` has no icon.
- **Keep what PR 5 settled:** each source once in the head, the pending mark
  (a document with a clock) in the mark column, one two-word legend, no
  stripes, no fact dropped.

**Certificates, lighter (review item 4).** Mobbin (web):
[7shifts certifications](https://mobbin.com/screens/806539a9-f62a-44fd-aad4-db4283e65b31)
(one row per certificate: type, a status pill, expiry, the file),
[Deel compliance documents](https://mobbin.com/screens/9c17783e-46c9-45d2-8bfd-0f3d1cff575b),
[Remote compliance list](https://mobbin.com/screens/4ded0f24-17fd-4c6f-998a-6d6d2074d1b0).
Today each certificate is a card (`CertCard`, `CertScope`, `CertGrid`,
`parseCertScope` in `sheet.tsx` ~487-560). Build:

- **One row per certificate**, not a card: the scheme's mark, the scheme
  ("GOTS", `font-medium`), the number (mono, `ink-muted`), the certifier
  ("GCL International Ltd", `ink-subtle`), then at the row's end the state
  badge ("Expired 17 Jun 2026", "Valid to 12 May 2027", "No expiry on file")
  and the certificate link as an icon button. One line; the certifier is cut
  first when it does not fit.
- **The scope behind a disclosure** on the row ("Scope", a native
  `<details>`): Operations, Products and the rest as the register's own
  labelled parts, as today. Nothing is dropped; it is one click away.
- **Drop scope text that only repeats the certificate:** OEKO-TEX's "OEKO-TEX
  STANDARD 100" under "OEKO-TEX Standard 100", WRAP Gold's "Gold". Test with
  those real strings; a scope that says anything more stays.
- Two certificates of one scheme stay two rows (two numbers).
- The section's caption is the count alone ("4 on file"); the rows name the
  schemes.
- A building's certificates ("Held by <building>", `supplier-sheet.tsx` ~305)
  use the same rows.
- Guards: a render test pins one row per certificate with its badge and link,
  the scope inside a closed `<details>`, and the repeated-scope drop; update
  the DESIGN.md Record Sheet line quoted in the rules table.

**Done when:** screenshot 2's page, at 1280 and 375, reads in three clear
levels with a slate icon on every fact row and every head fact; Certificates
is one line per certificate with its scope one click away; the new icons are
shown to the founder in the PR (one image of the whole set); DESIGN.md's
Record Sheet and Facts panel sections describe the new rows; `tokens.test.ts`
still passes (no hand-typed colour).

## PR C — the card view (review item 8)

The results' cards view (`view=cards`): `SupplierResultCard` in
`components/dashboard/supplier-result-card.tsx` (~111-220; `MetaLine` ~37,
`Tile` ~57), built by `buildDiscoverCard` in
`lib/dashboard/build-discover-row.ts` (~165; the tiles ~265) and, for the
gallery and fixtures, `buildCard` in `lib/dashboard/build-models.ts` (~866).
The gallery frame is "results-list" in `app/dev/ds/dashboard-screens.tsx`.

**Mobbin references** (web):
[Semrush agency directory](https://mobbin.com/screens/9d9d1461-4626-4863-9248-0ceedf542a13)
(logo, one-line name, one badge, then two lines of icon-led facts with "+5"
overflow, a save icon),
[Dribbble design companies](https://mobbin.com/screens/d07ae4a3-b06b-4455-bdd2-112b723248cb)
(one line of icon facts, a thumbnail row, one call to action and a save icon),
[Glassdoor company results](https://mobbin.com/screens/08ac2180-a763-424c-84ec-c77b97e3404b)
(logo, name, one facts line, counts as links),
[Zillow agent cards](https://mobbin.com/screens/043c0f3e-09d9-4c5c-920a-53cc5e8bb77c)
(the number first and bold, its label muted).

**What is wrong, precisely:** each fact is said two or three times. The
source marks, "9 sources", "9 registers & certifiers" and the Registers tile
all describe the registers. The certificate chips and the Certificates tile
describe certificates. The "EPB exporter · 13 lines" chip and the Export lines
tile describe the export lines. The brand-list marks (AS, HM, NX) and the
Listed by tile describe brand lists. Everything is the same weight, so
nothing leads.

**The decision** (build this; it reuses PR A's name and PR B's hierarchy and
icons):

```
[box] [tile 48] Base name (16px medium, one line)          [save] [Open] [Send RFQ]
                qualifier · [icon] Factory · [icon] Dhaka, Narayanganj ·
                [icon] Est. 2009 · [icon] 1,300 workers (3,546 with buildings)
                [9 marks]  8 registers & certifiers · 3 brand lists
                [GOTS valid to 28 Feb 2027] [SA8000 expired 23 Jul 2021] [RSC] [EPB · 13 lines] +N
                [48px thumbs, HS code under each ……]  +7 lines   illustration
```

- **Line 1**: the base name (PR A, one line) and the actions at the row's
  end: Save as an icon button, "Open" as a ghost button with the open-beside
  icon, and "Send RFQ" as the one labelled secondary button. The bordered
  "Open record" button goes; the name and the tile also open the record.
- **Line 2, the facts**: one line of icon + value pairs in PR B's style
  (slate icons, `ink` values), cut to one line with the whole line in its
  `title`. The two worker figures stay two (founder, 28 Sep: a list figure and
  a record figure must never be confused), in `WorkersCell`'s short form
  ("1,300 workers" and "3,546 with buildings"), with each figure's full words
  ("on the supplier record", "across this record and its buildings") in its
  `title` and accessible name. `build-discover-row.test.ts` (~233-361) pins
  those words; keep them in the model, move them out of the visible line.
- **Line 3, the sources, once**: the marks row, with one caption that
  separates the two populations: "8 registers & certifiers · 3 brand lists".
  The first figure is the one the default sort ("Most registers &
  certifiers") and the minimum-sources filter use
  (`build-discover-row.ts` ~143-145, ~299, ~352), so it stays visible. It
  leaves the facts line, and "9 sources" goes.
- **Line 4, status**: the certificate, RSC and EPB chips as today (the only
  status colour on the card), at most four, then "+N".
- **Line 5, products**: 48px thumbnails with the HS code under each (the
  founder's photo pick, smaller: PR 5's list rows are 40px), "+N lines", and
  one "illustration" tag for the row instead of the caption under each photo
  and the note under the strip. At 1440 and wider the thumbnails may sit in a
  right-hand column beside lines 2–4.
- **The four tiles go.** Everything they said is on lines 2–4. Their links
  (the EPB exporter page, the certificates) move onto the matching chip.
- **Hierarchy**: the name is the strongest text; values `ink`; captions and
  separators `ink-subtle`; slate for icons only; status hues only on chips.
  Aim for a card about 170px tall where it is 400 today.
- **No fact dropped.** Every figure and state the card shows today is still on
  the card, or in a `title` and the accessible name where only its words
  moved. Say which in the PR.
- **Beside an open pane (review item 9)**, the cards collapse to the compact
  list: the same rows, columns and widths as the table's compact mode (the
  `ResultsTable compact` the table view already draws beside a pane), with the
  current record's row marked. This is the master-detail pattern of Mail,
  Outlook and Finder: when the detail opens, the list gives up its detail and
  keeps only what finds the next item. The view switch stays on "cards", and
  closing the pane brings the cards back. It is one decision in
  `app/(app)/app/discover/page.tsx` (where `state.view === "table" ||
  composerOpen` already chooses the table beside the composer): use the
  compact table whenever any pane is open (`paneOpen`), and add a route test
  that `view=cards&record=<slug>` draws the compact table, not cards.
- Guards: rewrite the card tests in `render.test.ts` and
  `dashboard-screens.test.ts` ("results-list") for the new structure: one
  facts line, the sources said once, no tiles, thumbnails at 48px with one
  illustration tag, both worker figures present with their words in
  `title`s. Keep the sanctioned card's line and disabled Send RFQ exactly as
  today (`SanctionLine`, ~92).

**Done when:** the cards view at 1280, 1440 and 375 reads name first, facts
second, status third, with each fact said once; with a record open beside it,
the list is the compact table and nothing is squeezed; the before-and-after in
the PR shows the same cards (Modele De Capital, Aboni Knitwear) at both sizes,
with and without a record open.

## PR D — what the video hand-off left

1. **Hover-only reasons are not reachable on touch.** An empty figure's reason
   (`Stats` in `sheet.tsx`, the dash with a `title`) and a checked-but-empty
   fact (the magnifier in `FactsPanel`) show only on hover and to a screen
   reader. Make each a small button that opens the reason on tap (a
   `<details>` popover, like `Menu` in `controls.tsx`).
2. **`everyMarkLinks` is computed and tested but never shown** since PR 5
   removed the action bar's sentence: `lib/dashboard/models.ts:257`,
   `build-models.ts` (~1279, ~1417) and the assertions in
   `build-models.test.ts`. Delete all three.
3. **The onboarding tour sits outside the app shell** (`<TourMount />` after
   `<AppShell>` in `app/(app)/app/layout.tsx`), so it keeps the old green tints
   and 13px text that `[data-shell]` remaps in `app/ds.css`. Mount it inside
   the shell or give its root `data-shell`.
4. **Tiles:** the search list's initials tile is 40px (PR 4), but Saved
   (`saved-list.tsx` ~175), the composer's targets (`rfq-composer.tsx` ~380) and
   the picker (`supplier-picker.tsx` ~302) still draw 24px. Match them when PR A
   gives those rows two fixed lines.
5. **The filter menus wrap onto two or three rows beside an open pane**
   (`FilterMenus` in the compact results column). Beside a pane, show Product,
   Certificate and Place and fold the rest into More, or one "Filters" menu.
6. **No phone or tablet screenshots were taken of the video PRs.** Check the
   rail collapse (from `md` only), the account menu on phones (the topbar's),
   the filter menus, the record's Expand and "Back to results", and the
   composer below `lg`. Fix what breaks.
7. **PR #199** (a parallel session: an /app page no longer runs the older
   shell's five reads; it moves the admin and supplier pages into an
   `(old-shell)` route group, 60 files) was open at hand-off time, conflicting
   with `development` and failing the typecheck. It is worth landing: rebase it
   onto `development`, fix the typecheck, and land it before PR A, so the two
   do not both touch the app layouts. If its session has stopped, take it over.
   PR #181 (Products and Saved searches headers, 27 Sep) is stale and
   conflicting; the founder was asked whether to close it. If those headers
   still differ from the other buyer pages, fix that here instead.
8. **Close out the video hand-off** in context: `current-state.md` gets one
   "complete" line and the detail moves to `context/archive/state-<period>.md`;
   the `active.md` entry moves to `context/archive/specs-shipped-2026.md` (AGENTS
   workflow step 4; the size tests fail over 16 KB and 6 KB).
9. **The impeccable sidecar** `.impeccable/design.json` is stale. Refresh it
   (impeccable `document`) after PRs A and B, so it describes what shipped.
10. **The sidebar's foot (review item 7): "really under done and low quality
    design".** Today it is the account row (initials, "admin", a caret) over a
    separate "Free … public beta" line (`app-shell.tsx` ~105-125; the plan is
    hard-coded in `load-buyer-shell.ts:85,146`). Mobbin (web):
    [Air](https://mobbin.com/screens/7bf21d5f-b30a-45ba-9f14-935bf9781fce)
    (photo, name and email at the foot),
    [Cursor](https://mobbin.com/screens/ff393e0b-5ba5-4a54-8aca-4287da512949)
    (the plan under the name),
    [Asana](https://mobbin.com/screens/69821f2b-6cdb-4d4f-b432-52a11b26ea4c)
    (a trial card with progress and one action),
    [Ditto](https://mobbin.com/screens/9b753d6c-9954-4a99-b55c-e6c6e3bcfa9d).
    Build:
    - One account row, the whole row the account menu's button: a 32px photo
      (initials when none), the name on line 1 (`text-sm font-medium
      text-ink-strong`, one line) and the plan on line 2 (`text-xs
      text-ink-subtle`, "Free plan · Beta"), and an up-and-down chevron at the
      end, as a workspace switcher draws it. The separate plan line goes.
    - When billing exists and the plan has an RFQ allowance: a thin meter and
      "3 of 10 RFQs this month · Upgrade" above the row, quiet (no
      illustration, no coloured fill). Until then, nothing.
    - The row lines up with the nav items' left edge and icon column, on the
      8px grid, with the nav rows' hover state and the slate open state.
    - The collapsed rail shows the photo alone, centred; its tooltip gives the
      name and the plan.
    - The name is the profile's display name. "admin" on the live site is the
      test account's email name part; check a real buyer's account renders its
      name.

## Founder-only (do not do these)

- **Deploy.** The video PRs 1–6 are live (`main` `79a59f8`, 29 Sep; rollback
  ref `d7e6c42`). Each later promotion PR (`development` → `main`, merge
  commit) starts Deploy Production, which waits for the founder's approval in
  the GitHub `production` environment. Check what actually shipped with the
  "Expected production commit" log line (CLAUDE facts), not `gh run list`.
- **Migration 0107** (the profile view reads one supplier; median record read
  1,120 → 318 ms). Not applied. Dry run, command and rollback:
  `ops/plans/0107-profile-one-supplier.md`. After it is applied and the deploy
  is live, re-run `node ops/measure_app_speed.mjs` (it attaches to the
  founder's Chrome on port 9222, which the founder must allow) and update the
  "after" numbers in `ops/plans/buyer-app-speed-29sep.md` in place (AGENTS 14).

## How to check your work

- **Tests.** `pnpm exec tsc -p tsconfig.npm-test.json` (check the exit code),
  then `node --require ./test-stubs/register-node-test-aliases.cjs
  --experimental-websocket --test <files>` on the `.tests-build` files you
  touched. These cover this work: `components/dashboard/{render,
  pane-stability, record-head, search-filters, shell-account, rfq-rail,
  search-first, record-sheet, craft}.test.ts`, `app/dev/ds/dashboard-screens.test.ts`,
  `app/(app)/app/record-routes.test.ts`, `lib/dashboard/build-models.test.ts`,
  `lib/design/tokens.test.ts`. Leave the full suite to CI.
- **Screenshots** of every changed screen at 1280, 1440 and 375, with a record,
  a line and the composer open, before and after, in the PR. Add harness pages
  for what the founder reviewed: the record scrolled under its tabs (Products
  and Certificates), the wide list scrolled under its header, every menu open
  over rows (including the rail's, beside the composer), the Certificates
  section, and the sidebar's foot (open, collapsed). A bleed shows only in a
  scrolled or open state, so shoot those states, not just the page at rest.
- **Done** means merged by CI after one `/code-review` pass on the diff
  against the merge base (`.cursor/rules/sourcebd-closed-loop.mdc`), each PR to
  `development` with `gh pr merge --auto --squash`. Then the promotion PR with
  `gh pr merge --auto --merge`. The founder approves only the deploy.
- Reply to the founder in five lines or fewer, in plain words, and name every
  PR and issue with a short description on first mention (AGENTS "How to
  reply").
