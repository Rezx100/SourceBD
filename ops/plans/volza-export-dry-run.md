# Volza export data — dry run and a $25 live sample

Date: 10 Oct 2026. Scripts: `ops/volza_export_dryrun.py` (sandbox key only; steps `candidates`,
`match`, `overview`, `summarize`) and `ops/volza_live_sample.py` (production key, `--apply` only,
$30 cap, one shipment record per call). Raw Volza responses stay in `etl/raw/volza/` (gitignored);
this file holds counts and worked examples only. Every call is Bangladesh exports, HS chapters 61/62
only; no import data, no other HS chapters. Founder defaults applied: Volza is Tier 6 cross-check
data; RMG = BGMEA or BKMEA member, or EPB HS chapter 61/62.

**Spend so far: $25.20** of the $3,000 credit (Volza's own counter, read 10 Oct 23:3x), on the
200-supplier live sample the founder approved at up to $30 and ran from their own machine. Sandbox calls cost nothing:
the account counter read 0.000 through 400+ sandbox calls before the live run started.

## The answer

- **7,786** published RMG suppliers. On live Sep 2024 – Aug 2026 data, **29%** of a random 200 have
  Volza export records (95% range 23–35%), so about **2,250** suppliers.
- **The EPB register predicts it.** Suppliers with an EPB 61/62 record matched **78%** (52 of 67);
  everyone else matched **5%** (6 of 133). 2,388 suppliers have EPB 61/62.
- **Recommended: fetch the 2,388 EPB suppliers only**, about 1,850 matches. Option B (summary + top 3
  shipments) costs about **$570**, leaving about $2,400. Fetching everyone else would cost about
  $600 more to find about 240 more exporters ($2.50 each), because every miss is charged $0.10;
  leave them to on-demand lookups.
- **One supplier in four matched is ambiguous** (15 of 58): the name also sweeps in other exporters'
  shipments, often only spelling variants of the same company. Store these but hide them until a
  person confirms.

## 1. Our ready-made garment suppliers

**7,786** published suppliers are RMG makers by the definition above (production read, 10 Oct 2026).
Two independent reads agree: `RMG_SQL` in the SQL editor and the script's REST read both give 7,786.

| measure | count |
| -- | -- |
| published RMG suppliers | **7,786** |
| holding an active BGMEA record | 5,730 |
| holding an active BKMEA record | 2,567 |
| both BGMEA and BKMEA | 589 |
| BGMEA or BKMEA (any) | 7,708 |
| EPB record with an HS code in chapter 61 or 62 | 2,388 |
| EPB 61/62 only, no association record | 78 |

7,708 BGMEA-or-BKMEA is up from 7,700 in `rez-113-epb-coverage-evidence.md` (15 Aug); 5,730 with a
BGMEA record is down 10 from 5,740 in `bgmea-identity-gap.md`, which also counted unpublished-host
nuances. Different definitions, same order of magnitude.

Name candidates per supplier: the name we show, the display name, and any BGMEA scraped name, each with
the trailing Ltd / Limited / (Pvt.) cut off (Volza's supplier name is a contains-match, so "Square
Fashions" already finds "Square Fashions Ltd" and "… Limited"; adding the suffix only narrows). Names
shorter than 4 letters keep the suffix, because Volza rejects shorter names. 7,746 suppliers have one
distinct candidate, 36 have two, 1 has three, and **3 have no usable name** (under 4 characters even
with the suffix) and were not searched.

## 2. Name matching against Volza

### Live sample (the number to use)

200 suppliers drawn at random (seed 20261010) from the 7,786; window 1 Sep 2024 – 31 Aug 2026; one
`bangladesh-exports` call per name tried, `max_count_per_page: 1`, sorted by value. 222 calls, all
HTTP 200, $25.20 by Volza's counter (our price tally said $25.55).

| | suppliers | matched | rate |
| -- | -- | -- | -- |
| all | 200 | 58 | **29%** (23–35%) |
| with EPB 61/62 record | 67 | 52 | **78%** (68–88%) |
| without EPB 61/62 | 133 | 6 | **5%** |
| BGMEA record | 154 | 44 | 29% |
| BKMEA record | 57 | 20 | 35% |
| BGMEA only, no EPB, no BKMEA | 100 | 4 | 4% |

Matched suppliers: median 326 shipments over the two years (1 to 24,280).

**Hand check of all 58 matches** (the handoff asked for 50):

- **41 exact**: one exporter swept in, and Volza's name is ours with only case or Ltd/Limited
  differences (e.g. "4 STITCH KNIT COMPOSITE LTD." → "4 Stitch Knit Composite Ltd.").
- **2 likely**: "Alema Textile Limited" → "Alema Textiles Ltd." (same company, plural);
  "Ever Fashion Ltd." → "Ever Fashion Tongi Ltd" (may be a different unit; needs a person).
- **15 ambiguous**: the name swept in 2–4 exporters. Most read as spelling variants of one company
  ("UTAH Fashions" / "Utah Fashions Ltd", "Dharla Fashion" / "Dharla Fashions Ltd"), but some are
  real collisions ("Square Apparels" 3 exporters, "Radix" → "Radix Collections Ltd.", "Stuff" 4). The
  free summary gives the count of exporters, not their names, so a person has to decide.
- Retrying an ambiguous name with the full legal name rarely helped: "Ltd." with a full stop matched
  nothing in 11 of 15 retries, and narrowed only 2. Each retry costs $0.10; drop it from the real fetch.

**Misses (142).** Most look like genuine non-exporters or subcontractors on the association lists.
Two were our name-cleaning bugs, now fixed and tested: a bracket cut in half
("ASCO FASHIONS LTD. (FOR UD", "Global Profit Garment (Bangladesh") and a suffix glued to the word
before it ("Inds.Ltd"). Volza's match is a plain contains-match, so "Inds" never finds "Industries" and
"&" never finds "and"; a few real exporters will be missed for that reason.

### Sandbox run (Q1 2021, free)

Stopped after 455 of 7,786 suppliers: the safety check saw the account's credit counter move when the
live sample started (the counter is account-wide, not per key). 129 of 455 matched (28%), close to the
live rate. The check now compares against the counter's starting value. The full sandbox pass was not
resumed: the live sample answers the question it was meant to estimate, with current data.

## 3. Three company overviews (sandbox)

One call per supplier with `max_count_per_page: 5`, sorted by value. The summary covers every matching
shipment at no extra charge; live, the same call with 1 record costs $0.15.

| | Square Fashions | Epyllion | Ha-Meem |
| -- | -- | -- | -- |
| shipments Q1 2021 (HS 61/62) | 2,254 | 1,538 | 8 |
| FOB value | $53.9m | $35.1m | $0.34m |
| buyers | 144 | 49 | 3 |
| HS codes | 26 | 24 | 1 |
| exporters the name swept in | 1 | **3** | 1 |
| top buyer by value | Hugo Boss | Unionwealth Trading; C&A | SVES Apparel LLC |
| Volza company entries for the name | 12 | 50+ | 21 |

What one stored record looks like (Square Fashions, top shipment): 8 Mar 2021, HS 61051000 (men's
knitted cotton shirts), "Anoraks, pullover, polo & T-shirt", buyer Hugo Boss AG, FOB $836,518, unit rate
$9.55, 27,695 kg, Chittagong Custom House. Destination country and port: "Not Available" (2021 data).

What we would show on a profile (signed-in paying users only): shipments, FOB value, buyer count and
HS-code count for the last two years, and the top 1 / 3 / 10 shipments (date, product, buyer, value,
unit price), labelled "Customs shipment records via Volza, fetched <date>".

**Epyllion shows the main risk.** "Epyllion" pulled in Epyllion Style, Epyllion Knitwears and a third
Epyllion exporter. Our Epyllion profiles are separate units, so a contains-match on the group word would
show every unit the whole group's trade. The match step therefore reads `count_of_suppliers` from the
free summary: above 1 means other exporters are mixed in (class "ambiguous"), and it retries with the full
legal name to try to narrow it to one.

Name spellings: "Square Fashions Ltd" alone holds at least two Volza company IDs; "Ha-Meem" 21 entries
across Ha-Meem Textiles, Ha-Meem Design and others. Volza's company list is not de-duplicated.

### Filters tested

| filter on `bangladesh-exports` | result |
| -- | -- |
| `volza_company_id` (as string or number) | **ignored** — same 2,254; on its own it returned all 469,466 HS 61/62 shipments in the window |
| `supplier_id` | ignored |
| `buyer_name` (list) | **works**, contains-match: Square Fashions × "HUGO BOSS" = 176 shipments |
| `buyer_name` (plain string) | rejected (400, free) |
| `destination_country`, `buyer_country` (string or list) | ignored (not echoed back); 2021 data has no destination anyway |
| date outside Jan–Mar 2021 | `SandboxDateRangeRestricted` (400) — confirms the key is the sandbox key |

Ignored filters fail silently, so the real fetch must check `api_request_details` echoes every filter it
sent, or it pays for unfiltered data.

### Volza's own company summary: rejected

`GET /company-transaction-summary` gives a ready-made company profile, but costs a flat **$5 per
company** (10 records max), against $0.15 for our export-call summary. Not used.

## 4. Cost of the real fetch (no calls made)

Window: the plan's two years, Sep 2024 – Aug 2026. Prices: `bangladesh-exports` $0.10 per call +
$0.05 per record, charged even with 0 results. One call per supplier (almost all have one usable name);
a miss costs $0.10, a match costs the option price. No retries, and no `companies/search` lookups: the
export call cannot filter by Volza ID, and the free summary already shows name clashes. 10% margin
added. "Left" is after the $25.20 already spent.

**Recommended scope: the 2,388 suppliers with an EPB 61/62 record** (78% match, 68–88%):

| option | matched (low–high) | cost incl. 10% (low–high) | left of $3,000 at the high end |
| -- | -- | -- | -- |
| A: summary + top 1 shipment | 1,615–2,092 | $355–$382 | $2,593 |
| **B: summary + top 3 shipments** | 1,615–2,092 | **$533–$612** | **$2,363** |
| C: summary + top 10 shipments | 1,615–2,092 | $1,154–$1,418 | $1,557 |

All figures above come from `python ops/volza_live_sample.py --summarize` (it prints the group
split and these tables; subtract the $25.20 already spent for "left").

**The other 5,398 suppliers** (5% match): about 244 matches for about $607 at option A, since
roughly 5,150 misses cost $0.10 each. That is $2.49 per exporter found, against about $0.20 in the EPB
group. Better spent on demand: look a supplier up when a paying buyer opens its profile ($0.10–$0.25).

For reference, all 7,786 (23–35% match): A $957–$1,013, B $1,152–$1,315, C $1,832–$2,373.

## 5. Constraints found

- Supplier name: list of strings, 4+ characters, case-insensitive contains-match. Punctuation matters
  ("Ha-Meem" matches, "Hameem" does not).
- No filter by Volza company ID on the export call; the name is the only key.
- Unknown filters are ignored silently, not rejected.
- `max_count_per_page` 1–2000; pagination by `api_pagination` (the sandbox returned page numbers, not a
  cursor).
- Every call costs at least $0.10 live, even with no results; validation errors (400) are free.
- Sandbox: Jan–Mar 2021 only, no destination country in that data.
- The credit headers (`X-Credit-Limit/Used/Remaining`) are the **whole account's** totals on every key,
  sandbox included, not the cost of one call. A free sandbox call is a way to read the account's spend.
- The "Ltd." full stop matters: "Sisal Composite Ltd." finds nothing, "Sisal Composite" finds 1,660.
- 50 requests a minute; the script spaces calls 1.3 s apart (~46/min).
- Volza's licence (Shivani, 8 Oct): store up to one year, show to paying users inside the platform, no
  resale, never in an export or API we offer.

## 6. Design for the real fetch (build only after a yes)

- **Tier 6, attach-only.** Rows attach to suppliers we already publish from Tier 1–3 sources. Never
  creates a supplier, never overwrites a register fact.
- **New table** `volza_export_summaries` (supplier, name searched, exporters swept in, shipments, FOB,
  buyers, HS codes, top records as JSON, `fetched_at`, `expires_at = fetched_at + 1 year`) with a nightly
  purge of expired rows. Migration dry run first; applied only on "apply NNNN".
- **Ambiguous matches are stored but not shown** until a person confirms the right exporter, so one
  unit never wears its group's trade.
- **Shown** only to signed-in paying users on the supplier profile, labelled "Customs shipment records via
  Volza, fetched <date>". Not on public pages, not in any export or API.
- **Script**: built from `ops/volza_live_sample.py`, which already has the spend controls tested
  (`etl/tests/test_volza_live_sample.py`): `--apply` only, `--max-spend` checked before every call against
  the larger of our price tally and the rise in Volza's account counter (read first with a free sandbox
  call), counts network and server errors as the worst case and stops, stops at the cap, resumes from
  where it stopped, never follows pagination, no retries. Add: the EPB-only scope, the chosen record
  count, and a check that `api_request_details` echoes every filter sent. The founder runs it (the guard hook refuses
  `--apply` from an agent).
- Everyone outside the EPB group: on demand only, when a paying buyer opens the profile.

## 7. The question

Which option for the 2,388 EPB-registered suppliers: A (top 1), B (top 3, recommended) or C (top 10)?
Then: **may I build the real fetch with a cap of $385 (A), $615 (B) or $1,420 (C)?** The cap is the high
end of the range above; the script stops there even if more suppliers match than expected. Nothing is
spent until you run it, and the table and migration need your "apply" first.
