# LinkedIn export visuals: findings (23 Oct 2026)

Data: Bangladesh customs export records for knitted and woven garments (HS 61–62), Sep 2024 – Aug 2026, fetched
22–23 Oct 2026 for EPB suppliers. Only exact matches: **496 of 835 suppliers checked**. Production, read only.
Every number below comes from `queries.sql` (Q-number in brackets) and sits in `src/data.js`.

**Not cleared to post yet.** The data licence (migration 0137, email of 8 Oct 2026) allows showing results to paying
users on supplier profiles, never on public pages. The visuals use aggregates only: no supplier is named and no single
supplier's figure appears (the cover's skyline is unlabelled). The founder must confirm that aggregate, anonymised
figures are cleared for a public post before anything goes up. The data vendor is never named on a visual.

| # | Finding | Number | Sample |
|---|---|---|---|
| 1 | Shipment records read | 939,354 records, $15.50 bn FOB | 496 exporters (Q1) |
| 2 | Exporters shipping to each market | EU 92% (456), US 71% (352), UK 65% (322), Canada 59% (292); all four 45% (222) | 496 (Q2) |
| 3 | Value by market | EU 49.4% ($7.65 bn), US 20.1%, UK 14.0% ($2.17 bn, one dollar in seven), rest 13.7%, Canada 2.9% | 496 (Q3) |
| 4 | Small orders | 48% of shipment records under 1,000 pieces (197,349 of 411,623); 310 of 338 exporters shipped at least one; median exporter 13% | 338 exporters with the check (Q4) |
| 5 | FOB per piece, median (middle half) | Women's knit underwear $1.35 (0.71–2.49); T-shirts $1.97 (1.44–2.96); men's knit shirts/polos $3.46; women's knit dresses/trousers $3.82; sweaters/hoodies $5.72 (4.21–7.98); women's woven dresses/trousers $5.75; men's woven shirts $5.83; men's woven trousers/jeans $6.39 (4.61–9.23); men's coats/anoraks $13.11 (8.52–23.09) | 2,016 recent piece-priced records, n per product on the card (Q5) |
| 6 | Concentration | Top 10% (50 exporters) ship 51.6% of value; bottom half 4.4%. Median buyers: 159 for the top 50, 26 in 10 countries for the other 446 | 496 (Q6) |
| 7 | Certificates | Current OEKO-TEX, GOTS or WRAP on file: median 59 buyers, 59% reach all four markets, median FOB $28.1 m. None on file: 11 buyers, 25%, $1.9 m. WRAP holders: 80% all four | 288 vs 208 (Q7) |
| 8 | Buyers per exporter | Median 30 (middle half 10–75); median 11 destination countries; 83 exporters serve 100+ buyers | 496 (Q1) |
| 9 | Where (registered district) | Dhaka 224, Gazipur 132, Narayanganj 72, Chattogram 52; 97% in these four | 496 (Q9) |

Caveats (the main ones are printed on the cards): "typical" is the median; the certificate link is a correlation, not proof of cause; the
small-order count is on shipment records with a filed quantity (a record can be one line of a larger order); prices
come from each exporter's most recent records per market, not every shipment; districts are the registered address.

Dropped: a district map (97% sit in four districts, so a map says less than one sentence; the district is the registered
office, not always the factory). Ideas the data could not carry: price by market (too few records per product per market).

## Files

- `png/carousel-01..08.png` 1080×1350 at 2x; `carousel.pdf` (8 pages, for a LinkedIn document post).
- `png/card-small-orders.png`, `card-price-per-piece.png`, `card-certificates.png`: standalone 1080×1350.
- `png/link-1200x627.png`: link image.
- `src/visuals.html` + `src/data.js` draw everything; `node .impeccable/linkedin-export-visuals/src/render.cjs` re-renders.
