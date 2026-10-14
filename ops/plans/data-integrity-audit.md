# Data integrity audit: where the site contradicts itself, a register, or its own claims

13 Oct 2026. Founder's brief: audit the data and every endpoint the way a hostile buyer or a
data-audit firm would. Read-only: nothing was changed, nothing was fixed.

Measured by two scripts, both GET-only and re-runnable:

- `ops/audit_data_integrity.py --cache DIR` (the database: 73 checks, 49 with something to report; the ids below are its ids)
- `ops/audit_endpoints.py --cache DIR` (the live site and the database API as a signed-out visitor)

Figures are as pulled at about 15:00 on 13 Oct 2026: **10,811 rows, 10,025 published, 744 buildings,
22,824 register entries.** Another session was changing data during the audit (published went to
10,027 by the evening), so a re-run will differ by a few.

Severity: **S1** wrong about a company, or something reaching a reader who must not have it.
**S2** the site contradicts itself, or a public claim the data does not support. **S3** stale or
missing. **S4** untidy. Inside a level, most published companies first.

"Needs your yes" means the fix changes what a buyer sees or changes production data (AGENTS rule 15).

---

## S1: wrong about a company

### S1-0. The key that encrypts buyer–supplier messages can be read by anyone

- **What a tester sees:** one request to the database API, with the public key every visitor's
  browser already holds, returns the message encryption key. Call: `GET /rest/v1/rpc/_messages_key`.
  Answered 200 with a 64-character string on 13 Oct 2026 (the script reports its length, never the value).
- **How many:** one function. 5 messages in 7 threads exist today. The messages themselves stay behind
  row rules, so the key alone opens nothing, but it removes the second lock.
- **Cause:** `_messages_key()` runs with the owner's rights and was left executable by every role.
- **Smallest fix:** a one-line migration, `revoke execute on function public._messages_key() from public, anon, authenticated`
  (the functions that use it run as the owner and keep working), then a new key and the 5 messages re-encrypted,
  because the old key must be treated as known.
- **Needs your yes:** yes (a migration on production).
- **Fix built, 13 Oct 2026:** `supabase/migrations/0151_messages_key_lock.sql` closes the function to every
  client role, makes a new key and re-encrypts the messages under it, with one `messages.key_rotated` entry
  in the activity record. Dry run on production, rolled back: 5 of 5 messages re-encrypted, none open with
  the old key, visitors and signed-in users refused.
- **Applied on production, 13 Oct 2026 (10:44 UTC), on the founder's "apply 0151":** 5 of 5 messages re-encrypted,
  0 left unreadable; the same GET as a signed-out visitor now answers 401 (permission denied); one
  `messages.key_rotated` entry in the activity record and no per-message entry. Still to do, by the founder:
  the offline copy of the new key (`docs/runbooks/messages-key-offline-copy.md`, steps 1 to 4).

### S1-1. The safety register lists the factory as Ineligible; our page says there is no RSC record

- **What a buyer sees:** the RSC tile reads "Not covered · no RSC record" and the Safety section reads
  "No active RSC record on file… This company is not one of them". Signed in it is stronger: "This factory
  is not on the RMG Sustainability Council's list." Lower on the same page, Sources lists RSC with the
  factory's RSC number and "read 2 Oct 2026". RSC's own status for that entry is **Ineligible** (its word for
  a factory no longer eligible to supply its member brands).
- **How many:** **372** company pages (`S1a`); 368 of them say "no RSC record".
- **Examples:** `minar-textile`, `4-stitch-knit-composite`, `genetic-fashions`.
- **Cause:** the page shows a safety row only when it is marked active, and treats "no active row" as
  "no record". The register's status name is kept on the entry but never shown.
- **Smallest fix:** print the register's own status wherever RSC is shown: "RSC lists this factory as
  Ineligible · read 2 Oct 2026". One field added to what the profile returns, one line of wording.
- **Needs your yes:** yes (the wording, and a migration for the field).
- **Fix built and applied, 13 Oct 2026:** `supabase/migrations/0152_profile_rsc_listed_status.sql` adds `rsc_listed`
  to the profile (every RSC entry that is not active, in the register's own word) and the record prints it
  (PR 534). Applied on production on the founder's "apply 0152": for five companies the rest of the payload is
  byte-for-byte what it was, and `minar-textile`, `4-stitch-knit-composite` and `eurotex-fashion` each carry their
  Ineligible entry. The new words reach buyers with the next release; until then the page reads as before.

### S1-2. A trade-body membership shown on a company that the register files under another name

- **What a buyer sees:** Memberships carries a BGMEA or BKMEA number. Open the register and that number
  belongs to a differently named company.
- **How many:** the saved checks, re-run today (rule 14, nothing re-measured):
  `ops/report_bgmea_identity_gap.py`: **188** BGMEA entries name someone else, on **163** companies; on **47**
  every BGMEA entry names someone else (`ops/plans/bgmea-identity-gap.md`, refreshed in place).
  `ops/check_supplier_conflations.py --rest`: FAILS with 20 companies holding BKMEA entries for more than
  one company, 23 BGMEA entries on a different company, 248 companies holding two or more member numbers
  from one body (281 extra numbers).
- **Examples:** `hamid-sweater` (holds Ever Knit Ltd.'s entry), `al-yusra-textile`, `ags-apparels`.
- **Cause:** older merges and name-only matching. Some of the 23 are today's merges you approved, where a
  trade body lists two members and you chose one company; the check cannot know that.
- **Smallest fix:** show a membership number only when the register's name for it matches (option
  "ii-open" in the saved report: 188 numbers hidden, 47 companies lose the BGMEA pill).
- **Needs your yes:** yes (it removes pills a buyer sees today).

### S1-3. BTMA lists the mill under suspension; our page shows a plain membership

- **What a buyer sees:** Memberships: "BTMA registration number 52". BTMA's own list files the mill under
  "Mills Under Suspension". Nothing on the page says so.
- **How many:** **87** companies (`M1`). **80** of them are published on that one entry alone.
- **Examples:** `nm-spinning-mills`, `a-and-a-textiles`, `hasanat-khan-spinning-mills`.
- **Cause:** the status is read and stored (`btma_status`), never shown; the "BTMA verified" flag is set for all 92 entries.
- **Smallest fix:** show "Under suspension (BTMA, read 21 May 2026)" beside the membership. Then your call:
  does a suspended membership alone keep a company published?
- **Needs your yes:** yes.
- **Fix built, 13 Oct 2026:** `supabase/migrations/0154_profile_membership_status.sql` adds `membership_status` to the
  profile (BTMA's own status for each entry) and the membership reads "BTMA (under suspension)" beside its number and
  read date, on the desktop, phone and public record. **Applied on production, 14 Oct 2026**, on the founder's
  "apply 0154": the function on production is byte for byte the repo's, the rest of the payload is unchanged for five
  companies compared before and after, and `nm-spinning-mills` carries both its suspended entries. The words reach
  buyers with the next release. Still open, and yours:
  whether the 80 companies published on a suspended BTMA entry alone stay published.

### S1-4. Phone numbers and mailboxes inside address text, open to a signed-out visitor through the database API

- **What a tester sees:** the site itself is clean: the public page and the signed-in record strip them
  (checked on six companies). The database API is not: `buyer_supplier_profile()` and the readable
  `suppliers.address_raw` column return the address as filed, and some filed addresses carry a phone
  number, a mailbox or a website.
- **How many:** **67** companies through a register entry's address (`K2`: 53 labelled phones, 38 mobile
  numbers, 8 mailboxes, 11 web addresses), **2** through the company's own address (`K1`).
- **Examples:** `ayaan-clothing`, `muk-clothing-designers`, `dk-knitwear`.
- **Cause:** the contact stripper runs in the app. The database hands the raw text to anyone holding the public key.
- **Smallest fix:** strip at the source: clean the 69 stored texts once, and run the same rule in the two
  public functions. Contact columns themselves are refused to a visitor (checked: 401 on all seven).
- **Needs your yes:** yes (a data change and a migration).
- **Fix built, 13 Oct 2026:** `supabase/migrations/0153_address_contact_strip.sql`. The database strips contact
  details itself (`strip_contact_text()`): every public function now reads register addresses through a view that
  strips them, the entries themselves stay as filed, and the company's own address is cleaned once (3 rows) and
  kept clean by a trigger. Dry run on production, rolled back: 71 entry addresses carry a contact detail as filed,
  0 through the public view; 3 company addresses cleaned, 0 left. Not applied: the founder said "apply 0153"
  three times on 14 Oct 2026 and the confirmation prompt for it was declined each time, so production is unchanged.

### S1-5. A safety-register entry filed under a different company's name

- **What a buyer sees:** Safety shows inspection progress and a worker count for this company. The register
  files that entry under a sister concern: Chorka Textile's page carries "Chorka Apparels Ltd"'s record.
- **How many:** **50** company pages (`F3`), by the repo's own same-company rule. Units and loose spellings
  are in there too; each needs a read before anything moves.
- **Examples:** `chorka`, `moon-knitwear`, `reaz-knitwear`.
- **Cause:** matched on the group word in the name.
- **Smallest fix:** a review list of the 50, like the duplicates page: keep, move to the right company, or attach as a building.
- **Needs your yes:** yes, per row.

### S1-6. One building shown as active while another entry on the same company is not

- **How many:** **21** company pages (`S1b`). The page shows the active building's progress; the other
  entry (Ineligible, No brand, Pending Closure) appears only as a number under Sources.
- **Examples:** `eurotex-fashion`, `ab-apparels`, `ratul-knitwear`.
- **Cause and fix:** the same as S1-1: show every entry with its status.

### S1-7. One certificate number on two companies

- **What a buyer sees:** the same OEKO-TEX certificate on two differently named companies' pages. A
  certificate has one holder.
- **How many:** **13** companies, **8** certificate numbers (`F2`).
- **Examples:** `fakir-fashion` / `fakir-apparels`, `ripon-knitwear` / `ripon-apparels`, `blue-seal-textile` / `sea-blue-textile`.
- **Smallest fix:** read the 8 on the certification body's page and keep each on its holder.
- **Needs your yes:** yes, per pair.

### S1-8. One BKMEA membership number on two differently named companies

- **How many:** **8** companies, **4** numbers (`F1`). (The handoff said 5 pairs; one has since been merged.)
- **Examples:** `euphoria-textile` / `euphoria-apparels`, `ams-knit-fashion` / `dams-knit`,
  `fatullah-fashion` / `fatullah-apparels`, `hrs-composite-tex-wear` / `polestar-apparels`.
- **Smallest fix:** read the four on BKMEA and remove the entry from the wrong one of each pair.
- **Needs your yes:** yes, per pair.

### S1-9. A withdrawn SA8000 certificate, shown only as expired

- **How many:** **3** (`E1`): `lenny-fashions`, `lenny-apparels`, `modele-de-capital-industries`. The register
  says "Withdrawn/cancelled"; the page can only say expired, with the date.
- **Smallest fix:** show the register's status word. Small, and it rides with S1-1.

### S1-10. Customs figures matched to an exporter with a different name

- **How many:** **3** of 228 "exact" matches (`F4`): `ever-fashion`, `interlink-dresses`, `radix`. To be read, not assumed wrong.

---

## S2: the site contradicts itself

### S2-1. The methodology page says the six sanctions lists are "Not read yet"; every company page says "Not listed"

- **What a buyer sees:** `/methodology`, Tier 5 table: UFLPA, OFAC SDN, UK OFSI, EU, US WRO and ILAB each read
  "Listed, no records yet · Not read yet". Every company page says "Sanctions: Not listed… what those lists held
  on the day they were read."
- **The truth:** all six were read between 6 and 11 Oct 2026 and hold 13,837 listed entries.
- **Cause:** that table counts register entries per source, and a sanctions list never makes a register entry.
  The right figures are already public in `sanctions_lists_read()`.
- **A second, smaller truth inside it:** that function itself reports **no completed read for UFLPA and US WRO**
  (the last runs were partial: 48 and 8 entries not seen), so for those two the honest wording is "partly read".
- **Smallest fix:** feed the Tier 5 table from `sanctions_lists_read()`. Front end only.
- **Needs your yes:** no data change; yes to the wording for the two partial lists.
- **Fix built, 13 Oct 2026:** PR 535 feeds the table from `sanctions_lists_read()`; UFLPA and US WRO read
  "Read in part, no full read yet". Front end only: it reaches buyers with the next release.

### S2-2. Search and the company page give two worker figures, and the caption describes the wrong one

- **What a buyer sees:** search and the CSV export say 300 workers; the company page's Workers tile says 907.
  The tile's caption reads "the number of production workers the company itself filed", but the figure is the
  safety register's headcount across buildings. On some pages the line under it reads "excluded: <this
  company's own name>".
- **How many:** **1,109** published companies (`W1`); on **77** the page figure leaves the company's own row out.
  In the 40-company comparison this was the only field that disagreed (21 of the 39 compared).
- **Examples:** `sm-knitwear` (300 against 907), `fakir-fashion` (18,902 against 5,122), `ats-apparels` (150 against 2,656).
- **Cause:** two figures by design (your rule of 24 Sep); the tile's caption and the "excluded" line were never
  brought into line with it.
- **Smallest fix:** on the tile, print the filed figure first and the safety-register figure second, each
  named, as search already does. Front end only.
- **Needs your yes:** yes (which figure leads).

### S2-3. Safety-register status other than active, not stated

- **How many:** **606** pages (`S1d`): Ineligible 372 (S1-1), No brand 132, Pending Closure 55, inactive 54. 585 say
  "no RSC record" beside an RSC number in Sources. Same cause and fix as S1-1.

### S2-4. Typed "buying house" while holding only a manufacturer's BGMEA membership

- **How many:** **503** (`H1`), the same count as `ops/plans/bgmea-entity-type.md`. Repair is rehearsed and waits
  for your word. Counted here, not touched. A further **6** are typed buying house while holding a
  safety-register entry or sewing machines (`H2`): `am-fashion`, `danny-dhaka`, `mim-fashion-wear`.

### S2-5. BTMA "registration number" is the mill's position in a list

- **How many:** **421** companies (`M2`). The number shown is `btma_sl_no`, a serial in BTMA's page. It
  changes when BTMA re-orders the list; `nm-spinning-mills` shows two of them (52 and 59).
- **Smallest fix:** label it "listed, no. 52 on BTMA's list" or drop the number. Front end only. Needs your yes (wording).

### S2-6. "Suppliers with a record" on the methodology page counts rows a buyer cannot open

- **What a buyer sees:** `/methodology` says H&M 200, RSC 2,256, Marks & Spencer 67. Filter search by the same
  source: H&M 164, RSC 1,619, M&S 50.
- **How many:** every row of the table is over by the unpublished rows and buildings: RSC +637, H&M +36,
  BGMEA +49, OEKO-TEX +42, GOTS +18, M&S +17, Next +16, WRAP +15.
- **Cause:** `marketing_facts()` counts every row holding an entry, published or not.
- **Smallest fix:** count published companies (a building counts for its company). One function. Needs your yes (a migration).

### S2-7. A BGMEA mark with no BGMEA entry

- **What a buyer sees:** the BGMEA mark on the search card, and "BGMEA" in the Sources column of the CSV
  export. The company page lists no BGMEA entry.
- **How many:** **59** (`C1`, `C6`), all BKMEA members. `3s-textile`, `hn-apparels`, `pretty-composite-textiles`.
- **Cause:** a stale flag and tag left from before the entries were moved. A further 10 hold an entry with the flag off (`C2`).
- **Smallest fix:** recompute the tags and the four flags from the entries (a rehearsed one-off). Needs your yes.

### S2-8. Two or more safety-register entries, one safety row

- **How many:** **63** (`S1e`). The safety table keeps one row per company, so one building's progress and
  workers are shown and the others' are not. On `civic-apparels` the row kept is the Ineligible building and
  the active one is hidden (`S1c`).
- **Smallest fix:** one row per entry (the table's key), which also closes S1-6. A migration. Needs your yes.

### S2-9. A trade-body member under another name, shown as a building of this company

- **How many:** **17** (`G6`). `saad-musa-hometex-and-clothing`, `islam-garments`, `amex-knitting-and-dyeing-industries`.
  Its membership number appears on the company's page labelled with the building's name. To be read: a
  sister concern with its own membership is a company, not a building.

### S2-10. A building of a building

- **How many:** **14** (`G3`). The company page lists only its direct buildings, so the third row's safety
  entry and certificates appear nowhere. `knit-asia-limited-ratanpur-extension` is one.
- **Smallest fix:** point each at the top company (14 rows). Needs your yes.

### S2-11. Smaller contradictions

| id | what | count | examples |
| -- | -- | -- | -- |
| `C9` | Workers total is not men plus women | 7 | `ak-knitwear`, `gc-fashion-wear`, `scandex-textile-industries` |
| `J3` | An OFAC name match (97% to 100% alike) switched off with no review date, reason or audit-log line. The list still carries the entries. Probably namesakes; nothing on file says so. | 3 | `msd-international`, `new-horizon-bd`, `pacific-interntional` |
| `C12` | A certificate body in Sources, no certificate in Certificates | 2 | `ahmed-fashions`, `chorka` |
| `C3` | BKMEA number on the page that none of its BKMEA entries carries | 1 | `shatabdi-apparels` |
| endpoints | The BTMA filter in search misses one member (an entry with no serial number) | 1 | 420 found, 421 hold an entry |
| endpoints | The district choices in search offer 7 that are not districts | 7 | Narayangonj, Comilla, Chittagong, Jessore, CHATTOGRAM, Bogra, Ashulia |
| endpoints | `/legal/data-sources` printed 10,025 while `/methodology` and `/status` printed 10,026 (each page caches the figure for ten minutes) | 1 | |

---

## S3: stale or missing

| id | what | count | where a buyer sees it | smallest fix |
| -- | -- | -- | -- | -- |
| `E4` | Entries last read over 90 days ago: BTMA all 528 (145 days), BGAPMEA all 1,243 (109 days), GOTS 870 of 915, BGMEA 772 of 5,989, OEKO-TEX 91, RSC 28, SA8000 all 7. The footer of every page says "updated 13 Oct 2026", which is the newest read of any register. | 3,025 pages | the footer, beside per-source dates that are honest | say "latest read", and re-read BTMA and BGAPMEA |
| claim | `/methodology`: "RSC is read every week. Every day we re-open a batch of source pages." All schedules are off since 6 Oct; RSC was last read 2 Oct. | 1 page | `/methodology`, section 02 | true again when schedules resume; until then the sentence is not |
| `C8` | An export-zone name on the record with no BEPZA entry behind it (BEPZA is not read) | 285 | the zone on the record | drop it or label it "from the address" |
| `I9` | One website on six or more companies (a group site or a portal): 31 websites | 284 | the website link, Growth and above | blank the shared ones |
| `I11`, `I12` | No district / no address | 165 / 161 | the place under the name; the District filter | mostly safety-register-only rows; fill from the register's address |
| `E3` | Certificates the body no longer lists (shown with that label) | 149 companies, 156 certificates | Certificates | none: shown honestly |
| `E2` | Certificates past expiry (shown as expired with the date) | 352 companies, 369 certificates | Certificates | none: shown honestly |
| `I8` | Website field that is not a web address | 131 | the website link | clean once |
| `C5` | Stored completeness differs from its own formula | 84 | the completeness filter | recompute |
| `F3b` | The safety register now lists the factory under a new name | 4 | the company name | rename, keep the old as "previously" |
| `C10` | More than 50,000 workers on one record, and its men plus women do not match | 1 | `gc-fashion-wear` | read the register |
| dbapi | `recompute_t13_source_count(id)` can be run by a signed-out visitor. It only recomputes a count, but it writes. | 1 function | database API | revoke from the public role |
| receipts | Source links a script could not confirm: OEKO-TEX (10 of 10) and GOTS (8 of 8) are script-built pages; WRAP (8 of 8) answers 403 to a script; H&M's list (1) opens as a file; Next's list (4) did not connect and the M&S map (1) asks for a sign-in. BGMEA 21 of 22, EPB 17 of 18, BKMEA 8 of 8 and BGAPMEA 5 of 6 open, with a valid certificate, and name the company; RSC's 14 open as PDFs. Two open and show our number under another name: `iqbal-texwear` (BGMEA), `4-emeralds-accessories` (BGAPMEA). | 100 links | "Open the … page" under Sources | read the two; check OEKO-TEX, GOTS and WRAP by hand in a browser |

---

## S4: untidy

| id | what | count |
| -- | -- | -- |
| `I2` | Company name stored in capitals. The page heading re-cases it; the browser tab title and search engines get the capitals. | 2,977 |
| `I6` | Year founded stored two ways: 2,516 as a year, 1,804 as a full date | 1,804 |
| `I1` | District not spelled as one of the 64: Narayangonj 34, Comilla 13, Chittagong 6, Jessore 4, Bogra 3, CHATTOGRAM 3, Narshingdi 2, Ashulia 2, Savar 2, Barisal 1 | 70 |
| `H7` | The same value twice inside one list (products, factory types, phones) | 47 |
| `I3` | Name with a broken character, stray spaces or half a bracket ("Mega Couture Ltd.)"), left by a "(previously …)" cut | 23 |
| `H6` | Factory type in a second spelling (woven, knit, sweater, knit_composite) | 14 |
| `I7` | A note inside the name ("previously", "a concern of"), and so inside the web address | 9 |
| `I4`, `I5` | Name ending in punctuation; legal form written twice | 4, 1 |
| `J6` | The public figure "5 sanctions lists" counts five named sources; six lists are read | 1 |
| figures | `marketing_stats()` returns "certifications verified: 0" beside 4,486 certificates on file. Not printed on any page today; anyone can call the function. | 1 |
| dbapi | `_b6_authdebug()`, a leftover debug function, answers any visitor with their own session details | 1 |
| figures | `marketing_facts()` counts BKMEA "records" twice (5,256 rows for 2,621 members, `A4`). Not printed; the page prints suppliers. | 1 |
| endpoints | The public profile function answered 500 once in about a hundred calls and answered on the next try | 1 |

---

## The handoff's leads, each re-measured

| lead (as seen that morning) | now |
| -- | -- |
| "certifications verified" 0 on the home page | The function says 0; **no page prints it**. S4. |
| "BGMEA verified" with no BGMEA entry: 59 | 59, confirmed. Buyers meet it as a BGMEA mark in search and the export. S2-7. |
| BGMEA entry, flag not set: 9 | 9 (plus 1 BGAPMEA). |
| Buying house holding only a manufacturer's membership: 503 | 503. |
| Workers total ≠ men + women: 7; above 50,000: 1 | 7 and 1 (the one is among the seven). |
| District spellings | 70 rows in 10 spellings; the filter offers 7 of them as choices. |
| No district / no address: 165 / 161 | 165 / 161. |
| Names in capitals: 2,977; broken names: 18 | 2,977; 23 with a wider rule. |
| Website not a web address: 122; one website on six or more: 16 sites | 131; 31 sites on 284 companies (published only, host compared without "www"). |
| Two or more safety entries on one company: 66 | 63 pages (66 rows; three are buildings of one company). The table shows one, and not always the active one. |
| One BKMEA number on two differently named companies: 5 pairs | 4 pairs. |
| Year founded in two formats | 2,516 / 1,804, confirmed. |
| Oldest reads: BGMEA 14 May, RSC 13 May, OEKO-TEX 16 May | Confirmed; the page shows each source's own date. The footer's "updated" is the newest. |
| `/api/v1/discover/export` has no rate limit | **Out of date.** The live `rl_check` accepts the export class (read in the function's text; not tested by hammering). `CLAUDE.md` still lists it as an open bug. |
| Every `admin_*` function can be called by a signed-out visitor | 28 of the 32 refuse when called for real. Three create rows and were not called (their check comes before the write, read in the source). One only lists scraper names. |

---

## Checked and clean

Each line is a check that ran and found nothing; the id is the function to re-run.

**One number, every place.** Published companies: the table, `marketing_stats()`, `marketing_facts()`, search
with no filter, the footer and the sitemap all gave the same number at the same moment (10,026). The sitemap
holds exactly the published addresses, none extra, none missing. Factory plus buying house equals the total.
No published company without a register entry (`A1`), none without a Tier 1 to 3 entry (`A2`), no stored source
count that differs from the entries (`A3`).

**One company, every place.** 39 companies read three ways (search row, profile function, public page): name,
kind, district, source count, certificate count, registers and safety agree on all 39. Workers is the one
field that differs (S2-2). The signed-in export of one search (130 rows) equals the same search read signed
out: same rows, same order, no field differing.

**Search behaviour.** One search walked page by page returns every row once (130 of 130). The same request
twice returns the same order, for all five sorts. A request for 5,000 rows returns 100. Filter totals equal
the entries held for BGMEA, BKMEA, BGAPMEA, EPB, RSC and for all four certificate kinds.

**What must never leak.** Signed out, 12 public pages and 5 public routes carry no mailbox, phone number or
internal field name. All 22 `/api/v1` routes tried answer 401 signed out; the admin route answers 403 to a
signed-in buyer. Signed in on the Starter plan: the company list, saved list, compliance view, the export and
three record pages carry no contact detail, and the record says "Contact details are locked". At the database
API as a visitor: of 91 tables and views (93 by the evening), only the three meant to be public return rows; the seven contact and
admin columns of `suppliers` are refused; unpublished companies are not returned; all 206 functions were
called: 28 admin functions refuse, the rest refuse, return nothing, or are public by design, except
`_messages_key` (S1-0) and `_b6_authdebug` (S4). 19 functions that create or change something were not called;
17 have their sign-in check before their first write (read in the source), one works by emailed token, and one
has no check (`recompute_t13_source_count`, S3). No internal score in any response.

**Certificates and dates.** No certificate expiry differing from its own register entry (`C13`), none dated in
the future, no entry read on a future date (`E5`), no founding year out of range (`E6`). Expired and
no-longer-listed certificates are shown as such.

**Buildings.** All 744 point at a row that exists (`G1`); none is also published as its own company (`G4`); none
is claimed by an owner (`G5`); a building's old address redirects to its company (checked live, 308).

**Kinds and export lines.** No factory holding only a buying-house membership (`H3`); every export line is a
real 4 or 6 digit heading (`H4`), none repeated inside an entry (`H5`).

**Sanctions.** No company with a live match and no warning (`J1`); none marked sanctioned without a match (`J2`);
none cleared without a reason (`J4`); all six lists seen within the last week (`J5`). No map pin outside
Bangladesh (`I10`).

## Not done, and why

- **The evidence pack** is a POST that writes a download record, so it was not called (GET-only). Its
  contents against the record are unchecked.
- **Receipts against the register, by eye.** The script confirms that 100 links open and name the company. It
  cannot read OEKO-TEX, GOTS or WRAP pages (S3), and it does not compare status or expiry word for word.
- **The two-minute search cache** needs a data change to observe; not tested.
- **The rate limit on the export** was read in the function, not provoked.
- **Brand lists attached by name only**: brand entries carry an address and no factory name, so there is
  nothing to compare without re-reading each brand's file.
- **One of the forty** sample companies was not compared: the run stopped on a 500 from the public profile
  function (it answered on retry; the script now retries).

## Signed-in checks: how they were run

In the founder's own Chrome, on a `sourcebd.net` tab, with `browser-harness`: `fetch()` from the page for
`/api/v1/settings`, `/api/v1/suppliers?slugs=…`, `/api/v1/saved`, `/api/v1/compliance?view=expiry`,
`/api/v1/admin/etl/status`, `/app/suppliers/<slug>` for three companies and
`/api/v1/discover/export?district=Mymensingh` once. Responses were saved to a temp folder, read by
`leaks_in_json` / `leaks_in_text` from `ops/audit_endpoints.py`, and deleted. The session cookie never left
the browser. The export wrote its usual "export downloaded" line to the activity record under the founder's account.

## Re-running

```
python ops/audit_data_integrity.py --cache DIR            # pulls once into DIR, then prints every finding
python ops/audit_data_integrity.py --cache DIR --all      # the clean checks too
python ops/audit_endpoints.py --cache DIR                 # site, figures, 40 companies, paging, database API
python ops/audit_endpoints.py --cache DIR --only receipts # 100 source links, about five minutes
python ops/check_supplier_conflations.py --rest
python ops/report_bgmea_identity_gap.py
```

Tests: `etl/tests/test_audit_data_integrity.py` (23: fixtures in, findings out, and a guard that the database-API
check only ever issues GET).
