# REZ-113 — EPB coverage evidence gate

Date: 2026-08-15 (recomputed; prior 2026-08-10 figures marked stale where they drifted)  
Mutation: **1953 EPB attach-only** (15 Aug 2026), fingerprint `662a52d109da5574b8a7cd10754da490f64695be4efe502f8ec398a6a0dcdc7d`. No new companies.

## Recomputed production figures

| metric | 10 Aug | 15 Aug |
| -- | -- | -- |
| Active EPB `source_records` | 539 | **539** (unchanged) |
| Distinct suppliers with EPB | 531 | **531** (530 published + unpublished `univogue-garments-co-ltd-unit-2`) |
| EPB tag vs SR lockstep | — | **0 / 0** (tag without SR, SR without tag) |
| `suppliers.epb_erc_number` nonempty | — | **0** of 10922 (539/539 SRs have `fields.epb_reg_no`) |
| Published mothers | **10272** | **10266** (−6) |
| Published mothers with BGMEA or BKMEA SR | **7685** | **7700** (+15) |
| Of those, no EPB SR | **7181** | **7196** (+15) |
| `epyllion-style` has EPB | false | **false** |

## Live EPB association pass (15 Aug 2026)

`POST https://edb.epb.gov.bd/api/exporters-search` `private=false` `approval_status=1`. Paginated IDs, not totals-only.

| list | unique exporter ids |
| -- | -- |
| BGMEA `associations=[1]` | **398** (API `total` 398) |
| BKMEA `associations=[2]` | **161** (API `total` 161) |
| Intersection | **5** (`335`, `809`, `3086`, `4303`, `5534`) |
| Union | **554** |

Saved ~541 flagged figure matches none of these. DB split is BGMEA 381 + BKMEA 158 = 539, all with `epb_associations` set (0 category-pass rows).

Set diff vs DB `source_ref`:

- Live not in DB: **16** — 158 HMN Fashion, 452 Jeans & Polo, 564 Azim Garments, 1944 Wega Knitex, 2345 Titas Knitwear, 2394 Pacific Attires, 3380 Tunic Style Wear, 3654 Banga Fashion, 3956 East Coast Knitwear, 4126 M.T. Sweaters, 4225 Croydon Kowloon Designs, 5358 Ecofact, 5392 SAL Textile, 5940 New Fashion (NF), 5946 Oishee Apparels, 5958 Trisen Sweater.
- DB not in live association lists: **1** — `rose-sweater` exporter **779** BD04223. Public page `https://edb.epb.gov.bd/exporter/779/rose-sweaters-ltd` still loads (fetched 15 Aug). `fetched_at` 2026-06-27, not the 30 Jul run. Zero `epb_web` evidence claims.

Last `epb_web` run: 2026-07-30, `seen=543` `upserted=543` `skipped=0`. No `epb_web` schedule. No run since 1 Aug. Category pass never ran (exporter 4083 SARADA: 0 EPB rows). Arithmetic on the 543/539 gap: the five live dual IDs are all in DB as BKMEA and were fetched 30 Jul; 779 was not. 543 − 5 + 1 = 539. That is a double-count of dual-association exporters plus one stale row, not four deleted records.

No EPB files under `etl/raw`.

## Buyer-visible EPB evidence (have SR, missing accurate Open link)

| fact | value |
| -- | -- |
| Active EPB SRs with `epb_detail_url` `https://edb.epb.gov.bd/exporter/{source_ref}/{slug}` | **539 / 539** |
| Registry pills `source_url` | **539 / 539** = `https://epb.gov.bd/` |
| Pills equal to `epb_detail_url` | **0** |
| `evidence_documents` `epb_web` | **3**, all `https://edb.epb.gov.bd/api/exporters-search`; **0** `/exporter/` pages |
| Active `epb_web` claims | **2119** on 530 suppliers; all cite the search API; `epb_detail_url` field_key **0** |
| Published EPB host with zero claims | **1** (`rose-sweater`) |
| Compliance “Open source” | `pill.source_url` from the view (`0101` EPB branch hardcoded homepage). `resolveRegistryUrl` EPB→null is unused. Header / Overview / Provenance do not link out. |

Dry-run (view expression only, no row writes): replacing `'https://epb.gov.bd/'` with `nullif(btrim(fields->>'epb_detail_url'),'')` guarded by `url like '%/exporter/' || source_ref || '/%'` would change **539 / 539** Open hrefs. Identity caveat below: do not treat a second EPB slug on the same host as the host’s own page.

## Dual EPB hosts (8 suppliers, 16 SRs)

Same-name duals (not flagged as a different legal name): Alpha Product Development (1358 + 5533); Amana Knittex (1778 + 3166, ltd only).

Second record is a different stored name:

- `az-apparels` holds `za-apparels-ltd` 4821 BD05707 (live page title Z.A Apparels Ltd.)
- `bsa-apparels` holds `bsa-fashion-ltd` 4491
- `deluxe-apparels` holds `deluxe-fashion-ltd` 2850
- `kds-apparels` holds `kds-fashion-ltd` 3710
- `mim-apparel` holds `mim-fashion` 1762
- unpublished `univogue-garments-co-ltd-unit-2` holds Unit-3 3084 BD02115; sibling `univogue-garments-co-ltd-unit-iii` has zero EPB SRs

Single-EPB hosts with mutually exclusive name tokens, and a sister that holds **zero** EPB (verified 15 Aug): AKH Apparels → `akh-knitwear`; BSA extra → `bsa-fashion`; Deluxe extra → `deluxe-fashions`; KDS extra → `kds-fashion`; Mim extra → `mim-fashion`; Savannah → `savannah-fashion`; AZ extra → `za-apparels`; Univogue Unit-2 extra → unpublished `univogue-garments-co-ltd-unit-iii`; Caesar → `caesar-apparels`; Crown Knitwear → `crown-fashion-apparels`; Fashion Knitwear → `fashion-export-international`; Orion → `ripon-knitwear`; Knigtex → `knitex-apparels`; Southern Knitwear → `southern-services`; Tasmia → `tasmia-fashion`; Nitexpo → `knitexpo`; ANMA Sweaters → `aman-sweater`. Compounding/typo rows (bd vs bangladesh, garmetns, majj, pngbd) and `si-garments` (no such supplier slug) are not moves.

## Law (15 Aug 2026 founder)

- EPB is an independent government register. A company already on our list must show EPB evidence and HS codes when EPB publishes them, whether or not it carries a BGMEA/BKMEA association flag.
- Association pass: full-create for flagged exporters.
- Category pass: `enrich_only=True` — never mint single-source EPB-only rows.
- HS codes live on the public exporter HTML, not the search API.
- EPB path slugs are not identity (Vintage Denim / `suhcheon-company-bd-ltd`). Match on exporter id + page content.
- Dry-runs free. `--apply` (migration, scraper run, re-home) needs an explicit go-ahead on the exact mutation set.

## Attach-only dry-run (15 Aug 2026, no writes)

Live `exporters-search` unique RMG exporters: **2716** (association 554 + category-only 2162). Knit 585 / Woven 376 / Knit & Woven 1350 / Sweater 296 / stock-lot 79+31+48, de-duplicated with association.

Matched against 10922 suppliers (slug, squash, fuzzy ≥92). Nothing written.

| outcome | n |
| -- | -- |
| Already has EPB | **539** (every DB EPB ref still live) |
| Would attach onto a company we already list | **1953** |
| of those, published BGMEA or BKMEA mother | **1866** |
| Live on EPB, no match, would skip (never mint) | **224** |

Named would-attach: Interstoff Apparels 2043, Interstoff Clothing 2329, SARADA 4083, epyllion-style 4879, epyllion-knitwear 2314.

After this attach, published BGMEA/BKMEA mothers with EPB would be about 504+1866 = **2370 / 7700** (~31%), not ~98%. The remaining gap is companies on our BGMEA/BKMEA list that are **not** in these EPB RMG lists.

Script: `ops/epb_attach_dryrun.py`. Live dump: `ops/plans/_epb_attach_live.json`. Plan: `ops/plans/_epb_attach_dryrun.json`.

## Attach-only apply (15 Aug 2026)

Founder authorised attaching the **1953** onto companies we already list.
Fingerprint `662a52d109da5574b8a7cd10754da490f64695be4efe502f8ec398a6a0dcdc7d`
(sorted `source_ref` + host id). Rebuilt from the frozen live dump + snapshot;
count still 1953; skipped foreign-host 0; skipped bad URL 0.

After apply (re-queried production):

- Active EPB `source_records`: **2492** (539 + 1953)
- Distinct companies with EPB: **2472** (531 + 1941 new; 3 of the 1944 attach hosts already had a different EPB row)
- Company table: **10922** (unchanged — 224 unmatched not minted)
- EPB tag vs SR lockstep: **0 / 0**
- Named attached: Interstoff Apparels 2043, Interstoff Clothing 2329, SARADA 4083, epyllion-style 4879, epyllion-knitwear 2314
- All 224 unmatched refs still absent
- Published BGMEA/BKMEA mothers with EPB: **2358 / 7700** (was 504)

HS codes were not fetched on this attach.

Still closed until asked: merge to `development`, promote, deploy.

## 0103 applied (15 Aug 2026)

Display-only. EPB Open is the stored exporter page. Six wrong-name extras hidden.

- EPB pills: **2480** (was 2486 homepage links; 6 denylist dropped)
- Homepage Open: **0**
- Exporter Open: **2480 / 2480**
- Named: SARADA `…/exporter/4083/…`, Interstoff Apparels `…/exporter/2043/…`, epyllion-style `…/exporter/4879/…`
- `az-apparels` keeps BD05784 (`…/exporter/4640/az-apparels`); foreign 4821 / BD05707 hidden
- `supplier_epb_hscodes` live; SARADA and Interstoff return `[]` (no HS stored yet)

## HS backfill applied (15 Aug 2026)

Fetched public exporter pages for all 2,492 numeric EPB records. Fingerprint
`855b487add34c1a26491aec5fc39b679fd0ebe81f85bcac8e265c5485d54f1b7` recomputed
from the mutation set before `--apply`. REST PATCH of `fields.epb_hscodes`
only. Never minted. Empty parse never overwrote stored codes.

- Eligible: **2492**; wrote: **2476**; empty pages skipped: **16**; fetch failures: **0**
- After apply: **2476** with HS, **16** without, **2492** active EPB rows
- Company table: **10922** (unchanged)
- `supplier_epb_hscodes('interstoff-apparels')`: 17 codes including 6103/6104/6112/6114 (list ids 813/814/776/778)
- `supplier_epb_hscodes('sarada-fashions')`: 18 codes
- Denylist extras stay hidden: `az-apparels` shows HS from 4640 (23 codes), not foreign 4821 (25)

Frontend HS card is in the working tree (Compliance tab, same ProfileCard /
ProfileEvidenceRow language). Not merged, not deployed.

## Decision needed

1. ~~Land the view-only Open URL + HS display change~~ **0103 applied 15 Aug**.
2. ~~Authorise the attach-only scrape for the **1953** matches~~ **done 15 Aug**.
3. ~~Authorise HS backfill `--apply`~~ **done 15 Aug**.
4. Commit / merge the frontend HS card and put it on the server (asked separately).

Ready for human review. Not merged.
