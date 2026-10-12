# Spec: the desktop supplier record and search results, from Paper page 37

Written 13 Oct 2026. Source of truth for the look: Paper file "SourceBD v4", page 37 ("Supplier record ·
desktop redesign (12 Oct)"), 16 boards, approved by the founder on 12 Oct 2026 after eighteen rounds. The
decisions are listed in `.impeccable/handoff-desktop-record-build.md` (founder's machine) and repeated
here so the repo holds them. Built with the Paper-to-app converter (`plugins/paper-to-app`).

## Scope

Desktop only (640 px and wider): the record's full page (`/app/suppliers/[slug]`), the record's pane
beside a list, and the search results (the table with no record open, the list rows beside the pane).

Not in scope, and not to change: the phone record (`phone-record.tsx`, `phone-tabs.tsx`,
`phone-words.ts`) and phone search; Saved, Messages, Quotes, Orders, Compliance, Products, Settings; the
public pages (`public-record.tsx` keeps the old panels in `panels.tsx` and `Summary`); the landing page.
The app's own menu, top bar, filter bar, page controls and map stay as shipped: the boards cloned them.
Helpers shared with the phone are added to, never changed.

## Plan limits (must not widen)

Every gate stays where it is, in the database:

- Customs figures: admins, Growth, Enterprise (`supplier_volza_exports`, `volza_reader_entitled`). A
  Free buyer gets no export grid, no customs buyers, no market table.
- Contact details: admins, Growth, Enterprise, 200 suppliers a day (`supplier_contact_details`, 0145,
  not applied on 13 Oct 2026). Everyone else has the locked card with counts.
- Shipment lines: the paid reveal (`shipment-reveal.tsx`), kept as shipped inside the Exports section.

## The record (slice a)

1. Full page: a head (Back to results, name, type and place, Share / Save / Send RFQ top right) that
   becomes a 56 px stuck bar once scrolled (name, the three short checks, the actions); a main column;
   a right rail that is only the "On this page" nav with the current section marked. Pane: head, sticky
   tabs, the sections, Save and Send RFQ in a bar at the foot. Pane width as today (640, min 480, the
   list keeps 400).
2. Section order: Overview, Exports, Products, Certificates, Checks, Safety, Sites, Sources, Contact.
   The address keeps the seven `?tab=` values it has; Checks and Contact are reached by `#record-checks`
   and `#record-contact`.
3. Head: the three checks as one small strip from the start ("2 behind · GOTS 30 days · Not listed"),
   beside type and place on the page, a third line in the pane head, and in the stuck bar. Each jumps
   to Checks.
4. Overview: the export grid, Key facts (icon cells), Memberships (tiles: the register's mark, number,
   read date), Buyers (tiles: letters, an icon for where the name comes from, the customs name small).
   The buyer's own RFQs to the supplier follow only when there are some.
5. Export grid: one grid, four tiles, each a figure worked out from the stored customs record, a 6 px
   bar and a few words:
   - Export value, 2 years: the value; bar = its rank; "Bigger than 89% of exporters on record"
     (slice c; until then the value alone).
   - Typical shipment: value ÷ shipments to two figures; bar = share under 1,000 pieces.
   - Buyers: count; bar = buyers by market, the reader's own market dark; "30 in the UK · 11 shipments each".
   - Ships to <the reader's market>: value there; bar = value by market, own market dark;
     "9% of exports · 347 shipments".
   The reader's market is `buyer_settings.company_country` (0109, applied; filled at onboarding, 2 of 33
   buyers on 13 Oct 2026) mapped to UK / US / EU / Canada. Not stored, or outside those four: tile 3
   drops the "N in the UK" half and tile 4 is "Biggest market". No new setting is added.
   Under the grid one line: "Customs records, Sep 2024 – Aug 2026 · latest on record 30 Aug ·
   read 11 Oct" (shortened 13 Oct on the founder's note; the window's end says how far the records reach). Never "last shipped". Unit prices stay hidden. Money
   keeps the app's own form ("US$76.6m").
6. Exports section: one line saying what the figure is, then "Where it goes" (share bar and table),
   then Recent shipments as shipped. No month-by-month chart.
7. Products: "What it ships" (every EPB export code as a small photo with the short name and the code;
   the pane shows six and unfolds the rest), then "As filed with BGMEA" (the trade body the record
   holds) as one line of names. The two lists are not matched or de-duplicated.
8. Certificates: a table (Certificate with the register's mark, State, Valid until, Issued by, Last
   checked, the document link), the numbers as grey stamps on a line under the row. A certificate that
   has ended sits in its own group under the table, "No longer current · not counted above", plain
   grey "Ended 5 Sep 2026", no pill, not in the count, not in Checks, not in the head. It stays there
   however old (founder, 13 Oct 2026). A certificate its body stopped listing keeps its pill.
9. Checks (the founder kept the name, 13 Oct 2026): a row each for Safety, Certificates, Sanctions: a
   full row with its figure when it needs a look, one quiet line when it does not; "3 need a look"
   beside the title. On a sanctioned record the matches are in the Sanctions row.
10. Safety: a table; the repair bar is green at 100% and orange while behind; reports are underlined links.
11. Sites: the app's own map beside a table (Pin, Site, Address, From); extension buildings under it.
12. Sources: a mark and a name per source, one line per kind, highest trust first, a note only when
    stale. No reference numbers or read dates. The sanctions lists box with each list's read date stays.
13. Contact: last. Locked card for Free; the details card for a reader the database entitles (person on
    a tinted ground, email with Copy, phone numbers plain with a copy button, website).
14. One rule for shapes: a pill only ever means "this needs a look"; a state that is fine is plain
    text; a document is an underlined link with a small icon; a register's number is a grey stamp.
15. Carried from the phone review: every figure says what it is; no yellow notices; light dividers;
    brands have no logos (letter tiles). WCAG 2.2 AA; hover and focus on every row and link.

Not built from the boards: the full page's loading board. The page answers a real 404 for a missing
record, so it cannot stream a skeleton first; the pane's loading board is built.

## Search results (slice b)

16. No record open: a table. Supplier (bold name, its two best-matching products under it and "+N"),
    Location, Workers, "On the supplier list of", "Exported in 2 years · ships to" (value, then EU US UK
    CA codes, biggest share first), Certificates (marks). Type and Sources columns are gone. Empty cells
    show a dash. Workers stays as today: the company's own figure, the buildings' figure small under it
    when they differ (founder, 13 Oct 2026).
17. Beside the pane: list rows in three levels (name with export value; matched products with "ships to";
    icon-led facts with certificate marks). At the list's 400 floor every line wraps whole item by whole
    item, the head is two lines and the page controls are the count and two arrows.
18. Certificates in results are marks of certificates held today only; an ended one is left out.
19. The default order stays "most sources" (founder, 13 Oct 2026).
20. A Free buyer sees the export column with a lock on the companies that have customs records and a
    dash on the rest; no figure and no market reaches them (founder, 13 Oct 2026).
21. Superseded: "the exports column only with the exports filter or sort on" (11 Oct 2026). The
    founder's approval of these boards replaces it; do not restore it.

## The rank and the results read (slice c, one migration)

- `0147`: the rank of a supplier's two-year export value among the suppliers with customs records, read
  with the record's customs figures under the same gate; and one read that gives the results page its
  export cells for the suppliers on it (value and markets for an entitled reader, only "has records"
  for anyone else). Dry run posted first; applied only on the founder's "apply 0147".
- Until it is applied the first tile is the value alone and the results column is dashes.

## Order and gates

Slices a, b, c in that order (the founder's). Linear is not connected in this session, so no issue was
read for ordering. Each slice: one `/code-review`, a PR to `development` with auto-merge, then the
release PR to `main`. The founder approves the deploy.

## Open, for later (founder, 13 Oct 2026)

- Square Apparels: EPB lists knitwear codes while BGMEA and the factory type say woven and dyeing. A
  read-only look after the build.
- Two extra customs figures (growth, knit against woven): not now.
