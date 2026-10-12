# 0146 dry run (12 Oct 2026, production, rolled back)

Migration `supabase/migrations/0146_volza_reveal_price_city.sql`: the shipment reveal returns the buyer's
city and, where it passes a check, the price a piece. **Not applied.** The founder says "apply 0146".

The screen does not wait for it: until 0146 is applied the read returns neither field, and the table prints
the merged rows with no price and no quantity.

## What was run

The price check (`_volza_checked_price`) created inside `do $dry$ … execute $m$ <function> $m$; <counts>;
raise exception …`, so it rolled back by construction. It was run over every shipment record held in
production: the 87 saved reveal records, each supplier's stored record and each market's biggest record.

First run, with the first thresholds (US$0.30 to US$60, 0.03 kg to 3 kg a piece):

```
DRY RUN OK | records 957 priced 948 (min 0.41 max 52.63) | reveal records 87 priced 87
```

It held back six real prices: socks at US$0.21 to US$0.30 a piece and briefs at 0.02 kg a piece. The
thresholds were loosened to **US$0.10 to US$60** and **0.01 kg to 3 kg**. By hand over the nine records the
first run listed, three stay held back, so 954 of 957 keep a price:

| Record | Why it is held back |
| --- | --- |
| Ladies woven denim shorts, price filed as US$41,608.22 (the shipment's whole value), twice | outside US$0.10 to US$60 |
| Baby girls cardigan, counted in kilos at US$42.86 a kilo | not counted in pieces |

## Where the thresholds come from

The 956 records counted in pieces, measured the same day: price a piece 5th percentile US$1.11, median
US$4.31, 95th US$15.38; gross weight a piece 0.12 kg, 0.39 kg, 1.0 kg.

## Asserted on every CI run

`supabase/ci/assert-0146.sql`: a plausible price is returned; a price a kilo, a price outside the range, an
impossible weight a piece, a missing value and a price filed as text answer null; the raw `unit_rate_usd`
is never returned; no buyer may call the check itself.
