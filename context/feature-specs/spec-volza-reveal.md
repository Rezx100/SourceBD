# Spec — customs shipments: keep the whole preview, read more from it, reveal the rest for credits

Founder, 11 Oct 2026: "do not fetch 10 recent shipment, but build a richer card where user will be
able to fetch/reveal using their account credit if they want only then it will be fetched; other
than that we fetch only what preview gives us and we delete nothing and save it and use our brain
to provide real user value." Status: PROPOSED, waiting on the founder's go and the three defaults
in section 5.

## 1. Keep everything the preview returns (slice A)

- Migration 0138: `volza_export_checks` gains `summary jsonb` (the whole `api_summary`) and
  `top_record jsonb` (the whole biggest shipment: ports, weight, buyer city, factory city, notify
  party, shipment id). Nullable, so the 243 rows already stored stay valid.
- `ops/volza_batch.py` already keeps both raw (PR 443); `ops/volza_load_sample.py` writes them.
- The one-year expiry stays: it is the condition in Volza's email of 8 Oct 2026 (0137 header).
  "Delete nothing" here means no field is dropped on the way in.
- Back-fill of the 243 rows: the fields were dropped at fetch time, so the only way back is to
  pay for the 47 shown suppliers' preview again (about $7.05). Separate yes needed.

## 2. Read more from what we hold (slice B, no Volza calls)

Computed in the read function, shown on the card under the four figures:
- average shipment value (FOB / shipments) and shipments a month over the window;
- buyer spread: shipments per buyer ("one buyer takes most" vs "spread across 36 buyers");
- product range: number of HS codes; reach: destination countries, ports, shipping modes;
- position among the suppliers we hold Volza data for: "top 10% by export value" once 100+
  exact rows exist (below that, no ranking: too few to compare);
- the biggest shipment's unit price against the median unit price for the same HS heading in
  our stored rows (only with 5+ rows for that heading).
No opinion words and no score: plain facts with their basis (agent-brief: no score-like opinions).

## 3. Reveal the full history for credits (slice C)

- A "See recent shipments" button on the card, for readers entitled to the card today.
- Server route `POST /api/v1/suppliers/[slug]/customs-reveal`: checks sign-in, plan, suspension
  and credit balance on the server; if a reveal for that supplier exists and is under a year old,
  it is shown without a Volza call; otherwise one live call (production key, server only) for the
  25 most recent shipments, stored in `volza_reveals` for a year, then shown.
- Credits: new `credit_ledger` (workspace, change, reason, reference, by whom, when); balance is
  the sum. A reveal that calls Volza debits; a reveal served from storage is free.
- Spend guard: a monthly ceiling on our own Volza spend, checked before every live call; at the
  ceiling the button says reveals are paused. Rate-limited per account (existing rate limiter).
- Only 'exact' matches get the button; ambiguous names never trigger a paid call.
- The revealed card: recent shipments list (date, product, buyer, country, value, unit price),
  top buyers, top destination countries, product mix, all from the 25 lines.
- One list of export lines, never two (founder, 11 Oct 2026): each 4-digit HS heading once, tagged
  "Registered" (EPB) and/or "Shipped" (seen in the revealed shipments). Customs headings missing
  from the EPB list are added as "Shipped · not on their EPB list". Before a reveal only the EPB
  tags show (the preview gives a count of codes, not which ones). Paper page 34, boards B and C.

## 4. Placement: the most valuable data goes first (founder, 11 Oct 2026)

Today the card sits at the very bottom of the last tab (Products, after the EPB lines). It moves up
on every surface where a buyer decides:

1. **Record header.** A cell in the summary strip: "291 shipments · US$16.2m · 2 yrs", linking to
   the Exports tab. First thing seen after the name.
2. **Overview tab, top.** A compact block: the four figures, the two strongest read-outs from
   section 2 (e.g. "36 buyers, none above a quarter of shipments"; "ships to 9 countries"), and
   "See recent shipments · 1 credit".
3. **Its own tab, second after Overview: "Exports".** The full card: figures, read-outs, biggest
   shipment, the reveal, and once revealed the recent-shipments list, top buyers, countries and
   product mix. The EPB export lines move here too, so everything about exporting is in one
   place; Products keeps the buyer's product base and HS headings.
4. **Search results.** For entitled readers: a column with shipments and export value, a filter
   "has customs shipments", and a sort by export value: exporters with proof rise to the top.
5. **Readers not entitled** (free plan, signed out): no Volza figure anywhere (licence: paying
   users only). The header cell and the tab say "Customs shipment records on file · Growth plan",
   with the upgrade link; whether to say even that is the founder's call (default: yes, it shows
   only that a record exists, no figure).
6. **No customs record:** the cell and tab say so plainly ("No customs shipments found under this
   name, Sep 2024 – Aug 2026") for checked suppliers, and stay out for unchecked ones.

Design pass (impeccable) on the static harness before the build: desktop pane, full page and phone,
light and dark, screenshots to the founder.

## 5. Order of work

A (migration + loader) → design pass on the placement → B (read function + card + placement) →
C (ledger, reveal table, route, button).
Each a PR to `development`; migrations wait for the founder's "apply NNNN".

## 6. Defaults to confirm (recommended; the founder changes any of them before slice C)

1. One reveal = 1 credit = up to 25 recent shipments (our cost about $1.35).
2. Credits are granted by an admin until billing is live (Growth: 20 a month, Enterprise: 100).
3. Our Volza ceiling for reveals: $100 a month.
