# REZ-102 — the nine no-host-match hosts, and the backed-only identity gap

Detection and reporting only. **No splits, merges, unpublishing or array edits.**
REZ-90's `review` gate is untouched and must stay closed on these rows.

## Question 1 — what is the real relationship?

Names alone produced the group-of-companies reading. This tests it against
the premises and switchboard on each member record, using only host-side
evidence that a **different** register asserted. The denormalised
`suppliers` columns are excluded from the test — they are unions written
by the same attach, so they agree with the intruder by construction.

| relationship | hosts |
| -- | -- |
| `group-corroborated` | 2 — `dk-knitwear`, `fariha-fashion` |
| `refs-cohere-only` | 3 — `ags-apparels`, `jm-knitwear`, `pavel-fashion` |
| `no-link` | 4 — `as-knitwear`, `global-knitwear`, `next-apparels`, `ra-apparels` |

### `ags-apparels` — Ags Apparels Ltd  →  **refs-cohere-only**

Own-identity anchor (non-BGMEA registers):
- `RSC:rsc_factory_name` → Ags Apparels Ltd
- `RSC` parent group → **Victory Group**

| ref | recovered name | oracle | member type | address | tel |
| -- | -- | -- | -- | -- | -- |
| `1204` | AGS Fashion Ltd. | associate-pdf | associate_buying_house | Road # 30, Home # 11/B (3rd Floor), Gulshan-1, Dhaka | 9862923, 01741009980 |
| `930` | Saint Martin Apparels | associate-pdf | associate_buying_house | House # 11/B, Road # 30, Gulshan-1, Dhaka | 9862923 |

- AGS Fashion Ltd. ↔ Saint Martin Apparels: same premises (premises+area); shared phone 9862923
- Saint Martin Apparels ↔ AGS Fashion Ltd.: same premises (premises+area); shared phone 9862923

Already published from the foreign records (not used as evidence above):
- published address_raw is a BGMEA member record's address
- 2 of 2 published phone numbers come only from the foreign BGMEA records
- published email ghazi@agsfashion.com is on no register entry of the host's own

### `as-knitwear` — A.S KNITWEAR  →  **no-link**

Own-identity anchor (non-BGMEA registers):
- `BKMEA:222` → A.S KNITWEAR
- `BKMEA:70:detail` → A.S KNITWEAR
- `BKMEA:892:detail` → A. S. KNIT WEAR
- `BKMEA:899` → A. S. KNIT WEAR

| ref | recovered name | oracle | member type | address | tel |
| -- | -- | -- | -- | -- | -- |
| `528` | S.A. Fashion | associate-pdf | associate_buying_house | Barkhain Tallar Dwip, Anwara, Chittagong | 670442 |
| `953` | A. S. Fashion | associate-pdf | associate_buying_house | 6/2, Jawab Street (1st Floor), Khaleque Mansion, 1167,, Wari, Dhaka, Kadamtali, Chittagong | 01833311286, 01671333681 |

- S.A. Fashion: no premises or switchboard shared with anything on this row
- A. S. Fashion: no premises or switchboard shared with anything on this row

Already published from the foreign records (not used as evidence above):
- 2 of 6 published phone numbers come only from the foreign BGMEA records
- published email gazitex@yahoo.com is on no register entry of the host's own

### `dk-knitwear` — DK KNIT WEAR LTD  →  **group-corroborated**

Own-identity anchor (non-BGMEA registers):
- `BKMEA:1345` → DK KNIT WEAR LTD
- `BKMEA:1352:detail` → DK KNIT WEAR LTD

| ref | recovered name | oracle | member type | address | tel |
| -- | -- | -- | -- | -- | -- |
| `1314` | L. A. T Sportwear Ltd. | associate-pdf | associate_buying_house | House # 15, Road # 68/A,, Gulshan-2, Dhaka | 8824070, 01711548158 |
| `35` | DK Textile Ltd. | associate-pdf | associate_buying_house | House # 30, Road # 28, Block-K, Banani, Dhaka | 8827134, 8827151 |
| `478` | DK Collection | associate-pdf | associate_buying_house | House # 30, Road # 28, Block-K, Banani, Dhaka | 8827134, 8827151 |
| `778` | DK Design Ltd. | associate-pdf | associate_buying_house | House # 30, Road # 28, Block # K, Banani, Dhaka | 8824134, 01711548158 |

- **L. A. T Sportwear Ltd.** ↔ host's own register: BKMEA:bkmea_mailing_address:1345: same premises (premises (area unstated on one side)); BKMEA:bkmea_mailing_address:1352:detail: same premises (premises (area unstated on one side)); BKMEA:bkmea_rep_mobile: shared phone 1711548158
- L. A. T Sportwear Ltd. ↔ DK Design Ltd.: shared phone 1711548158
- DK Textile Ltd. ↔ DK Collection: same premises (premises+area); shared phone 8827134
- DK Textile Ltd. ↔ DK Design Ltd.: same premises (premises+area)
- DK Collection ↔ DK Design Ltd.: same premises (premises+area)
- DK Collection ↔ DK Textile Ltd.: same premises (premises+area); shared phone 8827134
- **DK Design Ltd.** ↔ host's own register: BKMEA:bkmea_rep_mobile: shared phone 1711548158
- DK Design Ltd. ↔ DK Collection: same premises (premises+area)
- DK Design Ltd. ↔ DK Textile Ltd.: same premises (premises+area)
- DK Design Ltd. ↔ L. A. T Sportwear Ltd.: shared phone 1711548158

Already published from the foreign records (not used as evidence above):
- 4 of 5 published phone numbers come only from the foreign BGMEA records

### `fariha-fashion` — FARIHA FASHION LTD.  →  **group-corroborated**

Own-identity anchor (non-BGMEA registers):
- `BKMEA:1664:detail` → FARIHA FASHION LTD.
- `BKMEA:1687` → FARIHA FASHION LTD.
- `BKMEA:2268:detail` → FARIHA FASHION LTD
- `BKMEA:29:detail` → FARIHA APPARELS LTD.
- `GOTS:gots_brand_names` → FARIHA FASHION LTD.

| ref | recovered name | oracle | member type | address | tel |
| -- | -- | -- | -- | -- | -- |
| `1362` | T.S.A. Bangladesh | associate-pdf | associate_buying_house | 51-52, Shah Kabir Mazar Road, Moushair, Dakhkhin Khan, Dhaka | 8802 8913263, 01713 005839 |
| `1669` | Flaxen Fashionwears Limited | associate-pdf | associate_buying_house | House # 35, Road # 9, Sector # 15, Uttara, Dhaka | 02-8913263, 02-8959481 |

- **T.S.A. Bangladesh** ↔ host's own register: BKMEA:bkmea_owner_mobile: shared phone 1713005839; BGAPMEA:bgapmea_phone: shared phone 8913263; OEKO_TEX:oeko_profile_phone: shared phone 28913263
- T.S.A. Bangladesh ↔ Flaxen Fashionwears Limited: shared phone 28913263
- **Flaxen Fashionwears Limited** ↔ host's own register: BGAPMEA:bgapmea_phone: shared phone 8913263; BGAPMEA:bgapmea_fax: shared phone 8959481; OEKO_TEX:oeko_profile_phone: shared phone 28913263; BKMEA:bkmea_owner_email: name matches mailbox domain (`flaxen`); BGAPMEA:bgapmea_email_raw: name matches mailbox domain (`flaxen`); OEKO_TEX:oeko_profile_email: name matches mailbox domain (`flaxen`)
- Flaxen Fashionwears Limited ↔ T.S.A. Bangladesh: shared phone 28913263

Already published from the foreign records (not used as evidence above):
- 1 of 7 published phone numbers come only from the foreign BGMEA records

### `global-knitwear` — Global Knitwear Ltd.  →  **no-link**

Own-identity anchor (non-BGMEA registers):
- `RSC:rsc_factory_name` → Global Knitwear Ltd.
- `RSC` parent group → **Azim Group**

| ref | recovered name | oracle | member type | address | tel |
| -- | -- | -- | -- | -- | -- |
| `543` | Global Fashion | associate-pdf | associate_buying_house | House # 230, Road # 16 (Lake Road), New DOHS, Mohakhali, Dhaka | 8816559 |
| `914` | Global Textile Sourcing Limited | associate-pdf | associate_buying_house | House # 325, Road # 5, DOHS, Baridhara DOHS, Dhaka | 8410474, 8410475 |
| `946` | Global Apparel Sourcing Ltd. | associate-pdf | associate_buying_house | House # 457, Road # 8, DOHS, Baridhara DOHS, Dhaka | 01713313253, 8410652 |

- Global Fashion: no premises or switchboard shared with anything on this row
- Global Textile Sourcing Limited: no premises or switchboard shared with anything on this row
- Global Apparel Sourcing Ltd.: no premises or switchboard shared with anything on this row

Already published from the foreign records (not used as evidence above):
- published address_raw is a BGMEA member record's address
- 5 of 6 published phone numbers come only from the foreign BGMEA records
- published email subbu@gasl.biz is on no register entry of the host's own

### `jm-knitwear` — J. M. KNITWEAR LTD.  →  **refs-cohere-only**

Own-identity anchor (non-BGMEA registers):
- `BKMEA:1076:detail` → J. M. KNITWEAR LTD.
- `BKMEA:1085` → J. M. KNITWEAR LTD.

| ref | recovered name | oracle | member type | address | tel |
| -- | -- | -- | -- | -- | -- |
| `422` | Reglisse | associate-pdf | associate_buying_house | Hosue # 5, Road # 6, Nikunjo, Dhaka | 0171-595204, 0173-003540 |
| `423` | J.M. Export Ltd. | associate-pdf | associate_buying_house | House # 3, Road # 17, Block-C, Banani, Dhaka | 0171-595204, 0173-003540 |

- Reglisse ↔ J.M. Export Ltd.: shared phone 171595204
- J.M. Export Ltd. ↔ Reglisse: shared phone 171595204

Already published from the foreign records (not used as evidence above):
- 2 of 8 published phone numbers come only from the foreign BGMEA records
- published email jmfashionr@yahoo.com is on no register entry of the host's own

### `next-apparels` — NEXT APPARELS  →  **no-link**

Own-identity anchor (non-BGMEA registers):
- `BKMEA:518:detail` → NEXT APPARELS
- `BKMEA:523` → NEXT APPARELS

| ref | recovered name | oracle | member type | address | tel |
| -- | -- | -- | -- | -- | -- |
| `1115` | Next Sourcing Ltd. | associate-pdf | associate_buying_house | 827/1 (Ground Floor), East Shewrapara, Mirpur, Dhaka | 07123158784, 8035070 |
| `1523` | Next Sourcing Services Limited | associate-pdf | associate_buying_house | Giant Business Tower, Level # 4&5, Plot # 3&3A, Sector # 3, Uttara, Dhaka | 02-58957222 |

- Next Sourcing Ltd.: no premises or switchboard shared with anything on this row
- Next Sourcing Services Limited: no premises or switchboard shared with anything on this row

Already published from the foreign records (not used as evidence above):
- 3 of 3 published phone numbers come only from the foreign BGMEA records
- published email ikramul@nextsourcingbd.com is on no register entry of the host's own

### `pavel-fashion` — PAVEL FASHION LTD.  →  **refs-cohere-only**

Own-identity anchor (non-BGMEA registers):
- `BKMEA:936:detail` → PAVEL FASHION LTD.
- `BKMEA:943` → PAVEL FASHION LTD.

| ref | recovered name | oracle | member type | address | tel |
| -- | -- | -- | -- | -- | -- |
| `1266` | Pavel Sourcing (BD) Ltd. | associate-pdf | associate_buying_house | House # 119, Block # F, Flat # B4, Level # 08, Road # 01, Banani, Dhaka | 7746946, 01711534801 |
| `1273` | Pavel Style (BD) Ltd. | associate-pdf | associate_buying_house | House # 119, Block - F, Flat # B4, Level # 05, Road # 01, Banani, Dhaka | 7746946, 01711 534801 |

- Pavel Sourcing (BD) Ltd. ↔ Pavel Style (BD) Ltd.: same premises (premises+area); shared phone 1711534801
- Pavel Style (BD) Ltd. ↔ Pavel Sourcing (BD) Ltd.: same premises (premises+area); shared phone 1711534801

Already published from the foreign records (not used as evidence above):
- 2 of 3 published phone numbers come only from the foreign BGMEA records

### `ra-apparels` — R. A. APPARELS LTD  →  **no-link**

Own-identity anchor (non-BGMEA registers):
- `BKMEA:1391` → R. A. APPARELS LTD
- `BKMEA:1490:detail` → R. A. APPARELS LTD

| ref | recovered name | oracle | member type | address | tel |
| -- | -- | -- | -- | -- | -- |
| `1114` | A.R. Apparel Sourcing | associate-pdf | associate_buying_house | Shopla Bhaban(Ground Fl), 49, Motijheel, 544), Motijheel, Dhaka, Easkaton | 01944530515 |
| `330` | A.R. Fashion | associate-pdf | associate_buying_house | Fazlur Rahman Center (5th Floor) 72,, Dilkusha, DT Road, Motijheel, Dhaka | 9560149, 9553995 |
| `601` | R.A. Trading Limited | associate-pdf | associate_buying_house | House # 64, Road # 6, Block-A, Section # 12, Mirpur, Dhaka | 9014484, 01819260406 |

- A.R. Apparel Sourcing: no premises or switchboard shared with anything on this row
- A.R. Fashion: no premises or switchboard shared with anything on this row
- R.A. Trading Limited: no premises or switchboard shared with anything on this row

Already published from the foreign records (not used as evidence above):
- 5 of 9 published phone numbers come only from the foreign BGMEA records
- published email arknit@bdcom.com is on no register entry of the host's own

## Question 2 — sizing the backed-only identity gap

`v_supplier_registry_ids` asks whether a live record on the row backs the
number. It does not ask whether that record names this company. Sizing the
difference needs a registered name per record, and production stores none:
**0 of 20224** source records carry
`scraped_company_name`, BGMEA's included. A measurement built on that field
has an empty denominator and would report zero disagreement because it
measured nothing, not because nothing is wrong.

Names therefore come from two offline oracles with very different reach.
They are keyed by the whole `source_ref`, because BGMEA runs two registers
that number independently: associate `35` is DK Textile Ltd. while
`general:35` is another company, so stripping the prefix would answer a
question about one register with the other register's answer.

- associate register PDF — 1678 names, **unselected**, but it can only name associate refs
- REZ-88 recovered-name cache — 138 names, **selected** on the 199
  multi-ref hosts, and the only oracle here for general members, so no
  population rate may be quoted from it

| measure | count |
| -- | -- |
| published holding bgmea record | **5740** |
| bgmea records on them | **5970** |
| records with a recoverable name | **1816** |
| records without a name oracle | **4154** |
| suppliers measurable | **1589** |
| suppliers not measurable | **4151** |
| measurable every record agrees | **1416** |
| measurable some record disagrees | **173** |
| measurable all records disagree | **50** |
| records agreeing | **1613** |
| records disagreeing | **203** |
| unbiased slice suppliers | **1554** |
| unbiased slice some disagree | **152** |

**What the denominator actually covers.** The measurable population is
1589 of 5740 published
suppliers holding a BGMEA record — the rest hold only general-member
registrations, which no oracle here can name. So this measures the
associate buying-house register almost exclusively, and says nothing about
the general-member register that makes up the bulk of the population.
The unbiased sub-population — suppliers with at least one record the
associate register itself names — is 1554, of which
152 hold at least one record naming another
company. That is the only rate quotable here, and it is a rate about
associate registrations, not about BGMEA records in general.

### Display-rule options (counts only — not chosen here)

A rule that also required the backing record to NAME the supplier must say
what to do with a record whose registered name nobody knows. That choice
moves the answer further than the measurement does.

| option | numbers removed | suppliers losing a number | suppliers losing the pill |
| -- | -- | -- | -- |
| (i) status quo — backed-only, as shipped by REZ-98 | 0 | 0 | 0 |
| (ii-open) require a naming record, unknown names pass | 203 | 173 | 50 |
| (ii-closed) require a naming record, unknown names fail | 4357 | 4327 | 4201 |
| (iii) show all, label per number | 0 | 0 | 0 (relabels 4357) |
| (iv) recover names first, then decide | 0 | 0 | 0 (needs 4154 names) |

Suppliers whose every named record disagrees with the row — the REZ-102
class seen population-wide:

| supplier | company_name | records that name someone else |
| -- | -- | -- |
| `ags-apparels` | Ags Apparels Ltd | `1204` AGS Fashion Ltd. · `930` Saint Martin Apparels |
| `al-baraka-apparels` | AL-BARAKA APPARELS | `504` Al-Baraka Trading |
| `amh-apparels` | AMH APPARELS LIMITED | `1652` AMH Corporation |
| `as-knitwear` | A.S KNITWEAR | `953` A. S. Fashion · `528` S.A. Fashion |
| `asdwa-fashion` | ASDWA FASHION LTD. | `797` Fashion Comfort (BD) Ltd. |
| `authentic-knitwear` | Authentic knitwear ltd. | `840` Authentic Fashion International |
| `color-city` | COLOR CITY LTD. | `687` Atelier Sourcing Ltd. |
| `desh-bangla-enterprise` | DESH BANGLA ENTERPRISE | `1573` Bangladesh Apparel Inc. |
| `dk-knitwear` | DK KNIT WEAR LTD | `778` DK Design Ltd. · `478` DK Collection · `35` DK Textile Ltd. · `1314` L. A. T Sportwear Ltd. |
| `doel-associate` | DOEL ASSOCIATE LTD. | `1403` Doel Sourcing Ltd. |
| `fariha-fashion` | FARIHA FASHION LTD. | `1669` Flaxen Fashionwears Limited · `1362` T.S.A. Bangladesh |
| `global-knitwear` | Global Knitwear Ltd. | `946` Global Apparel Sourcing Ltd. · `543` Global Fashion · `914` Global Textile Sourcing Limited |
| `helix-garments` | HELIX GARMENTS LIMITED. | `142` Heliix Limited |
| `hp-chemical` | H.P. CHEMICAL LTD | `1124` Orient Crafts Ltd. |
| `jm-knitwear` | J. M. KNITWEAR LTD. | `423` J.M. Export Ltd. · `422` Reglisse |
| `just-knitwear` | JUST KNITWEAR LTD | `1416` Just Group Bangladesh Ltd. |
| `kader-knitwear` | KADER KNITWEAR | `144` Kader International |
| `manha-attires-composite` | MANHA ATTIRES COMPOSITE LTD. | `1454` Manha Apparels Limited |
| `mars-fashion` | MARS FASHION | `421` Mars Associates |
| `mastex-designers` | MASTEX DESIGNERS LTD. | `293` Mastex |
| `mh-apparels` | M. H APPARELS LTD | `1437` M.H. Import Export |
| `moon-knitwear` | MOON KNITWEAR | `1081` Moon Apparels Limited |
| `ms-fashion-wear` | M. S. FASHION WEAR | `1283` Mim Fashion wear's |
| `multi-style-custome` | MULTI STYLE CUSTOME | `74` Reliance Fashions Ltd. |
| `next-apparels` | NEXT APPARELS | `1115` Next Sourcing Ltd. · `1523` Next Sourcing Services Limited |
| `nm-fashion` | N.M. FASHION | `1129` M.N. Enterprise |
| `pa-textile` | P. A. TEXTILE LTD. | `1168` P.A. Fashion Ltd. |
| `paramount-apparels` | PARAMOUNT APPARELS LTD | `65` Paramount International |
| `pavel-fashion` | PAVEL FASHION LTD. | `1266` Pavel Sourcing (BD) Ltd. · `1273` Pavel Style (BD) Ltd. |
| `perfoace-knitwear` | PERFOACE KNITWEAR LTD. | `871` Perfoace Fashion Apparel (Pvt.) Ltd. |
| `ra-apparels` | R. A. APPARELS LTD | `1114` A.R. Apparel Sourcing · `330` A.R. Fashion · `601` R.A. Trading Limited |
| `raz-apparels` | R. A. Z APPARELS. | `1604` A.R.Z Sourcing BD |
| `red-dot-apparels` | RED DOT APPARELS LTD. | `1092` Universal Sourcin BD |
| `sadia-knit-composite` | SADIA KNIT COMPOSITE (PVT) LTD. | `990` Islam Trading Corporation |
| `sakib-knitwear` | SAKIB KNITWEAR | `1631` Sakib Apparels Limited |
| `sara-fashion` | SARA FASHION (PVT) LTD. | `1639` Sara Sourcing Ltd. |
| `shan-knitting-and-processing` | SHAN KNITTING & PROCESSING LTD. | `296` Maxim International |
| `sohel-knitwear` | SOHEL KNITWEAR (PVT) LTD | `135` Sohel International |
| `spicy-fashion` | SPICY FASHION LTD. | `227` Spicy Bangladesh Ltd. |
| `sr-apparels` | S. R. APPARELS. | `1209` R. S. Corporation |
| `suntex-apparels-bd` | SUNTEX APPARELS (BD) LTD | `1064` Suntex International |
| `tamanna-apparels` | TAMANNA APPARELS LTD | `468` Tamanna International Ltd. |
| `tandem-fashion` | Tandem Fashion Ltd | `69` Tandem Limited |
| `techno-knitwear` | TECHNO KNITWEAR (PVT.) LIMITED. | `310` Techno Apparels |
| `ten-cate-permess-interlining-bd` | TEN CATE PERMESS INTERLINING (BD) LTD. | `159` Oyon Design |
| `tex-apparels` | TEX APPARELS | `1261` Tex Fashion (BD) |
| `that-it-fashion` | That's It Fashion Ltd | `1014` That's It Limited |
| `unitex-knitwear` | UNITEX KNITWEAR LTD | `402` Unitex |
| `universal-trims` | UNIVERSAL TRIMS | `846` Universal Fashion Club |
| `vogue-axis-associates` | VOGUE AXIS ASSOCIATES LTD. | `508` Vogue Axis |
