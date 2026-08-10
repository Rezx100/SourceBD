# BGMEA registration attribution — findings and founder decisions

Date: 2026-08-11
Mutation: **REZ-116 orphan moves applied 2026-08-11** (fingerprint
`11ed6036f6586e7f831168e9eba08f108ba97a46d9c7688da6f6a66d7363e95d`).
Snapshot: `ops/plans/_snapshot_rez116_orphan_moves_20260810T223530Z.json`.
Candidate SHA: `b0d79efdab6db7a0198f4f9baff1e5904e24b1a7`.

Section 1 post-apply: all 10 MOVE refs sit on their decision destinations;
`1168` HOLD remains on `pa-textile`. Mother `standard-stitches` RPC shows
BGMEA 5663 with `building_name` = Standard Stitches Ltd. (Woven Unit).
Founder-knowledge provenance for `1604`/`1556` recorded in commit + Linear.

## Method

Every active BGMEA `source_record` (5,970) was compared against the name the
BGMEA register holds for that reference, taken from `ops/plans/bgmea-names.json`
(5,963 names recovered: 4,285 general, 1,678 associate). Comparison tolerated
punctuation, spacing, word order, legal suffixes and common trade abbreviations
(`Ind.`→industries, `Gmts.`→garments, `Int'l`→international, singular/plural),
plus a 0.92 character-similarity fallback. Where a record's registered name did
not match its holder, every other supplier row was searched for that registered
name using the same tolerance.

Reproduce with the REST cross-check described in the "How to reproduce" section
at the foot of this file. Direct Postgres connections time out from the founder's
machine; use the REST path.

## Counts

| class | records |
| -- | -- |
| record names the supplier displaying it | 5,741 |
| registered company is not in our database | 177 |
| registered company is here but holds no BGMEA — **orphan** | 11 |
| ambiguous, several candidate rows | 18 |
| rightful owner already holds its own BGMEA | 15 |
| no registered name recovered | 8 |
| **total** | **5,970** |

## Register collision context

`suppliers.bgmea_reg_numbers` stores the bare number, discarding the register.
BGMEA numbers the General and Associate registers independently, so 1,185
numbers currently display on more than one published company, across 2,175
published suppliers. The register is already present on every record as
`fields->>'bgmea_member_type'` and splits cleanly: 4,284 `general_manufacturer`
(all `general:N` refs) and 1,686 `associate_buying_house` (all bare `N` refs).
No re-scrape is needed to fix this.

Live example in this report: `general:1355` is Bangladesh Dresses Limited, while
bare `1355` is Kiabi International Supply Service Ltd. Two unrelated companies,
one displayed number.

---

## Section 1 — The 11 orphans, with founder decisions

The registered company exists on SourceBD and shows no BGMEA record, because its
registration is displayed on another row.

Legend for **Decision**: `MOVE` = reassign the record to the rightful row.
`HOLD` = do not touch, founder will check manually.

| # | ref | register | registered to | currently displayed on | rightful row | decision |
| -- | -- | -- | -- | -- | -- | -- |
| 1 | `general:4562` | general | Vintage Denim Ltd. | `vintage-denim-apparels` (also holds `general:6213`) | `vintage-denim` (published) | **MOVE** — exact name match |
| 2 | `797` | associate | Fashion Comfort (BD) Ltd. | `asdwa-fashion` | `fashion-comfort-bd` (published) | **MOVE** — exact name match |
| 3 | `460` | associate | HM Textile | `channel-expor-tex-international` (also holds `62`, `338`) | `hm-textile` (published) | **MOVE** — exact name match |
| 4 | `1464` | associate | Natex of Scandinavia A/S Bangladesh | `dhaka-natex-sourcing` (also holds `1255`, `1196`) | `natex-of-scandinavia-as-bangladesh` (published) | **MOVE** — exact name match |
| 5 | `1128` | associate | Riviera Resources Ltd. | `the-fashion-island` (also holds `326`, `general:2534`) | `riviera-resources` (published) | **MOVE** — exact name match |
| 6 | `general:4298` | general | Section Seven Ltd. | `section-seven-apparels` (also holds `general:5045`) | `section-seven` (**unpublished**) | **MOVE** — settled by the register: `general:5045` is Section Seven Apparels Ltd., which the holder keeps |
| 7 | `1604` | associate | A.R.Z Sourcing BD | `raz-apparels` | `ar-sourcing` (published) | **MOVE** — founder decision, 11 Aug. No register entry for "AR Sourcing"; this rests on founder knowledge of the trade, not on register evidence |
| 8 | `1556` | associate | Sunrise Apparel BD | `md-tex` (also holds `1211`) | `sunrise-apparels` (published) | **MOVE** — founder decision, 11 Aug. No register entry for "Sunrise Apparels"; founder knowledge, not register evidence |
| 9 | `general:2431` | general | Bangladesh Dresses Ltd.(Unit-2) | `bangladesh-dresses` (also holds its own `general:1355`) | `bangladesh-dressess-ltd-unit-2` (published, **not** currently a building) | **MOVE** — founder decision, 11 Aug: the number belongs to Unit-2 exclusively and must not be blended into the parent's identity |
| 10 | `general:5663` | general | Standard Stitches Ltd. (Woven Unit) | `standard-stitches` (also holds its own `general:5350`) | `standard-stitches-ltd-woven-unit` (**unpublished, attached building**) | **MOVE, BUT BLOCKED** — see the sequencing warning below |
| 11 | `1168` | associate | P.A. Fashion Ltd. | `pa-textile` | `p-fashion` (published) — unconfirmed | **HOLD** — the register contains no "P. Fashion" entry, so there is no evidence our `p-fashion` row is P.A. Fashion Ltd. The number is certainly not P. A. Textile Ltd.'s. Founder to check manually |

### Sequencing warning on #10 and #9

`standard-stitches-ltd-woven-unit` is an unpublished building attached to its
mother. Moving `general:5663` onto it today removes that registration from
buyer view entirely, because mother profiles do not yet display their buildings'
registry records. **Do not move #10 until that rendering ships.** Verify the
rendering exists at the observable boundary before applying, not by reading code.

`bangladesh-dressess-ltd-unit-2` is the opposite shape: named as a second unit
but standing as its own published company rather than an attached building. Its
move is safe today, but the row is a candidate for the extensions work and should
be raised there.

### Corrections to figures supplied during the decision session

- The parent Bangladesh Dresses number is `general:1355`. The bare `1355` is a
  different company (Kiabi International Supply Service Ltd., associate register).
- `general:5350` is registered simply as "Standard Stitches Ltd", not as "U-2".
  `general:1913` is the G-Unit, as stated. Both are correctly placed today.

---

## Section 2 — The 18 ambiguous records

More than one candidate row matches the registered name. **No agent may resolve
these.** Each needs a human decision, and several are Domain Law cases where the
candidates are units of one company.

| ref | register | registered to | currently on | candidate rows |
| -- | -- | -- | -- | -- |
| `953` | associate | A. S. Fashion | `as-knitwear` | `mas-fashion-bd`, `sas-fashions` |
| `231` | associate | A.M. Fashion International Ltd. | `am-fashion` | `s-fashion-international`, `ga-fashion-international` |
| `330` | associate | A.R. Fashion | `ra-apparels` | `akr-fashions`, `har-fashion` |
| `679` | associate | Atima Knitwear Ltd. | `atima-fashions` | `jaima-knitwear`, `aim-knitwear` |
| `1573` | associate | Bangladesh Apparel Inc. | `desh-bangla-enterprise` | `w-apparels`, `apparel-4` |
| `1020` | associate | J.R. International | `jr-enterprise` | `js-international`, `cj-international` |
| `1398` | associate | JMS International | `jms-clothing` | `msd-international`, `js-international`, `mns-international`, `mas-international` |
| `1129` | associate | M.N. Enterprise | `nm-fashion` | `amin-enterprise`, `rn-enterprise` |
| `296` | associate | Maxim International | `shan-knitting-and-processing` | `maxtrims-international`, `max-international`, `maximo-international` |
| `1283` | associate | Mim Fashion wear's | `ms-fashion-wear` | `mim-fashion-wear`, `mm-fashion-wear` |
| `528` | associate | S.A. Fashion | `as-knitwear` | `sap-fashions`, `bsa-fashion`, `saz-fashion`, `sas-fashions`, `sag-fashion` |
| `1261` | associate | Tex Fashion (BD) | `tex-apparels` | `textil-fashions`, `fashion-tex`, `q-tex-fashion`, `r-tex-fashion` |
| `331` | associate | Union Fashion | `mirza-fashion-and-design` | `union-fashion`, `union-fashions` |
| `general:4572` | general | Kenpark Bangladesh Apparel (Pvt) Ltd. | `kenpark-bangladesh` | `kenpark-bangladesh-apparel-pvt-ltd-k-3`, `kenpark-bangladesh-apparel-pvt-limited-k5` (unpublished) |
| `general:5756` | general | Snowtex Outerwear Ltd. | `cut-n-sew` | `snowtex-outer-wear`, `snowtex-outerwear` |
| `general:3778` | general | South End Sweater Co. Ltd. | `4a-yarn-dyeing` | `south-end-sweater`, `southend-sweater` |
| `general:3624` | general | Southeast Sweaters Ltd. | `gm-fashion` | `southeast-sweater`, `south-east-sweater` |
| `general:2436` | general | Univogue Garments Co. Ltd. Unit-II | `univogue-garments` | `univogue-garments-co-ltd-unit-2`, `univogue-garments-company-limited-unit-1`, `univogue-garments-co-ltd-unit-iii` (all unpublished) |

Note the shape of the last five: the ambiguity is between two spellings of the
same company (`snowtex-outer-wear` / `snowtex-outerwear`, `south-end-sweater` /
`southend-sweater`, `southeast-sweater` / `south-east-sweater`, `union-fashion` /
`union-fashions`). Those are duplicate-company defects in their own right and are
tracked separately — 27 such pairs exist.

---

## Section 3 — The 177 foreign registrations

The registered company is not in our database under any tolerated spelling, so
the record sits on a name-similar row that is a different business. These
profiles display a Verified badge naming someone else. **Nothing is missing from
a real profile here** — the harm is a false badge.

They are not homogeneous. Three sub-classes, and they need different treatment.

### 3a — Almost certainly the same company; the matcher was too strict (13)

Review and, where confirmed, treat as correctly placed rather than foreign.

| ref | registered to | displayed on |
| -- | -- | -- |
| `general:2312` | Iqbal Texware Limited | IQBAL TEXWEAR LTD (`iqbal-texwear`) |
| `general:3850` | Pantex Dresses Ltd. | PANTEX DRESS LTD. (`pantex-dress`) |
| `general:2922` | Novel Hurricane Knit Gmts. Ltd. | Novel Hurricane Knit Garments Ltd. (`novel-hurricane-knit-garments`) |
| `general:4880` | Mascotex Ltd. | MASCO TEX LTD. (`masco-tex`) |
| `general:4676` | Epic Garments Manf. Co. Ltd. | Epic Garments manufacturing Co Ltd (`epic-garments-manufacturing`) |
| `general:2791` | Aziz Garments Ltd. | Azim Garments Ltd. (`azim-garments`) — **check carefully, Aziz vs Azim may be two companies** |
| `general:6881` | Axon Fashion Limited | Axon Fashion International (`axon-fashion-international`) |
| `general:4800` | Le-Nouveautex Knit Fashion | Le Nouveautex (Pvt) Ltd. (`le-nouveautex`) |
| `general:698` | Minar Textiles (Garments Div.) | MINAR TEXTILE (`minar-textile`) |
| `general:5837` | Penny Design Knitwear | Penny Design Limited (`penny-design`) |
| `general:6781` | Fashion Trade | Fashion Trade International (`fashion-trade-international`) |
| `general:2252` | Fashion Fair Ltd. | Fashion Fair International (`fashion-fair-international`) |
| `general:6746` | Gaya Product Development Company (BD) Ltd. | Alpha Product Development Company (BD) Ltd. (`alpha-product-development-company-bd`) — **check, Gaya vs Alpha looks like two companies** |

### 3b — A unit's registration on the parent, or the parent's on a unit (6)

These are Domain Law cases. Route them through the extensions work, not through
a name-matching repair.

| ref | registered to | displayed on |
| -- | -- | -- |
| `general:4901` | Knit Softwear Ltd. (U-2) | KNIT SOFTWEAR LTD. (UNIT-2) (`knit-softwear-ltd-unit-2`) — same unit, spelling only |
| `general:4834` | The Civil Engineers Ltd. (Sw Unit) | The Civil Engineers Limited (`the-civil-engineers`) — unit's number on parent |
| `general:3294` | Dekko Knitwears Ltd. (Unit-2) | DEKKO KNITWEARS LTD. (`dekko-knitwear`) — unit's number on parent |
| `general:3302` | Garib & Garib Co. Ltd. (Unit-2) | Garib & Garib Co. Ltd. (`garib-and-garib`) — unit's number on parent |
| `general:4210` | Intramex Knitwear Ltd. | Intramex Knit Wear Ltd. (Unit-2) (`intramex-knitwear-ltd-unit-2`) — **parent's number on the unit, the reverse case** |
| `general:6510` | Viyellatex Apparels Ltd. | VIYELLATEX LTD. (`viyellatex`) — two distinct companies in one group |

### 3c — A buying house's registration displayed on a factory (158)

The dominant pattern: an Associate-register buying house whose number is showing
on a General-register manufacturer with a similar name. Under the Domain Law
these are two different companies and must never be joined. The registered
company is simply not on SourceBD.

Full list, `ref` / registered to / displayed on:

| ref | registered to | displayed on |
| -- | -- | -- |
| `1114` | A.R. Apparel Sourcing | R. A. APPARELS LTD (`ra-apparels`) |
| `644` | Aartistic International | ARTISTIC APPARELS LTD. (`artistic-apparels`) |
| `1204` | AGS Fashion Ltd. | Ags Apparels Ltd (`ags-apparels`) |
| `504` | Al-Baraka Trading | AL-BARAKA APPARELS (`al-baraka-apparels`) |
| `1018` | Alex Fashion | Alex Bangladesh (`alex-bangladesh`) |
| `1652` | AMH Corporation | AMH APPARELS LIMITED (`amh-apparels`) |
| `687` | Atelier Sourcing Ltd. | COLOR CITY LTD. (`color-city`) |
| `1238` | Attire BD | Attire International (`attire-international`) |
| `840` | Authentic Fashion International | Authentic knitwear ltd. (`authentic-knitwear`) |
| `42` | Awss (BD) Limited | Awss Fashions Ltd. (`awss-fashions`) |
| `1640` | Ayesha Trading | Ayesha Fashion Limited (`ayesha-fashion`) |
| `88` | Basic Fashion | Basic Apparels Ltd. (`basic-apparels`) |
| `664` | BD-Tex Sourcing | BD TEX (`bd-tex`) |
| `369` | Best Buy International Knit Wears | AMS Fahion House (`ams-fahion-house`) |
| `600` | Blue Bird Attire Ltd. | Blue Bird Fashion (`blue-bird-fashion`) |
| `901` | C & A Sourcing International Ltd. | A & C (BD) Ltd. (`a-and-c-bd`) |
| `913` | Caretex | Caretex Sourcing Ltd. (`caretex-sourcing`) |
| `1404` | Tex Care | Caretex Sourcing Ltd. (`caretex-sourcing`) |
| `1256` | Classic Fashion Sourcing | CLASSIC FASHION (`classic-fashion`) |
| `55` | Classic Fashion International Ltd. | CLASSIC FASHION (`classic-fashion`) |
| `68` | Classic International (Pvt.) Ltd. | CLASSIC FASHION (`classic-fashion`) |
| `67` | Match International (Pvt.) Ltd. | CLASSIC FASHION (`classic-fashion`) |
| `690` | City Apparel-Tex Co. (CATCO) | City Import (`city-import`) |
| `1443` | Coop Trading BD | Coop Global Sourcing Limited (`coop-global-sourcing`) |
| `778` | DK Design Ltd. | DK KNIT WEAR LTD (`dk-knitwear`) |
| `478` | DK Collection | DK KNIT WEAR LTD (`dk-knitwear`) |
| `1314` | L. A. T Sportwear Ltd. | DK KNIT WEAR LTD (`dk-knitwear`) |
| `1403` | Doel Sourcing Ltd. | DOEL ASSOCIATE LTD. (`doel-associate`) |
| `651` | Divine Sourcing Ltd. | DIVINE TEXTILE LTD (`divine-textile`) |
| `834` | Dynamic International Sourcing Ltd. | Dynamic Sourcing Ltd. (`dynamic-sourcing`) |
| `944` | Ejahar Brother's & Garments Ltd. | Elham International Ltd. (`elham-international`) |
| `1277` | Elham Sourcing Ltd. | Elham International Ltd. (`elham-international`) |
| `668` | Euro Tex | EUROTEX FASHION LTD. (`eurotex-fashion`) |
| `697` | Top Grade International Enterprise Ltd. | EUROTEX FASHION LTD. (`eurotex-fashion`) |
| `89` | Exo Bangladesh | Aries Corporation (`aries`) |
| `1591` | Fashion Theory Ltd. | Etam Int'l Sourcing (Shanghai) Co. Ltd. (`etam-international-l-sourcing-shanghai`) |
| `458` | Feed Back Clothing Co. | Blue Avenue Clothing Ltd. (`blue-avenue-clothing`) |
| `196` | RS Collection | Blue Avenue Clothing Ltd. (`blue-avenue-clothing`) |
| `239` | Gilco Industries Ltd. | Gilco Fashion Ltd. (`gilco-fashion`) |
| `946` | Global Apparel Sourcing Ltd. | Global Knitwear Ltd. (`global-knitwear`) |
| `914` | Global Textile Sourcing Limited | Global Knitwear Ltd. (`global-knitwear`) |
| `1342` | Golden Touch | Golden Tex (`golden-tex`) |
| `142` | Heliix Limited | HELIX GARMENTS LIMITED. (`helix-garments`) |
| `1568` | Impression Sourcing & Design Limited | Impression Design (`impression-design`) |
| `1285` | Integral Fashion | Integra Apparels Bangladesh Ltd (`integra-apparels-bangladesh`) |
| `1499` | Intend Fashion | Intend Tex Sourcing Ltd. (`intend-tex-sourcing`) |
| `882` | Intercare Fashion | Intercare Ltd (`intercare`) |
| `1595` | Interloop Sourcing Ltd. | INTERLOOP BD LTD (`interloop-bd`) |
| `423` | J.M. Export Ltd. | J. M. KNITWEAR LTD. (`jm-knitwear`) |
| `422` | Reglisse | J. M. KNITWEAR LTD. (`jm-knitwear`) |
| `990` | Islam Trading Corporation | SADIA KNIT COMPOSITE (PVT) LTD. (`sadia-knit-composite`) |
| `1101` | JDK Sourcing Ltd. | JDK Fashion Ltd. (`jdk-fashion`) |
| `507` | Jenable Textile Ltd. | HMN FASHION LTD. (`hmn-fashion`) |
| `1416` | Just Group Bangladesh Ltd. | JUST KNITWEAR LTD (`just-knitwear`) |
| `53` | Kam Knit | Danny Dhaka Ltd. (`danny-dhaka`) |
| `119` | K.L. International Ltd. | K.L Fashion (`kl-fashion`) |
| `144` | Kader International | KADER KNITWEAR (`kader-knitwear`) |
| `935` | Knit Wear Creator Ltd. | Fashion Zone International (`fashion-zone-international`) |
| `general:1341` | Fashion Zone Ltd. | Fashion Zone International (`fashion-zone-international`) |
| `525` | Lawyee Apparel Exports Ltd. | LIBAS STITCH (`libas-stitch`) |
| `175` | Libas International Ltd. | LIBAS KNITWEAR LTD (`libas-knitwear`) |
| `1677` | M & Z Sourcing BD | M & Z Co. Ltd. (`m-and-z`) |
| `1437` | M.H. Import Export | M. H APPARELS LTD (`mh-apparels`) |
| `503` | Mahmud Enterprise | Mahmud Fashion Limited (`mahmud-fashion`) |
| `421` | Mars Associates | MARS FASHION (`mars-fashion`) |
| `580` | Map Tex | Fashion Xpress Ltd. (`fashion-xpress`) |
| `293` | Mastex | MASTEX DESIGNERS LTD. (`mastex-designers`) |
| `968` | Matrix Sourcing Ltd. | Matrix Apparels Ltd. (`matrix-apparels`) |
| `1370` | Merchantex International | Merchantex Co. (BD) Ltd. (`merchantex-co-bd`) |
| `1081` | Moon Apparels Limited | MOON KNITWEAR (`moon-knitwear`) |
| `141` | Mum Fashion Merchandising Ltd. | Grassy (`grassy`) |
| `11` | Mustang International Limited | Mustang Associates Ltd. (`mustang-associates`) |
| `1196` | Natex Bangladesh Limited | Dhaka Natex Sourcing Ltd. (`dhaka-natex-sourcing`) |
| `1115` | Next Sourcing Ltd. | NEXT APPARELS (`next-apparels`) |
| `1523` | Next Sourcing Services Limited | NEXT APPARELS (`next-apparels`) |
| `1506` | Nisha Fashions Wear | Nisha Trade International (`nisha-trade-international`) |
| `1124` | Orient Crafts Ltd. | H.P. CHEMICAL LTD (`hp-chemical`) |
| `159` | Oyon Design | TEN CATE PERMESS INTERLINING (BD) LTD. (`ten-cate-permess-interlining-bd`) |
| `916` | Otto Int'l (Hong Kong) Limited Bangladesh | KGS Sourcing Ltd (Redcats ). (`kgs-sourcing-ltd-redcats`) |
| `278` | Pacers International | Novatex International (`novatex-international`) |
| `754` | Park Mode Wear Ltd. | Abloom Limited (`abloom`) |
| `1266` | Pavel Sourcing (BD) Ltd. | PAVEL FASHION LTD. (`pavel-fashion`) |
| `1273` | Pavel Style (BD) Ltd. | PAVEL FASHION LTD. (`pavel-fashion`) |
| `255` | Panache Pvt. Ltd. | Panache International Limited (`panache-international`) |
| `65` | Paramount International | PARAMOUNT APPARELS LTD (`paramount-apparels`) |
| `871` | Perfoace Fashion Apparel (Pvt.) Ltd. | PERFOACE KNITWEAR LTD. (`perfoace-knitwear`) |
| `1012` | Price Club General Trading Ltd. | Global USA Ltd. (`global-usa`) |
| `242` | Protex Enterprise Co. Ltd. | Protex International (`protex-international`) |
| `319` | Quatro International | QUATTRO FASHION LIMITED (`quattro-fashion`) |
| `1209` | R. S. Corporation | S. R. APPARELS. (`sr-apparels`) |
| `601` | R.A. Trading Limited | R. A. APPARELS LTD (`ra-apparels`) |
| `1550` | Ratool Sourcing | RATOOL APPARELS LTD. (`ratool-apparels`) |
| `74` | Reliance Fashions Ltd. | MULTI STYLE CUSTOME (`multi-style-custome`) |
| `1265` | Renaissance Design Ltd. | INTERSTOFF APPARELS LTD (`interstoff-apparels`) |
| `1445` | Rich Cotton Limited | Rich Cotton Apparels Limited (`rich-cotton-apparels`) |
| `240` | Rhyme Trading | Rhyam International Ltd. (`rhyam-international`) |
| `326` | Riviera International Ltd. | THE FASHION ISLAND LTD. (`the-fashion-island`) |
| `377` | RMT Corporation Ltd. | Postex Ltd. (`postex`) |
| `930` | Saint Martin Apparels | Ags Apparels Ltd (`ags-apparels`) |
| `1631` | Sakib Apparels Limited | SAKIB KNITWEAR (`sakib-knitwear`) |
| `1639` | Sara Sourcing Ltd. | SARA FASHION (PVT) LTD. (`sara-fashion`) |
| `30` | Scandex Fashion Ltd. | Scandex (Bd) Ltd (`scandex-bd`) |
| `1477` | Shan International Trading Company | Shan Global Company (`shan-global`) |
| `154` | Simtrade Limited | Rosemary Limited (`rosemary`) |
| `135` | Sohel International | SOHEL KNITWEAR (PVT) LTD (`sohel-knitwear`) |
| `227` | Spicy Bangladesh Ltd. | SPICY FASHION LTD. (`spicy-fashion`) |
| `266` | Square Int. Inc. | Preston France (BD) Limited (`preston-france-bd`) |
| `732` | Stayn Unn | Rainbow Tex (`rainbow-tex`) |
| `393` | Studio Max Mazza | Midasia Designers Ltd. (`midasia-designers`) |
| `1660` | Styelaa Fashion (Pvt.) Limited | Spark International (`spark-international`) |
| `1064` | Suntex International | SUNTEX APPARELS (BD) LTD (`suntex-apparels-bd`) |
| `1659` | Suxes Attires Ltd. | Aesthetic Apparel (`aesthetic-apparel`) |
| `69` | Tandem Limited | Tandem Fashion Ltd (`tandem-fashion`) |
| `1362` | T.S.A. Bangladesh | FARIHA FASHION LTD. (`fariha-fashion`) |
| `468` | Tamanna International Ltd. | TAMANNA APPARELS LTD (`tamanna-apparels`) |
| `310` | Techno Apparels | TECHNO KNITWEAR (PVT.) LIMITED. (`techno-knitwear`) |
| `637` | Tejgaon Eminent Fashion Ltd. | ATTRACTION GARMENTS LTD. (`attraction-garments`) |
| `645` | Tex Mart Apparels | TEX MART LTD. (`tex-mart`) |
| `1581` | Tex-Mart International | TEX MART LTD. (`tex-mart`) |
| `1686` | Tex Stitch Concept Limited | Gemtex Sourcing Ltd. (`gemtex-sourcing`) |
| `237` | Tex Mark | Mak Tex International Inc. (`mak-tex-international`) |
| `1359` | Texsport Trading Corporation | Bright Tex Trading Corporation (`bright-tex-trading`) |
| `1382` | Textiss Bangladesh | Mustex Sourcing (`mustex-sourcing`) |
| `909` | Texture BD | ANAM GARMENTS LTD. (`anam-garments`) |
| `1014` | That's It Limited | That's It Fashion Ltd (`that-it-fashion`) |
| `983` | Total Sourcing | TOTAL FASHION LTD (`total-fashion`) |
| `1546` | Trade Evidence | Abid Export Ltd. (`abid-export`) |
| `207` | Triangle Venture Ltd. | Apparel Trade International (`apparel-trade-international`) |
| `978` | Trigon Merchandising Services (Pvt.) Ltd. | Trigon Merchandising Corporation Ltd. (`trigon-merchandising`) |
| `929` | Trybe Bangladesh Limited | Bodystretch Bangladesh Ltd. (`bodystretch-bangladesh`) |
| `779` | Union Trade Impex Limited | Mirza Fashion & Design (`mirza-fashion-and-design`) |
| `106` | Unistar Distribution Company (BD) Ltd. | Euro Point Ltd. (`euro-point`) |
| `371` | Unitex Fashion Wears | UNITED FASHION WEAR LTD. (`united-fashion-wear`) |
| `402` | Unitex | UNITEX KNITWEAR LTD (`unitex-knitwear`) |
| `1092` | Universal Sourcin BD | RED DOT APPARELS LTD. (`red-dot-apparels`) |
| `846` | Universal Fashion Club | UNIVERSAL TRIMS (`universal-trims`) |
| `508` | Vogue Axis | VOGUE AXIS ASSOCIATES LTD. (`vogue-axis-associates`) |
| `1039` | Walther & Walther International | Floreal International Ltd. (`floreal-international`) |
| `38` | Welldone (BD) Ltd. | Welldone Apparel Ltd. (`welldone-apparel`) |
| `1447` | White Swan Limited | Styleelite Limited (`styleelite`) |
| `1463` | WIKITEX - BD | NEEDLE THREAD PVT. LIMITED (`needle-thread`) |
| `1082` | Winsome Sourcing | Mega Merchandising Company Ltd. (`mega-merchandising`) |
| `816` | Yashmak International | Indomanu Bangladesh (`indomanu-bangladesh`) |
| `1668` | Xplore Sourcing | Explore Fashion Ltd. (`explore-fashion`) |
| `17` | ZXY Apparel Buying Solutions Ltd. | Z7 Apparels Ltd. (`z7-apparels`) |
| `1561` | ZXY International DMCC | Z7 Apparels Ltd. (`z7-apparels`) |
| `1563` | ZXY International FZCO | Z7 Apparels Ltd. (`z7-apparels`) |
| `769` | Zzan Design Ltd. | S Asia High Lights (`s-asia-high-lights`) |
| `1267` | Fashion Flow Limited | FASHION FLOW APPARELS LTD. (`fashion-flow-apparels`) |
| `23` | Designtex Ltd. | Designtex Knitwear Ltd. (`designtex-knitwear`) |
| `1436` | Fashion Plus International Ltd. | Fashion Plus Ltd. (`fashion-plus`) |
| `699` | Fashion Tex International | FASHION TEX LTD. (`fashion-tex`) |
| `341` | Fashion World International | Fashion World Ltd. (`fashion-world`) |
| `1375` | Tex-Design Sourcing Limited | Tex Design (`tex-design`) |
| `1431` | Textile Sourcing | Textile Apparel Sourcing Corp. (`textile-apparel-sourcing`) |
| `general:3070` | Coast To Coast Apparels Ltd. | COAST TO COAST (PVT.) LTD. (`coast-to-coast`) |
| `general:2768` | Coast To Coast Fashion Ltd. | COAST TO COAST (PVT.) LTD. (`coast-to-coast`) |
| `general:3598` | Fashion Create Apparels Ltd. | Fashion Create (`fashion-create`) |

Decision required from the founder on class 3c: whether these registrations are
removed from the profiles displaying them, marked unverified, or the registered
companies are imported as new rows so each number reaches its owner.

---

## Section 4 — 15 records whose rightful owner already holds its own

The displaying row carries an extra number belonging to a company that is on
SourceBD and already correctly registered. Lower risk than the orphans, since
nobody's profile is empty, but the displaying company still shows a false badge.

| ref | registered to | displayed on | rightful row (its own refs) |
| -- | -- | -- | -- |
| `1440` | BD-Tex Apparels Ltd. | `bd-tex` | `tex-apparels` (`1261`) |
| `35` | DK Textile Ltd. | `dk-knitwear` | `dk-textile` (`general:3952`) |
| `1159` | Eurotex International | `eurotex-fashion` | `protex-international` (`150`, `242`) |
| `695` | Euro Tex International | `eurotex-fashion` | `eu-tex-international` (`828`) |
| `1669` | Flaxen Fashionwears Limited | `fariha-fashion` | `flaxen-fashionwears` (`441`) |
| `543` | Global Fashion | `global-knitwear` | `global-fashions-bd` (`595`) |
| `1435` | H.R.M. Sourcing Ltd. | `grs-sourcing` | `rm-sourcing-bangladesh` (`1179`) |
| `60` | Landmark Designs Ltd. | `dinatex-international` | `landmark-designers` (`284`) |
| `1454` | Manha Apparels Limited | `manha-attires-composite` | `manta-apparels` (`general:3838`) |
| `1545` | Off Price Clothing | `abid-export` | `off-price-clothing` (`general:7002`) |
| `97` | Quality Assured Ltd. | `echo-sourcing` | `quality-assured` (`general:3734`) |
| `1190` | S.K. Fashion | `sk-apparels` | `ks-fashions` (`general:5803`) |
| `939` | SAF International | `saf-apparel-bd` | `sf-international` (`1655`) |
| `118` | Tex Well International Co. Ltd. | `sunwah-textile-international` | `tex-vill-international` (`1444`) |
| `781` | Zaima Fashion | `blue-bird-fashion` | `atima-fashions` (`174`, `679`) |

Several of these candidate matches look weak — `manta-apparels` for Manha
Apparels, `ks-fashions` for S.K. Fashion, `tex-vill-international` for Tex Well.
Verify each against the register before moving anything.

---

## Section 5 — 8 records with no recovered register name

No name exists for these refs in `bgmea-names.json`, so their attribution cannot
be judged. Several of the holders have malformed names, which suggests a parsing
defect at ingest rather than a registry gap.

| ref | displayed on |
| -- | -- |
| `1698` | `1046-am-fashion` |
| `1697` | `abc-international` |
| `1722` | `abl` |
| `1749` | `limited-reg-216-alveena-tex` |
| `1708` | `ayaan-clothing` |
| `1747` | `ltd-reg-1325-bilinc-international` |
| `1729` | `caravan-mode` |
| `1734` | `managing-director-cf-sourcing` |

Slugs such as `limited-reg-216-alveena-tex` and
`managing-director-cf-sourcing` indicate the scraper captured a fragment of the
page as the company name. That is a separate ingest defect and should be filed.

---

## EPB — nothing to reattach

For EPB there is no unused scraped data. `etl/raw` holds only the BGMEA
associate PDF and RSC artefacts; no EPB files exist anywhere in the repository.
The 539 active EPB records are everything ever fetched, and the 7,181 published
companies holding BGMEA or BKMEA but no EPB record (see
`ops/plans/rez-113-epb-coverage-evidence.md`) are unfetched rather than
unattached. Vintage Denim Ltd.'s EPB page must be retrieved by the category
pass; no amount of re-matching produces it.

Caution: EPB's own URLs are unreliable as keys. The page for Vintage Denim Ltd.
sits at a path reading `suhcheon-company-bd-ltd`. Match on page content.

---

## How to reproduce

Direct Postgres connections from the founder's machine time out against
`aws-1-us-west-1.pooler.supabase.com:6543`. Use the Supabase REST API with
`SUPABASE_SERVICE_ROLE_KEY`, paging at 1,000 rows:

- `sources?code=eq.BGMEA` for the source id
- `suppliers?select=id,slug,company_name,is_published,facility_of`
- `source_records?source_id=eq.<id>&status=eq.active&select=supplier_id,source_ref`

then compare each `source_ref` against `ops/plans/bgmea-names.json`. Name
comparison must tolerate punctuation, spacing, word order, legal suffixes and the
abbreviations listed in the Method section, with a 0.92 similarity fallback.
The full-population run takes roughly fifteen minutes because the fallback
compares each unmatched register name against all 10,913 supplier names.
