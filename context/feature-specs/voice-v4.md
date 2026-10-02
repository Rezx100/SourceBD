# SourceBD voice (v4)

S0, 3 Oct 2026. Every string in v4 (app, onboarding, marketing) passes through this file
and `ds-v4/copy-inventory.md`. Readers: sourcing and compliance staff at UK, EU, US and
Canadian clothing brands; Bangladeshi supplier staff reading English as a second language.

## Ten rules

1. Plain English, reading age about 12. Short common words.
2. One idea per sentence. At most 15 words in the app.
3. Buttons start with a verb: "Send RFQ", "Accept quote", "Download CSV".
4. Never narrate the system. Cut "results update when you apply", "registry spellings merged".
5. Say what the buyer gets or must do: "Show 4,645 suppliers", not "Apply filters".
6. Name the source in words, with its date (pattern below). An icon alone is not a source.
7. Empty states never apologise. Say what is missing and the next step.
8. **Call regulated things by the regulator's name.** forced labour, modern slavery statement,
   UFLPA Entity List, due diligence, remediation. UK spelling; US law names keep theirs.
   [UK] "modern slavery, forced labour and child labour"; [FLR] "products made with forced
   labour"; [CBP] "entity on the UFLPA Entity List"; [RSC] "RSC's remediation programme".
9. **Use the trade's own words; don't define what buyers know.** supplier (never vendor),
   factory, production site, supplier list, FOB, lead time, MOQ, RFQ, tech pack.
   [TAP] "publishing our list of Tier 1 suppliers"; [BW] "costings to achieve required FOBs",
   "reducing lead times"; [RYZ] "Tech pack gives the RFQ a technical reference". No job advert
   we read says "vendor" [MUL][BW].
10. **A certificate shows one of four states, with an exact date:** valid until {date},
    expired {date}, suspended, withdrawn. Never "active", "lapsed" or a level we did not read.
    [GOTS] "remain valid until the date stated", "certification was withdrawn";
    [OEKO] "Withdrawn certificates and labels"; [WRAP] "remain valid through their current
    expiration dates" (WRAP stopped Gold/Platinum levels on 1 Mar 2026).

## Glossary

| We say | Buyers and sources say | Never say | Source |
| --- | --- | --- | --- |
| supplier | "list of Tier 1 suppliers" | vendor, company record | TAP |
| factory · buying house | "supplier factories" | unit, entity | DRA |
| site (one building or address) | "suppliers' production sites" | premises, facility(ies) | PRI |
| brand supplier list | "publishing our list of Tier 1 suppliers" | brand disclosure list, buyer list | TAP |
| sources · "From BGMEA" | "verified contributor has contributed data points" | registers & certifiers, evidence tier | OSH |
| BGMEA reg. no. 3498 | "BGMEA Reg No" | general:3498, hash IDs | BGM |
| as declared to BGMEA | "Unit Name", "Major Countries Export" (member-entered fields) | as filed, attested | BGM |
| products they export · HS code | "Major Countries Export"; HS code is the customs term | export lines, HS headings | BGM, CBP |
| certification body · issued by | "Approved Certification Body" | certifier | GOTS |
| valid until · expired · suspended · withdrawn | "valid until the date stated", "Withdrawn certificates" | active, lapsed, 0 d | GOTS, OEKO |
| inspection · remediation | "electrical safety inspections", "remediation programme" | safety record, fixes | RSC |
| On the UFLPA Entity List | "entity on the UFLPA Entity List" | hit, match, blacklist | CBP, DHS |
| Possible Xinjiang link | "produced … wholly or in part in the XUAR" | region flag, Xinjiang-linked text | CBP |
| No link found | (we found nothing; we do not clear anyone) | clear, safe | CBP |
| forced labour | "products made with forced labour" | labour concerns, exposure | FLR, UK |
| modern slavery statement | "develop a modern slavery statement each year" | §54 transparency statement, MSA | UK |
| due diligence | "apply due diligence, effective supply chain tracing" | vetting, screening score | CBP, CSD |
| RFQ · quote | "RFQ means Request for Quotation" | inquiry, enquiry | RYZ |
| RFQ template | (settings for the RFQ message and questions) | inquiry template, `{{supplier}}` | RYZ |
| lead time · FOB | "reducing lead times", "required FOBs" | turnaround, price point | BW |
| MOQ | "Affects MOQ, MCQ, efficiency and price" | minimum buy | RYZ |
| Search | (one word for one place) | Discover | S-17 |
| Hiding sanctioned suppliers | (plain state + "Show them") | Sanctioned hidden | W-01 |
| (nothing) | | published, corpus, results panel, V2, attested | W-01 |

## Numbers

- Every number carries its noun or unit: "3 suppliers", "MOQ 3,000 pieces", "2 quotes".
- One count per idea. Two figures that disagree: show the one that answers the question
  ("3,546 workers at 3 sites"); the other, with its source, on tap.
- Money: "US$6.15 per piece", "US$26,550". No ".00", no trailing "USD".
- Thousands separators always. Ranges with an en dash: "11–50".
- No "+n" without its noun ("3 more certificates"). No "(s)" plurals. No counts of form fields.
- Round only where precision does not help, and say "about".

## Dates

- en-GB, day month year: "8 Oct 2026". [UK] "Last updated 1 December 2025"; never "07/31/2026".
- Relative only for deadlines within 30 days: "expires in 5 days", "expires today",
  "expires tomorrow". Never "5d ago", "0 d", "Updated 7d ago".
- A date appears once per item. Date inputs follow the buyer's locale.

## Source pattern

`{fact} · From {body in words} · checked {date}`. Examples:
"From BGMEA · checked 24 Jul 2026" · "Listed on ASOS's supplier list · checked 30 Jul 2026" ·
"GOTS · issued by Control Union · valid until 12 May 2027" · "RSC factory 9342 · checked
18 Sep 2026". Short body names (BGMEA, EPB, RSC) once the full name is one tap away.
RSC is an industry council, never "Government register".

## States

| State | Words | Next step |
| --- | --- | --- |
| Locked | "Contact details are locked." | "Send an RFQ and the supplier replies here." |
| Empty | "No saved suppliers yet." | "Save suppliers to check them here." |
| Not published | "No expiry date published." / "Workforce not published." | Show the source that was read. |
| Not linked | "Source not linked yet." | "It is one of the 11 below." |
| Stale | "Last checked 18 May 2026." | "We check this source again soon." (only if scheduled) |
| Contradicted | "BGMEA says 1,300 workers; RSC counted 3,546." | Show both with dates; never pick silently. |
| Sanctioned | "On the UFLPA Entity List since {date}." | "You can't send this supplier an RFQ." |
| Error | "We couldn't load the sites." | "Try again." |
| Loading | Skeleton rows; no words, or "Loading suppliers…" after 2 seconds. | none |

## Source keys

UK gov.uk/government/publications/transparency-in-supply-chains-a-practical-guide ·
CBP cbp.gov/trade/forced-labor/UFLPA · DHS dhs.gov/uflpa-entity-list ·
FLR eur-lex.europa.eu/EN/legal-content/summary/ban-on-forced-labour-products-on-the-eu-market.html ·
CSD commission.europa.eu (corporate-sustainability-due-diligence) ·
OSH info.opensupplyhub.org/faqs · GOTS global-standards.org/resources/q-a ·
OEKO oeko-tex.com/en/label-check · WRAP wrapcompliance.org/en/update-to-wrap-certification-program/ ·
BGM bgmea.com.bd/page/member-search · RSC rsc-bd.org ·
TAP tapestry.com/responsibility/supplier-list/ · PRI globalsourcingmap.primark.com ·
DRA drapersonline.com/news/primark-publishes-supplier-map ·
MUL jobs.lever.co/mulberry/2fb73a4a-ebf2-432c-834a-6433971a82c3 ·
BW bwconsulting.biz/apparel-sourcing-manager/ ·
RYZ ryzealsourcing.com/how-to-write-an-rfq-to-a-clothing-manufacturer/ (supplier-side guide).
Blocked on 3 Oct: Sedex, amfori, Indeed, Just Style; BKMEA and Sourcing Journal not reached.
