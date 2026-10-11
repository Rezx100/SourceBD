# Spec — customs shipments: keep the whole preview, read more from it, reveal the rest for credits

Founder, 11 Oct 2026: "do not fetch 10 recent shipment, but build a richer card where user will be
able to fetch/reveal using their account credit if they want only then it will be fetched; other
than that we fetch only what preview gives us and we delete nothing and save it and use our brain
to provide real user value." Status: PROPOSED. The design pass is done (11 Oct 2026, 13 critique
points fixed; Paper page 34 boards A–J2, test page `.impeccable/preview/customs-resize`); waiting
on the founder's approval of the boards, the date-sorted refetch (section 7) and the three defaults
in section 6.

## 1. Keep everything the preview returns (slice A)

- Migration 0138: `volza_export_checks` gains `summary jsonb` (the whole `api_summary`) and
  `top_record jsonb` (the whole biggest shipment: ports, weight, buyer city, factory city, notify
  party, shipment id). Nullable, so the 243 rows already stored stay valid. Merged in PR #443 (the
  free company-list scan and batch scripts); applied to production 11 Oct 2026.
- `ops/volza_batch.py` already keeps both raw (PR 443); `ops/volza_load_sample.py` writes them.
- The launch batch (`ops/plans/volza-export-dry-run.md` section 11) also fetches, per supplier,
  the four markets (United Kingdom, United States, EU as one, Canada: shipments, value, buyers and
  the biggest shipment there) and, for pieces-only suppliers, the count of shipments under 1,000
  pieces. Migration 0139 (PR #450, the market and small-orders columns; waits for "apply 0139")
  stores them and makes `supplier_volza_exports(slug)` return `summary`, `top_record`, `markets`
  (United Kingdom / United States / EU / Canada, each with shipments, fob_usd, buyers and its
  biggest shipment; null for single-country suppliers) and `small_orders` ({under_pcs, shipments,
  of}; null unless the supplier ships only in pieces). The `VolzaExports` type in
  `lib/dashboard/models.ts` gains those keys in slice B.
- The one-year expiry stays: it is the condition in Volza's email of 8 Oct 2026 (0137 header).
  "Delete nothing" here means no field is dropped on the way in.
- Back-fill of the 243 rows: the fields were dropped at fetch time, so the only way back is to
  pay for the 47 shown suppliers' preview again (about $7.05). Separate yes needed; when it runs,
  it runs date-sorted (section 7).

## 2. Read more from what we hold (slice B, no Volza calls)

Computed in the read function from the stored row. Every line is shown only when its input exists;
a missing input means the line is left out, never a placeholder ("coming with the next update" is
banned). No opinion words and no score: plain facts with their basis (agent-brief: no score-like
opinions).

The band (under the compliance strip, every tab; Paper boards A, B, F, J2):
- header "Customs exports" with the one source line "Bangladesh customs · Sep 2024 – Aug 2026";
  the fetched date is not in the band (it stays in the Sources tab);
- the markets line, when the markets were fetched: "Ships to EU, US, Canada, UK · 16 countries
  in all" (markets ordered by shipments; `count_of_unique_destination_countries` for the total);
- the figures: export value (the one large figure, capped at 24px), shipments, buyers, average
  shipment (value ÷ shipments); plus "Latest shipment on record: <date>" once the stored record
  is the latest shipment (section 7; never "last shipped": Volza's data ends 31 Aug 2026);
- the comparison line, only once 100+ exact rows exist: "Top 10% by export value among the N
  exporters we hold records for", a plain decile over `match_class = 'exact'` rows; below 100
  rows, nothing;
- "Show recent shipments · 1 credit" and a link to the Exports tab.

The Exports tab (heading "Customs exports", board B) says only what the band cannot:
- shipping rhythm: shipments a month over the window;
- product range: `count_of_hsn_codes` product codes, destination countries, shipping modes;
- the biggest shipment: value, date, product (HS code), buyer, country, unit price;
- small orders, pieces-only suppliers only: "26 of 406 shipments under 1,000 pieces (6%)"; 0%
  reads "None under 1,000 pieces". Never called a minimum order;
- "Where it ships": one row per market with "236 shipments · US$15.6m · 10 buyers" and "Biggest
  shipment there: <product> to <buyer>, <country> · US$1.73 a piece"; a market with 0 shipments
  reads "No shipments to Canada, Sep 2024 – Aug 2026"; a single-country supplier gets one row,
  from the biggest shipment's destination;
- one footnote: buyer names are as written on the customs record (a logistics arm or an agent as
  often as the brand). Names are tidied to the first legal ending (Ltd, LLC, Inc, GmbH, BV, SA,
  SL, SpA, Corp, Co KG, LP) or the first number, title case.
- Not in the tab: average shipment and buyer count (the band has them); no "Reach" row.

Price rule: a unit price is shown only with its unit, per piece only when the unit is PCS, and only
when it is under 3× the median unit price for the same 4-digit heading across stored rows (5+ rows
for that heading); otherwise the shipment is shown without a price.

## 3. Reveal the full history for credits (slice C)

- The locked box (board B): heading "Recent shipments", one line on what the 25 answer ("Who they
  shipped to last month, and at what unit price."), a table whose first row is the real biggest
  shipment we already hold (date, product, HS code, unit price, buyer, country, value) and whose
  other rows are greyed bars, the caption "First row: their biggest shipment, from the record we
  already hold.", the button "Show recent shipments · 1 credit" with "18 of 20 credits left this
  month" beside it, and "Once shown, your whole workspace sees them for a year." as small print.
- Server route `POST /api/v1/suppliers/[slug]/customs-reveal`: checks sign-in, plan, suspension
  and credit balance on the server; if a reveal for that supplier exists and is under a year old,
  it is shown without a Volza call; otherwise one live call (production key, server only) for the
  25 most recent shipments, stored in `volza_reveals` for a year, then shown.
- Credits: new `credit_ledger` (workspace, change, reason, reference, by whom, when); balance is
  the sum. A reveal that calls Volza debits; a reveal served from storage is free. One counter
  everywhere: 18 of 20 before a reveal, "17 left after this" on the confirm, 17 of 20 after.
- Spend guard: a monthly ceiling on our own Volza spend, checked before every live call; at the
  ceiling the button says reveals are paused. Rate-limited per account (existing rate limiter).
- Only 'exact' matches get the button; ambiguous names never trigger a paid call.
- The revealed card (board C): the 25 rows (date, product, buyer, country, value, unit price under
  the price rule), then "Buyers in these 25" and "Where these 25 went", named as such: top buyers
  and top countries come from the market figures (section 2), never from the 25 rows, which for a
  large exporter cover about two days.
- Paging (founder, 11 Oct 2026): the table ends with "25 most recent shown · 381 older at customs"
  and "Show 25 older · 1 credit". Each press is one more live call for the next 25 by date, stored
  with the rest; the breakdowns then count every line fetched so far. Never "all shipments": Aboni
  alone has 4,652 (about US$233 at US$0.05 a record).
- One list of export lines, never two (founder, 11 Oct 2026): each 4-digit HS heading once, tagged
  "Registered" (EPB) and/or "Shipped" (seen in the fetched shipments). Customs headings missing
  from the EPB list are added as "Shipped · not on their EPB list". Before a reveal only the EPB
  tags show. A heading not seen in the fetched rows carries only its Registered tag, with no
  "not in the 25" line; one footnote: "Shipped tags come from the N shipments fetched."

## 4. Placement: the most valuable data goes first (founder, 11 Oct 2026)

Today the card sits at the very bottom of the last tab (Products, after the EPB lines). It moves up
on every surface where a buyer decides:

1. **Record header.** A cell in the summary strip: "406 shipments · US$21.7m · 2 yrs", linking to
   the Exports tab. First thing seen after the name.
2. **The band, under the compliance strip, on every tab** (section 2). It is one step lighter
   than the strip (white, hairline border) and its largest figure is capped at 24px, so sanctions
   and certificates (16px, bordered) read first.
3. **Its own tab, second after Overview: "Exports"** (label "Exports", section heading "Customs
   exports"). The Exports-tab lines of section 2, the reveal, and once revealed the recent
   shipments and their breakdowns. The EPB export lines move here as "Export lines", so everything
   about exporting is in one place; Products keeps the buyer's product base and HS headings.
4. **Search results.** For entitled readers, an "Exports" filter ("has customs exports", export
   value bands, "Ships to" United Kingdom / United States / EU / Canada by shipments there) and
   exports sorts. The exports column exists only while the exports filter or an exports sort is
   on; otherwise there is no column and no row ever says "not checked". A row with the column
   shows the sort key on line 1 and the shipment count on line 2, always; countries never go in a
   row (they are the filter); rows with an export figure drop "N sources". Sort menu order with
   the filter on: Average shipment (fits my order size; the default, highest first, ranked only
   for suppliers with 10+ shipments, the rest after them, so one US$600k shipment cannot top the
   list) → Ships to my market (when the market columns exist) → Export value → Shipments →
   Buyers; suppliers without customs records sort last. Boards E, H, J1, J2; phone G: name, meta, shipments on the right.
5. **Readers not entitled** (free plan, signed out): no Volza figure anywhere (licence: paying
   users only). The header cell, the band and the tab say "Customs shipment records are on file
   for this supplier", with "See plans · Included with Growth and Enterprise"; a results row
   carries a "Customs record" marker and no figure (board I).
6. **No customs record:** checked suppliers get the band "No garment exports found under this
   name in Bangladesh customs, Sep 2024 – Aug 2026 · checked <date>". Unchecked suppliers get no
   band, one quiet line in the Exports tab ("Not checked against Bangladesh customs records yet.")
   above the EPB export lines, and nothing on results rows. Names that matched several exporters
   stay hidden (no band, no button) until a person settles them (board D).
7. **Phone** (boards F, G): the band shows the markets line when present, then two figures a row
   (value + latest on record once known, else value + shipments; then buyers + average shipment), the
   comparison line, and a full-width 44px button; the RFQ bar is unchanged. The Exports tab
   stacks label over value. Results rows: name, meta, and the shipment count on the right.

Design pass done 11 Oct 2026 on the test page (`.impeccable/preview/customs-resize/index.html`,
real reflow with container queries, four pane widths and a 390px phone, states `figures`, `proof`,
`full`, `unchecked`) and Paper page 34. Every figure on the boards is real: Hamza Clothing Ltd
from the launch batch.

## 5. Order of work

A (migration + loader) → design pass on the placement (done) → B (read function + band + Exports
tab + placement, including the market and small-orders columns) → C (ledger, reveal table, route,
button).
Each a PR to `development`; migrations wait for the founder's "apply NNNN".

## 6. Defaults to confirm (recommended; the founder changes any of them before slice C)

1. One reveal = 1 credit = up to 25 recent shipments (our cost about $1.35).
2. Credits are granted by an admin until billing is live (Growth: 20 a month, Enterprise: 100).
3. Our Volza ceiling for reveals: $100 a month.

## 7. The stored record becomes the latest shipment, not the biggest (needs the founder's yes)

The preview call takes `sort_by: "shipment_date", sort_order: "DESC"` for the same US$0.15, so the
one record kept per supplier can be the most recent shipment instead of the largest. The latest
shipment is proof of life; the biggest is a trophy, and the biggest shipment per market still comes
from the value-sorted market calls (single-country suppliers, which get no market calls, then hold
the latest shipment only and never label it biggest). The band says "Latest shipment on record:
29 Aug 2026" with the window line beside it, never "last shipped": Volza's data ends 31 Aug 2026,
so the date can trail the factory's real last shipment by weeks. The two kinds of record are never
mixed: every row held today keeps the biggest shipment, so all 73 shown suppliers are fetched again
date-sorted before the card ships (about US$0.15 each, about US$11; its own yes), and
`ops/volza_launch.py` sorts every later preview by date. Until that refetch the band shows no date
line at all.
