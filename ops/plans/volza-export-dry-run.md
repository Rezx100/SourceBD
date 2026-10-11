# Volza export data — dry run and a $25 live sample

Date: 10 Oct 2026. Scripts: `ops/volza_export_dryrun.py` (sandbox key only; steps `candidates`,
`match`, `overview`, `summarize`) and `ops/volza_live_sample.py` (production key, `--apply` only,
$30 cap, one shipment record per call). Raw Volza responses stay in `etl/raw/volza/` (gitignored);
this file holds counts and worked examples only. Every call is Bangladesh exports, HS chapters 61/62
only; no import data, no other HS chapters. Founder defaults applied: Volza is Tier 6 cross-check
data; RMG = BGMEA or BKMEA member, or EPB HS chapter 61/62.

**Spend so far: $93.95** (Volza's counter after the latest-shipment refetch, 11 Oct 2026; section 11). Was: **$25.20** of the $3,000 credit (Volza's own counter, read 10 Oct 23:3x), on the
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
unit price), labelled "Bangladesh customs export records · fetched <date>" (Volza is named on the data
sources page only; founder, 11 Oct 2026).

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

**Correction, 11 Oct 2026 (Volza's published spec, `backend.volza.com/swagger/v1/swagger.json`).** Two
of the "ignored" rows above sent names that are not fields. The documented ones are
`destination_country_name` / `destination_country_ids`, `supplier_company_id` (Volza IDs; overrides
`supplier_name`), and `buyer_name` with `buyer_name_search_type` / `supplier_name_search_type`
(`starts_with` by default, or `contains`, `exact`). `company-transaction-summary` returns top 10 buyers,
destination countries, ports and HS codes plus KPIs and 10 shipments per company; its price is not in
the spec (the $5 above came from Volza's pricing, not re-checked). The live check is
`ops/volza_filter_test.py` (cap $3).

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

- Supplier name: list of strings, 4+ characters, case-insensitive **starts-with** match (section 11 corrects "contains"). Punctuation matters
  ("Ha-Meem" matches, "Hameem" does not).
- The company-ID filter works, but shipment records carry no ID and the free list's IDs are other entities, so the name is the only key (section 11).
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

## 8. The 200-supplier sample, stored and shown (11 Oct 2026)

Founder, 11 Oct: keep the 200 sample results for one year and show them on the front end; visible to
Growth/Enterprise buyers and admins only.

- **Table** `volza_export_checks` (migration 0137): one row per supplier, matches and "nothing found"
  alike, so a fetch within the year skips them instead of paying again. `expires_at` is at most one year
  after `fetched_at` (a check constraint); the read deletes expired rows and never returns one.
- **Read** `supplier_volza_exports(slug)`: null unless the reader is an admin or on Growth/Enterprise and
  not suspended; only `exact` matches (41 of the 200). Dry run on production, 11 Oct, rolled back:
  anonymous null, admin 406 shipments, free user null, a row kept 13 months refused, an expired row
  deleted and not returned. Waits for "apply 0137".
- **Load** `python ops/volza_load_sample.py` (dry run: 200 rows, 41 shown, expiry 10 Oct 2027);
  `--apply` writes them, after 0137 is applied. No Volza calls.
- **Shown** on the record's Products tab under Export lines: "Customs shipments", drawn with the kit's
  Exports pattern (shipments, FOB value, buyers, largest shipment) and one source line "Bangladesh customs
  export records · fetched 10 Oct 2026". **Volza is not named on the profile** (founder, 11 Oct); it is
  named in section 9 of `/legal/data-sources`, with the paid-plan and one-year rules. Tests:
  `app/(app)/app/record-routes.test.ts` (no "Volza" on the profile), `components/site/legal.test.ts`.
- Today one account has a Growth/Enterprise plan and one is an admin; everyone else sees nothing.
- Deletion after a year: the first entitled read after expiry deletes expired rows (a free reader's view
  stays a read), the loader deletes them before writing and refuses a sample over a year old. Nothing
  deletes them if no one reads or loads; **before 10 Oct 2027**, add a daily purge to the VPS cron
  (the `ops/ledger_cron.sh` pattern) or delete the rows by hand. Dry run re-run at the final text, 11 Oct:
  same results, and the free reader's call left the row untouched.

## 9. Checking Volza's company list first (free test, 11 Oct 2026)

Founder, 11 Oct: fetch every company we hold (EPB-listed or not) without paying for empty searches or
spelling misses. Volza's company list (`companies/search`) is free with the sandbox key and is not the
2021 shipment data. Script: `ops/volza_directory_test.py` (174 lookups, 0 credit). For each of the 200
live-sample suppliers it looked up our name (starts-with, Bangladesh) and compared with the paid result:

| | result |
| -- | -- |
| suppliers with 2024–26 shipments that are on the list | **58 of 58 (100%)**; exact name 57 (the other is "Alema Textile" vs "Alema Textiles") |
| suppliers with no shipments that are NOT on the list | **86 of 142 (61%)**: these would be skipped, no charge |
| no shipments, but the exact name is on the list | 49: on Volza, but no HS 61/62 export in Sep 2024 – Aug 2026 (older exports, other goods or imports). Spelling is not their problem. |
| how many list entries a name has | a weak signal: requiring 2+ would drop 10 of the 58 real exporters, so not used |

**After 2021.** The list found every one of the 58 suppliers that shipped in 2024–26, so it is not limited
to 2021: new exporters are on it. (Only 5 of the 58 overlap the saved sandbox 2021 run, too few to count
"new since 2021" directly; the sandbox's 500 free export searches are spent, so that cannot be re-run.)

**Workflow for every batch:** look the name up on the list; not listed = skip (free); listed = one export
search using Volza's spelling. Per 200 suppliers: 114 export searches instead of 200, misses 56 instead
of 142, about $8.60 saved. For all 7,786: about 4,440 searches, about 2,180 misses ($218) instead of
about 5,530 ($553).

**Limits found.** Sandbox key: 1,000 calls a day, 30,000 a month, and 500 export searches in total
(spent). The list lookups for all 7,786 fit in 8 days of the daily limit. Whether Volza is happy for the
sandbox key to pre-screen production work is unasked; the paid lookup with `page_size=1` costs $0.011 a
supplier (about $86 for all 7,786) and is the clean alternative.

## 10. The hard group: non-EPB suppliers on the company list (free scan, started 11 Oct 2026)

Script: `ops/volza_company_list.py` (sandbox key, `companies/search` only, no export searches, credit stayed
at 25.200). Raw results: `etl/raw/volza/company_list.jsonl` and `company_list_sample.jsonl` (gitignored).

**The 1,000.** Non-EPB, published, not in the 200-supplier sample, every name we hold; candidates from
`candidates.json` (built 10 Oct), sorted by id and shuffled with seed **20261011**. Per supplier, at most 4
lookups, stopping once our name is found: starts-with on our cleaned name, contains on it, then contains on
our other names and spelling forms (`&`/`and`, `Inds`→`Industries`, `Mfg`→`Manufacturing`,
`Knit Wear`/`Knitwear`, hyphen and full-stop forms). Classes: exact (normalizes equal), close (fuzzy ratio
≥ 90), several (ours is found and 2+ different names contain ours), other (only other companies), not listed.

**Progress.** The sandbox key had 287 calls left today, so the scan stopped at 23 left after **109 of the
1,000** (206 calls, 1.9 a supplier, no errors; Volza echoed the contains setting every time). It resumes
with the same command: about 1,700 calls, two more days. The figures below are the first 109.

| class | suppliers |
| -- | -- |
| exact | 35 |
| close | 0 |
| several | 8 |
| other (only different companies, e.g. "Expressions" → "Shanta Expressions") | 6 |
| not listed | 60 |

So **43 of 109 (39%)** are on the list under our name; 66 would be skipped for free. Starts-with found 42
of the 43; the spelling forms rescued one ("DK KNIT WEAR" → "Dk Knitwear Ltd"), at about 1.5 extra
calls for every miss. Spelling is not what keeps this group off the list.

**Hand check.** No "close" results yet, so nothing to check there. Of the 8 "several", **5 are one company**
whose second list entry is a typo or a pasted address ("Annesha Style Lyd", "Jams Apparels Pvt Ptd",
"Sky Apparels Ltd Ho Water Fr", "Ital Adweg Pvt Ltd House 966"), and **3 really share the name** with other
firms (Printex with "Printex Chemizol Dyestuff", Badhan Corporation with Badhan Enterprise/Industries,
Trutex Apparel with "Trutex Apparel House"). For those 3 the paid search needs the full legal name.
The 30 + 20 check reruns when the scan finishes.

**A second free signal? No.** The list returns only a name and an ID (city is a filter, not a field). On
the 53 non-EPB sample suppliers the list found in section 9 (58 calls), with the paid result known:

| signal | 6 that shipped | 47 that did not |
| -- | -- | -- |
| our name exact/close/several on the list | 6 | 42 (5 were other companies' names) |
| list ID (lower = older entry) | 21M – 146M | 7.7M – 134M: no separation |
| 3+ list entries | 4 | 8 of 42: but drops 2 of the 6 real exporters |

Requiring an exact name is free and loses nothing (53 → 48). Nothing else separates real exporters
without dropping real ones, so about **1 in 8** listed non-EPB suppliers will have shipments.

**Proposed first paid batch.** The 43 found so far, one export search each with Volza's spelling
(full legal name for the 3 true "several"). Expect about 5 with shipments. Cost: 38 misses × $0.10 +
5 hits × $0.15 = about $4.55; **cap $6**. If the hit rate holds near 1 in 8, the full 1,000 would list
about 390, costing about $45 for about 50 exporters (cap $55), asked separately after the scan ends.

**Batch 1 approved (founder, 11 Oct 2026: "spend only $6", and store the results).** Script:
`ops/volza_batch.py` (hard cap $6, one search per supplier, the name that found it on the free list;
Badhan, Trutex and Zehad narrowed by hand). Results go to `etl/raw/volza/batch_1.jsonl`, then into
`volza_export_checks` through `ops/volza_load_sample.py --file etl/raw/volza/batch_1.jsonl` (matches
and "nothing found" alike, each row expiring a year after its own fetch time). The founder runs both.

**Batch 1 result (11 Oct 2026).** 43 searches, **$4.75** spent. **9 of 43 (21%) had 2024–26 shipments**,
better than the 1 in 8 the sample suggested: 6 clean (Jadid Apparels 291 shipments and $16.2M to 36
buyers; NGS Fashion 12; Printex 9; Lucas Fashion, Azmery Garments, JNG Fashion Fabrics 1 each) and 3 whose
name swept in other exporters (Tirnoi Fashion 2 exporters, Ital Adweg 4, Trutex Apparel 3, even with
"Ltd" added). 34 found nothing. Not listed on the free list (66 of the 109) were skipped at no charge.

## 11. Audit, and the cheapest accurate fetch for launch (11 Oct 2026, nothing spent)

Sources: Volza's spec (`backend.volza.com/swagger/v1/swagger.json`) and its docs site
(`docs.volza.com`, which answers a normal browser; its pages are drawn by script, so they were read
from the site's own content files), the saved results in `etl/raw/volza/`, and 10 free calls (4
company-list lookups, which also read the credit counter, and 6 deliberately incomplete or
wrong-method requests, which Volza does not bill; the counter did not move). Pricing script: `ops/volza_launch_plan.py`.

### What was wrong

| # | claim | what is true |
| -- | -- | -- |
| 1 | PR #443 holds 0138, the spec, the filter check and the refetch | #443 merged on 10 Oct with its first 3 commits only. The other 8 never had a PR; this section's PR carries them |
| 2 | about $31.70 spent; the refetch of the 47 not yet run | Volza's counter: **$35.65 used, $2,964.35 left**. The refetch ran (`refetch_1.jsonl`, 47 rows, every count identical to the first fetch). Our own tallies add up to $38.35, so they overcount; the counter is the number to trust |
| 3 | supplier name is a contains-match | **starts-with** (the spec's default; every one of the 67 live hits' names begins with the name searched). "Square Apparels" sweeps in any firm whose name starts that way |
| 4 | `supplier_company_id` does not work | it works: an ignored filter returns everything (469,466 shipments in the sandbox), this one returned 0. The free list's IDs belong to other entries: Aboni files its shipments as "Aboni Knit Wear Ltd", a spelling the list does not hold (looked up 11 Oct). Records carry no company ID, so IDs are a dead end |
| 5 | a filter missing from the echo was ignored | the echo has no field for `supplier_company_id` or any `*_search_type` (spec), so silence there proves nothing. Judge by the count |
| 6 | the free list gives Volza's spelling | it gives presence only: 4 of the 58 sample exporters ship under a spelling the list lacks (Dharla Fashions, Ever Fashion Tongi, Radix Collections, Alema Textiles). As a skip filter it held (58 of 58) |
| 7 | `buyer_name` is unresolved | likely resolved through the company list: "New Yorker" has 269 list entries, but not "New Yorker Fashion Logistics Int L", the buyer on Aboni's record, hence 0. "Tesco Stores Ltd" is listed 80 times; the pending Tesco check settles it |
| 8 | summary only with `max_count_per_page: 0` | not allowed (minimum 1). Dropped |
| 9 | company summary "believed $5" | **confirmed** (docs): $5 whenever it finds anything (1 to 10 records), $0.10 when empty. By name it is a "like" match that adds up every match, so it mixes companies |
| 10 | bulk export may be far cheaper | no: a fixed charge per export plus the same $0.05 a record (Bangladesh Export T3). Aboni alone is 4,652 records ($233) |
| 11 | market research endpoint | an internal step of Volza's web app (takes the app's user ID), not something we can buy. The docs' cheaper "Buyer/Supplier Insights" call ($0.10 + $0.10 a record, with top buyers and countries) no longer exists: every unknown address falls through to the shipment search |
| 12 | counts are shipments | no call ever set `remove_duplicate_shipments`; our shipment counts and values may include records Volza itself flags as duplicates. Batch 0 checks it on Aboni |
| 13 | the reveal's top buyers come from the 25 most recent shipments | for the median shown exporter (142 shipments in two years) that is about 4 months; for Aboni about 2 days. Use the largest shipments, not the most recent |

Code (fixed in this PR, tested in `etl/tests/test_volza_live_sample.py`): a search Volza rejected
(400) or rate-limited five times was written as "nothing found", which the loader would have stored
for a year, hiding the supplier; now the batch skips it, the loader refuses it, and a stuck 429 stops
the run. The spend guard took its one-record worst case from a module constant that the filter check
overwrote; it now follows the records each call asks for. The credit counter was read through a
sandbox export search, whose 500 are spent; it now uses the free company list.

### What one call can tell us (Bangladesh exports, $0.10 + $0.05 a record)

The summary comes with any call: shipments, value, number of buyers, exporters, HS codes, ports and
destination countries. It never names them. Names come only from records (one shipment each: date,
HS code, product text, buyer, destination country and port, value, unit price, weight). So **counts
are cheap and every name costs a record.** A destination filter turns the summary into a per-market
answer (Aboni to the UK: 1,073 shipments, US$14.65m, 17 buyers), and that call's one record is the
biggest shipment to that market, which names its biggest buyer there.

### The design

1. **Preview** (held for 290 suppliers): one starts-with search, 1 record, biggest shipment first.
2. **Narrow** a name that swept in other exporters: one more search with
   `supplier_name_search_type: exact` on our legal name in its suffix forms ("X Ltd", "X Ltd.",
   "X Limited", "X (Pvt) Ltd") plus the spellings seen in records that equal ours. Bangladeshi
   company names are unique, so the exact legal name is the same company; anything else stays
   hidden. The rule is checked in batch 0.
3. **Markets**, for every supplier shown that ships to more than one country (81% of the 47): four
   searches (UK, US, the 27 EU countries in one call, Canada), 1 record each. Per market: ships there
   or not, shipments, value, buyers, and the biggest buyer and product there.
4. **Top buyers and product headings** at launch: the up to 5 buyers and HS codes named by the
   biggest shipment overall and per market, labelled as such ("biggest shipment to the UK: Tesco
   Stores, HS 6108"). A true top-10 list costs $5 (company summary) or many records; it belongs in
   the reveal, sorted by value, for the suppliers buyers actually open.

### Price for the 2,321 EPB suppliers not yet checked (78% have shipments, 27% of names sweep)

| package | per supplier | all 2,321 |
| -- | -- | -- |
| A preview only | $0.17 | $395 |
| **B preview + narrow + 4 markets (recommended)** | **$0.42–0.55** | **$977–1,269** |
| C B plus the 10 largest shipments | $0.86–0.99 | $2,006–2,297 |
| Volza's company summary | $5 a supplier with shipments | about $9,000 |

Plus markets for the 47 exact rows already held: up to $23. The other 5,222 RMG suppliers: free list
first (about 10 days of the sandbox's 1,000 a day), then B on the roughly 2,000 listed: about
$375–445 for about 430 exporters. B everywhere: about **$1,400–1,750 of the $2,964 left**, leaving
the rest for reveals and next year's refresh (every row expires a year after it is fetched).

### Batches

- **Batch 0, rule checks (the first question).** Seven searches on suppliers whose answer we know:
  duplicates removed on Aboni, the EU-27 in one call, and the exact-name rule on Utah, Square
  Apparels, Sisal and Rhythm (one in upper case). $1.05, run with the three checks already approved
  ($0.90) inside the same $3 cap: `python ops/volza_filter_test.py --rules` shows the plan; the
  founder adds `--apply`. Each answer changes batch 1: if the EU list or the exact rule fails, B
  needs more calls; if duplicates are many, every count shown so far is high.
- **Batch 1 onward, about $50 each.** 90 EPB suppliers per batch with package B, hard cap $50:
  expect about 70 with shipments and 55–65 shown with their four markets. The script is built after
  batch 0, from `ops/volza_batch.py` (guard, resume, per-supplier saving). About 26 batches for the
  EPB group, then the non-EPB group once the free list scan ends.

### Ask Volza (free; email helpdesk@volza.com, the founder sends)

1. Company search gives Aboni Knitwear the IDs 70153649 and 33452214, which return no Bangladesh
   export shipments, while the name "Aboni Knit Wear" returns 4,652. How do we get the ID the
   shipments are filed under?
2. A volume price for the company transaction summary, for about 2,000 Bangladeshi exporters.
3. May we use the sandbox key's free company search to decide which production searches to run?

### Batch 0 result (11 Oct 2026, founder ran it; $1.00 by Volza's counter, 35.650 → 36.650)

Ten searches (three approved earlier, seven new), every response saved whole in
`etl/raw/volza/filter_test.json`.

| check | result | what it means |
| -- | -- | -- |
| duplicates removed, Aboni | 4,652 shipments, $97.6m: unchanged | no duplicate flags here; our counts stand. The flag is sent anyway from now on |
| the 27 EU countries in one call, Aboni | echoed all 27; 2,342 shipments, $60.2m, 81 buyers, 12 EU countries | **one EU call works**; four market calls per supplier, as planned |
| buyer "Tesco Stores", Aboni | 296 shipments, $8.1m | buyer names work when the buyer is on Volza's company list |
| brand only "PRIMARK", no supplier | 0 | a brand-first search is not reliable; not used |
| 10 largest shipments, Aboni | 3 buyers in 10 (New Yorker, Inditex, Moris MJ), 3 countries | the largest shipments name few buyers: the four market calls name more, cheaper |
| exact name, Utah / UTAH / Square Apparels / Sisal / Rhythm | the same totals and exporter counts as starts-with, every time | either "exact" is ignored, or every swept-in "exporter" is the same name filed under several Volza IDs. Two $0.10 checks without "Ltd" tell which (below) |

**Volza does not charge twice for a shipment record we already bought.** Every call in batch 0
cost $0.10 even with records, because each record had been fetched before (the 10-record call's
records were bought in the first run, whose result was lost). The same explains two old gaps: the
refetch of the 47 cost $4.70 by the counter, exactly 47 × $0.10, not our tally of $7.05; and the
sample's record fees came to 60 records ($3.00) for 67 record-bearing calls, the 7 repeats free.
So a market call whose biggest shipment was already bought costs $0.10, and so does fetching any
supplier again. Package B's top end ($0.55) is an overestimate.

**Next check, $0.30 at most, inside the same $3 cap ($2.00 spent):** exact "Utah Fashions" and exact
"Aboni Knit Wear", both without "Ltd". No shipment carries those names exactly, so 0 means the
exact setting works and the "ambiguous" names are one company under several IDs (shown after one
$0.10 exact call each); the full totals mean it is ignored, and ambiguous names stay hidden.

**Result (founder ran it, 11 Oct; $0.20, counter 36.650 → 36.850; $2.20 of the $3 cap):** both
returned **0**. The exact setting works, and case does not matter. So for Utah, Square Apparels,
Sisal and Rhythm, every shipment the starts-with search swept in carries our own legal name: the
"2–4 exporters" are one company filed under several Volza IDs, not other companies. A name that
sweeps in others is settled with one exact search on our legal name in its suffix forms: what it
finds is ours and can be shown; what it does not find stays hidden.

### Batch 1 (proposed, cap $50): `ops/volza_launch.py --batch 1`

Package B, everything Volza returns kept per call (whole response and credit headers), one row per
supplier in `etl/raw/volza/launch_1.jsonl`, resumable, a refused search never stored as "nothing
found". In this order until the cap:

1. the 47 exact suppliers already shown: the four market calls for the 38 that ship to more than
   one country (about $15–23; the biggest shipments already bought cost $0.10 a call);
2. the 18 held names that swept in other IDs: one exact search each, then the markets for those it
   settles (about $2–13);
3. EPB suppliers not yet checked, in a fixed shuffled order (seed 20261011): preview, exact search
   when needed, markets. About 30–70 suppliers with what is left.

Expected: about 60 suppliers newly shown or completed with UK, US, EU and Canada figures and the
biggest buyer in each. The market figures stay in the raw file until a database column holds them
(the card work, spec slice B); previews load with `ops/volza_load_sample.py --file
etl/raw/volza/launch_1.jsonl` once 0138 is applied. Tests: `etl/tests/test_volza_live_sample.py`.

### Small-orders check (11 Oct 2026, founder ran it; $0.30, counter 36.850 → 37.150; $2.50 of the $3 cap)

Volza's quantity filter works (`"quantity": {"operator": "lt", "value": n}`; the echo has no field
for it, the counts prove it): Aboni has 950 of 4,652 shipments under 1,000 units (20%) and 2,295
under 5,000 (49%). **Units matter:** the biggest "small" line is 720 KGS, which its product text says
is 4,292 pieces, so a supplier that declares some lines in kilos would look smaller than it is.
37 of the 47 shown suppliers ship only in pieces (one unit, PCS); the other 10 mix pieces and kilos.

So batch 1 adds one search per exact supplier that ships only in pieces: shipments under 1,000
pieces (about $0.10–0.15 each, about $4–6 for the 37 held ones), for a card line such as "20% of its
shipments were under 1,000 pieces". Suppliers with mixed units get no such line.

Unit prices come with every record bought (declared FOB at the Bangladesh port, per shipment line,
not per order). The card shows the biggest shipment's price per market; a full list belongs in the
"See recent shipments" table bought for a credit (spec slice C), most recent first.

### Launch batch 1 result (11 Oct 2026, founder ran it)

365 searches, all answered (no refusals, no errors). Our tally $49.95 (the cap stopped it); Volza's
counter 37.150 → 83.500, so $46.35: records already bought were free again. Raw rows, every response
whole: `etl/raw/volza/launch_1.jsonl` (86 rows; one, Textune Apparels, stopped halfway and is fetched
again next batch).

| group | suppliers | result |
| -- | -- | -- |
| exact, already shown | 47 | all completed: markets for 38, small-orders search for those in pieces only |
| swept names held hidden | 18 | 12 now shown; 6 stay hidden (below) |
| new EPB suppliers | 21 (one partial) | 14 shown, 1 likely another firm ("Interlink Dresses Shirin Chowdhury Complex"), 5 nothing found; $0.55 each |
| **ready to show** | **73** | the loader's dry run, after the rule below |

**The exact-name search is not enough on its own.** For 15 of 22 swept names it kept every shipment
(Utah, Square Apparels, Sisal, Loyal, Rupa Fabrics, Tex Tech…). But for Columbia Apparels it kept 84
of 2,468 although it found the same Dhaka factory and the same Target shipment; for Rashad Industries
it picked a namesake in Kolkata; Fashion Trousers kept 8 of 152 and Trutex 7 of 22. **Rule (in
`ops/volza_launch.py` and the loader): a swept name is shown only if its exact search keeps 90% of
the shipments; otherwise it stays hidden for a person to check.** Hidden now: Columbia, Rashad,
Fashion Trousers, Trutex, Dharla (ships as "Dharla Fashions", plural) and Radix (another firm). Of all
records bought, only Rashad's came from a factory outside Bangladesh. Also fixed: our name cleaner cut
"Nipun (Pte) Ltd." to "Nipun (Pte" in the 10 Oct candidates file; names are now rebuilt each run.

**What the 73 look like.** 62 ship to two or more countries, 11 to one. Of the 62: EU 60, US 45,
UK 40, Canada 34 (median shipments where they ship: EU 138, UK 54, US 41, Canada 19). 162 different
buyer names across the market rows. 56 ship in pieces only; their share of shipments under 1,000
pieces runs from 0% (13 suppliers) to 89%, median 9%. Every record bought was in pieces, but 6 of
252 prices are clearly not per piece (men's shirts at $183.51, socks at $29.69): a price check is
needed before showing one.

### The card, line by line (for the design; all from what one supplier row holds)

| line | formula | shown when |
| -- | -- | -- |
| Header cell | "{shipments} shipments · US${value} · 2 yrs" | class exact |
| Buyers | "{buyers} buyers" | class exact |
| Reach | "Ships to {countries} countries" | class exact |
| Average shipment | value ÷ shipments, "about US${avg} a shipment" | class exact |
| Market row (×4: UK, US, EU, Canada) | "{market}: {n} shipments · US${value} · {buyers} buyers" | n > 0 |
| Market none | "No shipments to {market}, Sep 2024 – Aug 2026" | n = 0 and the markets were fetched |
| Biggest buyer per market | "Biggest shipment to {market}: {buyer}, {product}, US${unit price} a piece" | n > 0; price only if it passes the price check |
| Single-country supplier | the market row comes from the biggest shipment's destination, no other market rows | 1 destination country |
| Small orders | "{share}% of its shipments were under 1,000 pieces" | small-orders search done (pieces only); 0% shown as "None under 1,000 pieces" |
| Products | "{n} product codes"; named codes only from the biggest shipments, as "Shipped" tags beside the EPB list | class exact |
| Hidden | nothing; admins see "needs a person: name matched several Volza records" | class ambiguous or likely |
| Checked, nothing | "No customs shipments found under this name, Sep 2024 – Aug 2026" | class none |

Buyer names, tidy rule: keep the text up to and including the first legal ending (Ltd, LLC, Inc,
GmbH, B V/BV, S A/SA, S L, S p A, Corp, Co KG, Z O O, LP), otherwise up to the first number; title
case; label "buyer on the customs record" (often a shipping arm or a Bangladeshi middleman, e.g.
"Padma Textiles"). Price check: show a unit price only when it is under 3× the median price for the
same 4-digit heading across stored rows (with 5+ rows for that heading), else show the shipment
without a price. Never call the small-orders line a minimum order.

### Database and the latest shipment (11 Oct 2026)

Applied on the founder's "apply": 0138 (whole summary and record), 0139 (markets, small_orders),
0140 (record_sort: is the stored record the biggest or the latest shipment). Batch 1 loaded: 263
rows, 73 shown, 62 with markets, 56 with small orders, none of the hidden rows carrying markets.

The card's band shows "Latest shipment on record: <date>" (design session, 11 Oct), so preview and
exact searches now sort by date and market searches stay value-sorted. The 73 shown were refetched
latest-first (`ops/volza_launch.py --latest`, founder ran it): 73 searches, all sorted by date per
Volza's echo, **$10.45** by the counter (93.950). Loaded: all 73 have record_sort 'date'. Latest
shipment on record: Aug 2026 (the end of Volza's data) 50, Jun–Jul 2026 11, 2025 to early 2026 9,
Sep–Nov 2024 3. Raw rows: `etl/raw/volza/latest_1.jsonl`.
