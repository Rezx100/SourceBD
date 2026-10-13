# Duplicate suppliers: the audit of 13 Oct 2026

Founder, 13 Oct 2026: audit the supplier table for duplicates, merge the ones that are certain
without asking, and put the doubtful ones on a page with buttons.

Written by `ops/report_duplicate_suppliers.py` (read-only). The merge is
`ops/plans/duplicate-suppliers-merge.sql`. The page is `ops/plans/duplicate-suppliers-review.html`;
its numbers are the `n` of each pair in `ops/plans/duplicate-suppliers.json`.

## 1. What was measured

Every row against every other row: 10,977 suppliers (10,186 published),
22,832 register entries. 7,994 pairs shared a name, a register entry, a phone, a mailbox,
a website or an address and were judged one by one.

| outcome | pairs |
| -- | -- |
| Certain: one company filed twice. Merged. | **70** |
| Looks like one company, not certain. On the founder's page (after the review: 117). | **123** |
| Similar names the registers list separately (sister concerns), or names alike by chance. Left. | 7,801 |

Re-run after the merge on a fresh pull (10,907 suppliers), with the rules tightened by the
review (a plural on the first word is another company; an identical mailbox at a free mail provider
counts): **4** more certain pairs, not merged, first on the founder's page.

## 2. What counts as certain

All four, or the pair goes to the page (the full wording is the script's docstring):

1. One company name: the same once Ltd, Co., Pvt., plurals and spacing are set aside; or one long word
   a letter or two apart; or a typo apart while holding the same membership entry.
2. Something that belongs to one company ties them: a phone, a mailbox, a website, a house-and-road,
   a register entry, or BGMEA's entry naming the EPB number the other row holds. Locality words alone
   count only when no third company has a similar name.
3. Nothing against: no trade body lists them as two members, the districts agree (or the addresses do),
   no person ruled them two companies, neither is a building of another row or claimed, and they are
   not a factory beside a real buying house.
4. No other row of the same name conflicts with either, and neither shares a membership entry with a
   third row.

Two things the audit had to learn first, both now in the script and its tests:

- BKMEA is filed under two number spaces (the membership number and the detail page's id). Read as one,
  2,400 unrelated pairs looked like "the same entry".
- `entity_type = buying_house` is the loader's default for any BGMEA row: 541 rows that hold only a
  general (manufacturer) membership carry it. A real buying house is a row holding the associate entry.
  (Re-measured after the merges, 13 Oct 2026: 519. Count, cause and repair: `ops/plans/bgmea-entity-type.md`.)

## 3. Applied on production, 13 Oct 2026

One block through the Supabase SQL endpoint, rehearsed first (the same block ending in a raise):

```
DRY RUN OK | pairs 70 | losing rows deleted 70 | rows moved 1813 | duplicate copies dropped 85 |
buildings re-linked 6 | kept rows published 68
```

The apply refused to commit unless its counts equalled the rehearsal's. Read after:

- suppliers 10,977 to 10,907; published 10,186 to 10,125 (9 of the 70 were not published);
  register entries 22,832 to 22,830 (two entries both rows held).
- Moved to the kept rows: 95 register entries, 811 claims about the company and 829 claim links,
  31 documents, 16 certificates, 8 safety records, 17 review-queue tickets, 6 buildings, 1 ruling.
- Dropped because the kept row already held the same thing: 70 internal scores, 8 claims, 4 certificates,
  2 register entries, 1 empty customs preview.
- The kept row took what it lacked: registry numbers, phones, products, the larger workforce, a
  district or address where it had none. It keeps its own name and web address.
- `buyer_supplier_profile` reads the kept rows (checked on four); the live page of a kept row answers 200.

### Undo

Everything is in three tables (RLS on, no grants to anon or authenticated):

- `_snapshot_dup_merge_20261013_pairs` (keep, lose)
- `_snapshot_dup_merge_20261013_suppliers`: both rows of every pair as they were (`role`, `merged_into`)
- `_snapshot_dup_merge_20261013_rows`: every row moved (`row_id`) and every row dropped (`old_row`)

To split one pair again: insert the `lose` row back from `_suppliers`; set the supplier column back on
the `moved` row ids of that pair; re-insert its `dropped` rows from `old_row`; copy the kept row's
columns back from its `keep` snapshot.

## 4. The 70 pairs merged

| # | kept | merged into it | what tied them, beside the name |
| -- | -- | -- | -- |
| 1 | Aboni Textiles Ltd.<br>`aboni-textiles` · Dhaka · EPB, OEKO_TEX | ABONI TEXTILE LTD.<br>`aboni-textile` · Dhaka · BKMEA | the same email domain (babylon-bd.com) |
| 2 | ALEMA TEXTILE LIMITED<br>`alema-textile` · Gazipur · BGAPMEA, BKMEA, EPB, OEKO_TEX | Alema Textiles Ltd<br>`alema-textiles` · Gazipur · BGMEA, RSC | the same email domain (mimgroupbd.com); both addresses mention sarak, vogra |
| 3 | AMAN FASHIONS & DESIGNS LTD<br>`aman-fashions-and-designs` · Dhaka · BGMEA, BKMEA, BRAND_HM, BRAND_NEXT, EPB, OEKO_TEX, RSC | Aman Fashion & Designs Ltd.<br>`aman-fashion-and-designs` · Dhaka · BRAND_HM · not on the site | both hold BRAND_HM entry e22c47e53a065b53; both addresses mention mirzanagar, nalam |
| 4 | AMIR SHIRTS LTD<br>`amir-shirts` · Cumilla · BGMEA, RSC, WRAP | Amir Shirt's Ltd.<br>`amir-shirt` · Cumilla · EPB, OEKO_TEX | the same email domain (aplusbd.com); BGMEA's entry for one names the EPB number the other holds |
| 5 | AMS International Sweaters Ltd.<br>`ams-international-sweater` · Gazipur · EPB, OEKO_TEX, RSC | AMS Int'l (Sweaters) Ltd.<br>`ams-international-l-sweater` · Gazipur · BGMEA | BGMEA's entry for one names the EPB number the other holds; both addresses mention board, choydana |
| 6 | Apex Spinning & Knitting Mills<br>`apex-spinning-and-knitting-mills` · Gazipur · BGMEA, BRAND_HM, BRAND_NEXT, EPB, WRAP | APEX SHINNING & KNITTING MILL LTD.<br>`apex-shinning-and-knitting-mill` · Gazipur · BKMEA, OEKO_TEX, RSC | the same website (apexknitting.com); both addresses mention chandora, puroshova |
| 7 | APPARELS 21 LTD.<br>`apparels-21` · Gazipur · BKMEA, GOTS, OEKO_TEX, RSC | Apparel-21 Ltd.<br>`apparel-21` · Gazipur · BGMEA, EPB | the same email domain (lithegroup.com); the same website (lithegroup.com); the same email address |
| 8 | APPOLLO FASHIONS LTD.<br>`appollo-fashions` · Dhaka · BGAPMEA, BKMEA, EPB, GOTS | Appolo Fashions Ltd.<br>`appolo-fashions` · Dhaka · BGMEA | BGMEA's entry for one names the EPB number the other holds |
| 9 | BA Fashiowear Limited<br>`ba-fashiowear` · Dhaka · EPB | B A Fashionwear Ltd.<br>`ba-fashionwear` · Dhaka · BGMEA | BGMEA's entry for one names the EPB number the other holds |
| 10 | Badgetex Apparels Ltd<br>`badgetex-apparels` · Chattogram · BGMEA, BRAND_NEXT, EPB, OEKO_TEX, RSC | BEDGETEX APPARELS LTD.<br>`bedgetex-apparels` · Chattogram · BKMEA | both addresses mention mohora, nexus |
| 11 | BG Collection Ltd.<br>`bg-collection` · Dhaka · BGMEA, EPB, GOTS, RSC | M/S BG Collection Ltd.<br>`ms-bg-collection` · Gazipur · OEKO_TEX | the same email domain (bgcollection.com.bd); both addresses mention baniarchala, bhabanipur |
| 12 | BORI GARMENT ACCESSORIES CO., LTD.<br>`bori-garment-accessories` · Dhaka · BGAPMEA, OEKO_TEX | Bori Garmaent Accessories Co.Ltd<br>`bori-garmaent-accessories` · Dhaka · no register entry · not on the site | the same phone number; the same email domain (boribd.com); the same email address; both addresses mention anwar, jung, savar |
| 13 | CHORKA TEXTILE LTD<br>`chorka` · Narsingdi · BGMEA, BKMEA, BRAND_HM, BRAND_NEXT, OEKO_TEX, RSC, WRAP | Chorka Textile Ltd.<br>`chorka-textile` · Narsingdi · EPB, OEKO_TEX | both hold OEKO_TEX entry oeko-tex-22745, oeko-tex-49737; the same phone number; the same email domain (hip.prangroup.com, prangrou0.com); the same website (chorkatextile.com); the same email address; both addresses mention danga, kazirchor, polash |
| 14 | CLIFTON FASHIONS LTD.<br>`clifton-fashions` · Chattogram · BKMEA | Clifton Fashion Ltd.<br>`clifton-fashion` · Chattogram · BGMEA | the same email domain (cliftongroupbd.com) |
| 15 | CLIFTON TEXTILES AND APPARELS LTD.<br>`clifton-textiles-and-apparels` · Chattogram · BGAPMEA, BKMEA, EPB, GOTS, OEKO_TEX, RSC, WRAP | Clifton Textile and Apparels Ltd.<br>`clifton-textile-and-apparels` · Chattogram · BGMEA | the same email domain (cliftongroupbd.com); BGMEA's entry for one names the EPB number the other holds; both addresses mention baizid, bostami, nasirabad |
| 16 | DIRD COMPOSITE TEXTILE LTD<br>`dird-composite-textile` · Gazipur · BKMEA | Dird Composite Textiles Ltd.<br>`dird-composite-textiles` · Gazipur · BGMEA | the same email domain (dirdgroup.org); both addresses mention dhaladia, shatiabari |
| 17 | Dreamwears Limited<br>`dreamwears` · Dhaka · BGMEA, EPB | Dream Wears Ltd.<br>`dream-wear` · Dhaka · RSC | the same phone number; the same email domain (dreamwearsltd.com); the same email address; both addresses mention mirpur, parbata, senpara |
| 18 | ETTADE JEANS LTD<br>`ettade-jeans` · Chattogram · EPB, GOTS, RSC, WRAP | Ettadee Jeans Ltd.<br>`ettadee-jeans` · Chattogram · BGMEA | the same email domain (jerkin-group.com); BGMEA's entry for one names the EPB number the other holds |
| 19 | EURO KNIT GARMENTS LTD<br>`euro-knit-garments` · Narayanganj · BKMEA | EURO KNIT CARMENTS LTD.<br>`euro-knit-carments` · Narayanganj · BKMEA | both hold BKMEA entry 481 |
| 20 | Executive Hi-Fashions LTD.<br>`executive-hi-fashions` · Gazipur · BGMEA, BRAND_HM, BRAND_MS, EPB, OEKO_TEX, RSC | Executive Hi Fashion Ltd<br>`executive-hi-fashion` · Gazipur · no register entry · not on the site | both addresses mention bhobanipur, shirirchala |
| 21 | Farzana Fashions World Ltd.<br>`farzana-fashions-world` · Chattogram · BGMEA, EPB, OEKO_TEX | FARZANA FASHION WORLD LTD<br>`farzana-fashion-world` · Chattogram · BKMEA | the same email domain (farzanagroup.com) |
| 22 | FRIENDS KNIT FASHIONS LTD<br>`friends-knit-fashions` · Narayanganj · BKMEA, EPB, OEKO_TEX | Friends Knit Fashion Ltd.<br>`friends-knit-fashion` · Narayanganj · no register entry · not on the site | the same phone number |
| 23 | FTN Industries Ltd.<br>`ftn-industries` · Dhaka · OEKO_TEX | FTN Insustries Ltd<br>`ftn-insustries` · Dhaka · BGAPMEA | both addresses mention rajabari, uttar |
| 24 | Gemini Fashions (Pvt.) Ltd.<br>`gemini-fashions` · Chattogram · BGMEA, RSC | GEMINI FASHION (PVT) LTD<br>`gemini-fashion` · Chattogram · BKMEA | the same email domain (farzanagroup.com); both addresses mention double, mooring, panjaton |
| 25 | Genesis Fashions Ltd.<br>`genesis-fashions` · Dhaka · EPB, GOTS, RSC | Genesis Fashion Ltd.<br>`genesis-fashion` · Gazipur · BGMEA | BGMEA's entry for one names the EPB number the other holds; both addresses mention kadda, nandun |
| 26 | GLITTER FASHION LTD.<br>`glitter` · Chattogram · BKMEA, BRAND_HM, OEKO_TEX | Glitter Fashion Ltd.<br>`glitter-fashion` · Chattogram · no register entry · not on the site | both addresses mention baized, bostami, gate, nashirabad |
| 27 | Globus Garments Ltd.<br>`globus-garments` · Gazipur · EPB, OEKO_TEX, RSC | Globus Garment Ltd.<br>`globus-garment` · Gazipur · BGMEA | the same email domain (dekkoisho.com); BGMEA's entry for one names the EPB number the other holds; both addresses mention kaliakair, mouchak |
| 28 | Goldstar Fashions Ltd.<br>`goldstar-fashions` · Gazipur · BGMEA, OEKO_TEX | Goldstar Fashion<br>`goldstar-fashion` · Gazipur · EPB, RSC | BGMEA's entry for one names the EPB number the other holds; both addresses mention bscic, estate, side |
| 29 | Goldstar Label and  Accessories Ltd<br>`goldstar-label-and-accessories` · Dhaka · OEKO_TEX | Gold Star Labels & Accessories Ltd<br>`gold-star-labels-and-accessories` · Dhaka · BGAPMEA | both addresses mention charabagh, madrasha, savar |
| 30 | H.B. Fashions Ltd.<br>`hb-fashions` · Chattogram · EPB, OEKO_TEX, RSC | H.B FASHION LTD<br>`hb-fashion` · Chattogram · BGMEA, BKMEA | the same email domain (hbgroupbd.com); the same email address; both addresses mention jhones, kattali |
| 31 | Honeywell Garments Limited<br>`honeywell-garments` · Gazipur · BGMEA, EPB, RSC | Honey Well Garments Ltd.<br>`honey-well-garments` · Gazipur · OEKO_TEX | the same email domain (ajintl.com) |
| 32 | HOPLUN APPARELS LTD<br>`hoplun-apparels` · Dhaka · BKMEA, BRAND_HM, RSC, WRAP | Hop Lun Apparel Limited<br>`hop-lun-apparel` · Gazipur · BGMEA, BRAND_NEXT, EPB | the same email domain (hoplun.com); both addresses mention gazipura, mymensingh |
| 33 | HORNBILL APPARELS LTD<br>`hornbill-apparels` · Gazipur · BGMEA, BKMEA, OEKO_TEX | Hornbill Apparel Ltd.<br>`hornbill-apparel` · Dhaka · EPB, GOTS | the same email domain (norbangroup.com); BGMEA's entry for one names the EPB number the other holds; both addresses mention baimail, cotton, konabari, mills |
| 34 | IFCO GARMENTS & TEXTILE LTD.<br>`ifco-garments-and-textile` · Chattogram · BKMEA | IFCO Garments & Textiles Ltd.<br>`ifco-garments-and-textiles` · Chattogram · BGMEA | both addresses mention bscic, kalurghat |
| 35 | KAROONI FASHIONS LTD.<br>`karooni-fashions` · Gazipur · BKMEA, EPB, OEKO_TEX, RSC | Karooni Fashion Ltd<br>`karooni-fashion` · Gazipur · BGMEA | the same email domain (karooni.com); both addresses mention kaliakair, ratanpur |
| 36 | Kazipur Fashions  Limited<br>`kazipur-fashions` · Dhaka · BGMEA, BRAND_MS, EPB | Kazipur Fashion Ltd<br>`kazipur-fashion` · Dhaka · no register entry · not on the site | both addresses mention dairy, farm |
| 37 | KEI LOCK NEWAGE BANGLADESH LTD<br>`kei-lock-newage-bangladesh` · Dhaka · BGMEA, BRAND_HM, EPB | Kei Lock Newage (BD) Ltd.<br>`kei-lock-newage-bd` · Dhaka · OEKO_TEX, RSC | the same phone number; the same email domain (knbl.com); the same email address; both addresses mention nichantapur, savar |
| 38 | Link-Tex Sportswear Ltd.<br>`link-tex-sportswear` · Gazipur · BGMEA, EPB, OEKO_TEX | Linktex Sportswear Ltd.<br>`linktex-sportswear` · Gazipur · OEKO_TEX | the same email domain (linktexsportswear.com); both addresses mention kaliakair, nishchintopur |
| 39 | M/S Green House Accessories Ltd<br>`ms-green-house-accessories` · Dhaka · OEKO_TEX | GREENHOUSE ACCESSORIES LTD.<br>`greenhouse-accessories` · Dhaka · OEKO_TEX | the same house and road |
| 40 | M/S Green House Accessories Ltd<br>`ms-green-house-accessories` · Dhaka · OEKO_TEX | Green House Accessories Ltd<br>`green-house-accessories` · Dhaka · BGAPMEA | both addresses mention nishatnagar, rajabari |
| 41 | Mastercham ltd.<br>`mastercham` · Gazipur · EPB | Master Cham Ltd.<br>`master-cham` · Gazipur · BGMEA | both addresses mention moslem, nowjur |
| 42 | MASTRADE INTERNATIONAL GARMENTS LTD.<br>`mastrade-international-garments` · Gazipur · BKMEA, BRAND_NEXT, EPB, OEKO_TEX, RSC, WRAP | Mas Trade Int'l. Garments Ltd.<br>`mas-trade-international-l-garments` · Gazipur · BGMEA | BGMEA's entry for one names the EPB number the other holds |
| 43 | MG Shirtex Ltd<br>`mg-shirtex` · Gazipur · BRAND_HM, EPB, OEKO_TEX, RSC | MG Shirttex Ltd.<br>`mg-shirttex` · Gazipur · BGMEA | the same email domain (mohammadigroup.com); BGMEA's entry for one names the EPB number the other holds; both addresses mention chandana, laxmipura |
| 44 | MIDLINE SWEATER LTD.<br>`midline-sweater` · Gazipur · EPB, OEKO_TEX, RSC | Mid Line Sweater Ltd.<br>`mid-line-sweater` · Gazipur · BGMEA | the same email domain (midlinegroup.com); the same website (midlinegroup.com) |
| 45 | Modern Poly Industries Limited.<br>`modern-poly-industries` · Chattogram · BTMA, EPB | M/S. Modern Poly Industries Limited<br>`ms-modern-poly-industries` · Chattogram · OEKO_TEX | the same email domain (bsmgroupbd.com); the same email address |
| 46 | Mohsin Knitwears Ltd.<br>`mohsin-knitwear` · Narayanganj · EPB, OEKO_TEX | M/S MOHSIN KNITWEARS LTD<br>`ms-mohsin-knitwear` · Narayanganj · BKMEA | the same email domain (mohsinknitwears.com); the same email address; both addresses mention bscic, fatullah |
| 47 | Multi Style Accessories<br>`multi-style-accessories` · Chattogram · BGAPMEA | M/S. Multi Style & Accessories<br>`ms-multi-style-and-accessories` · Chattogram · OEKO_TEX | the same phone number |
| 48 | N. F. Z. TERI TEXTILE LTD<br>`nfz-teri-textile` · Chattogram · BKMEA, EPB, OEKO_TEX | N.F.Z Teri Textiles Ltd.<br>`nfz-teri-textiles` · Chattogram · BGMEA | the same email domain (haldabd.com); the same email address; both addresses mention boalkhali, gomdandy |
| 49 | NORTHERN CORPORATION LTD.<br>`northern` · Gazipur · BGMEA, BKMEA, BRAND_NEXT, EPB, GOTS, OEKO_TEX | M/S Northern Corporation Ltd.<br>`ms-northern` · Gazipur · OEKO_TEX | both hold OEKO_TEX entry oeko-tex-69705; the same email domain (ntg.com.bd); the same email address; both addresses mention sreepur, tepirbari |
| 50 | Oishi Fashion (Pvt) Ltd<br>`oishi-fashion` · Gazipur · EPB, OEKO_TEX | Oishi Fashions (Pvt) Ltd.<br>`oishi-fashions` · Gazipur · BGMEA | BGMEA's entry for one names the EPB number the other holds |
| 51 | Paramount Textile PLC<br>`paramount-textile-plc` · Gazipur · BRAND_HM, OEKO_TEX | Paramount Textile<br>`paramount-textile` · Gazipur · no register entry · not on the site | both addresses mention chala, gilar, sripur |
| 52 | POLESTAR KNIT COMPOSITE LTD.<br>`polestar-knit-composite` · Gazipur · BKMEA, EPB, GOTS | Pole Star Knit Composite Ltd<br>`pole-star-knit-composite` · Gazipur · OEKO_TEX, RSC | the same phone number; the same email domain (polestargroupbd.net); the same email address; both addresses mention city, corporation, naibari, pubail |
| 53 | Polo Composite Knit Ind. LTD.<br>`polo-composite-knit-industries` · Dhaka · BGMEA, EPB, GOTS, OEKO_TEX, RSC, WRAP | POLO COMPOSITIE KNIT INDUSTRY LTD.<br>`polo-compositie-knit-industries` · Dhaka · BKMEA | the same phone number; the same email domain (aji-group.com); both addresses mention hemayetpur, savar, singair |
| 54 | Polybag Manufacturing Company Limited<br>`polybag-manufacturing` · Gazipur · OEKO_TEX | Poly Bag Manufacturing Co. Ltd<br>`poly-bag-manufacturing` · Gazipur · BGAPMEA | both addresses mention bashan, naojury |
| 55 | Radisson Garments Limited<br>`radisson-garments` · Dhaka · EPB, GOTS, OEKO_TEX, RSC | Radission Garments Ltd.<br>`radission-garments` · Gazipur · BGMEA | the same email domain (radissonal.com); both addresses mention bscic, tongi |
| 56 | Ramisa's Fashions Ltd.<br>`ramisa-fashions` · Chattogram · BGMEA | Ramisa's Fashion Ltd.<br>`ramisa-fashion` · Chattogram · EPB | BGMEA's entry for one names the EPB number the other holds; both addresses mention baizid, bostami |
| 57 | S.Six Fashions Pvt Ltd<br>`s-six-fashions` · Narayanganj · BGMEA, OEKO_TEX, RSC | S-SIX FASHION(PVT) LTD.<br>`s-six-fashion` · Narayanganj · EPB | BGMEA's entry for one names the EPB number the other holds; both addresses mention maleh, river, tanbazar, view |
| 58 | S2L FASHIONS (PVT) LTD<br>`s2l-fashions` · Gazipur · EPB, GOTS, WRAP | S2L Fshions (Pvt.) Ltd.<br>`s2l-fshions` · Gazipur · BGMEA | the same email domain (s2lfashion.com); both addresses mention bari, maleker, sharifpur |
| 59 | Shah Sharifs (R.) Accessories<br>`shah-sharifs-r-accessories` · Dhaka · BGAPMEA, OEKO_TEX | Shah Sharif's (R.) Accessories<br>`shah-sharif-r-accessories` · Dhaka · no register entry · not on the site | the same phone number; the same email domain (shahsharif.com); the same email address; both addresses mention medical, uttarkhan |
| 60 | SHEPHERD INDUSTRIES PLC<br>`shepherd-industries-plc` · Mymensingh · BRAND_HM, GOTS | Shepherd Industries Ltd.<br>`shepherd-industries` · Mymensingh · no register entry · not on the site | both addresses mention bhaluka, kathali |
| 61 | Sonnet Fashions Ltd<br>`sonnet-fashions` · Chattogram · BGMEA, EPB, GOTS, OEKO_TEX, RSC | SONNET FASHION LTD.<br>`sonnet-fashion` · Chattogram · BKMEA | the same email domain (sonnettex.com); both addresses mention chandgaon, noxious, signal |
| 62 | Southeast Sweaters Ltd.<br>`southeast-sweater` · Dhaka · BGMEA, BRAND_NEXT, EPB, GOTS | South East Sweaters Ltd.<br>`south-east-sweater` · Dhaka · OEKO_TEX | the same phone number |
| 63 | Sterling Denim Ltd.<br>`sterling-denim` · Dhaka · BRAND_HM, GOTS, OEKO_TEX, RSC | Sterling Denims Ltd.<br>`sterling-denims` · Dhaka · BGMEA, EPB, WRAP | the same email domain (sterlinggroup.com.bd); both addresses mention dhania, nayarhat, savar |
| 64 | Stoffa Tex Fashions Ltd.<br>`stoffa-tex-fashions` · Gazipur · BGMEA, EPB | STOFFATEX FASHION LTD<br>`stoffatex-fashion` · Gazipur · BKMEA | the same email domain (stoffatexfashion.com) |
| 65 | That's It Fashions Ltd.<br>`that-it-fashions` · Dhaka · EPB, GOTS, WRAP | That's It Fashion Ltd<br>`that-it-fashion` · Dhaka · BGMEA (associate), BRAND_HM, RSC | both addresses mention board, joydebpur, vogra |
| 66 | That's It Fashions Ltd.<br>`that-it-fashions` · Dhaka · EPB, GOTS, WRAP | Thats It Fashions Ltd.<br>`thats-it-fashions` · Gazipur · BGMEA, OEKO_TEX | BGMEA's entry for one names the EPB number the other holds; both addresses mention board, vogra |
| 67 | Tosrifa Industries Ltd.<br>`tosrifa-industries` · Gazipur · BRAND_NEXT, EPB, OEKO_TEX, RSC, WRAP | Tosrifa Indutries Ltd.<br>`tosrifa-indutries` · Gazipur · BGMEA | the same email domain (ntg.com.bd) |
| 68 | VARONICA APPARELS<br>`varonica-apparels` · Dhaka · BKMEA | Veronica Apparels<br>`veronica-apparels` · Dhaka · BGMEA | the same phone number; both addresses mention chairman, khan, uttara |
| 69 | Yongtai Indus. Bangladesh Limited<br>`yongtai-industries-bangladesh` · Cumilla · EPB, OEKO_TEX, RSC | Yongtai Indus. (BD) Ltd.<br>`yongtai-industries-bd` · Cumilla · BGMEA | the same phone number; the same email domain (yongai.net); the same email address |
| 70 | Zeysha Fashionwear Ltd.<br>`zeysha-fashionwear` · Dhaka · BGMEA, EPB | Zeysha Fashion Wear Ltd<br>`zeysha-fashion-wear` · Dhaka · OEKO_TEX, RSC | the same email domain (zeyshagroup.com); both addresses mention hemayetpur, shampur |

## 5. Waiting for the founder: 117 pairs

`ops/plans/duplicate-suppliers-review.html`. Merge, Attach or Leave per pair; each carries a suggestion.

| section | pairs | suggested |
| -- | -- | -- |
| Same name, nothing else to go on | 51 | 51 merge |
| Names a letter or two apart | 9 | 9 merge |
| Ruled two companies before | 1 | 1 merge |
| One membership number on two profiles | 9 | 3 merge, 6 separate |
| One name sits inside the other | 8 | 5 link, 3 merge |
| Same name, different districts | 18 | 4 merge, 14 separate |
| A factory and a buying house under one name | 11 | 11 separate |
| Same name, but a register lists two members | 10 | 10 separate |

Nothing in this list has been changed.

## 5a. The founder's decisions, applied 13 Oct 2026

He answered all 121 rows the same day: **merge 97, attach 8, leave 16**
(`duplicate-suppliers-decisions-2026-10-13.json`, row number to pair). He chose merge on 22 rows where
the suggestion was leave, among them pairs a trade body lists as two members and five where one side
is a buying house.

- **96 merged** (`_snapshot_dup_merge_20261013b_pairs/_suppliers/_rows`), the same block as section 3,
  rehearsed first with identical counts: 2,181 rows moved, 124 duplicate copies dropped, 4 buildings
  re-linked, 94 kept rows still published. Four rows form one company by his answers (Crony Apparels,
  Crony Fashion, Crony Fashions, Corny Fashion); Crony Apparels is kept. His decision replaced the
  July ruling "two companies" on that group, so for this run the block deleted that ruling instead of
  refusing. `Dinatex International Ltd.` (a buying-house member) absorbed its factory row and is now
  typed factory.
- **8 attached** as a building of the first company (`_snapshot_dup_attach_20261013`); each old address
  redirects to its company. Row 80 was attached the other way round from how the page showed it: the
  "Unit - 2" profile became the building of `Maheen Dizayn Etiket (BD) Limited`, not the reverse.
- **Row 95** (Labib Fashion / Labib Fashions Ltd.): answered merge with the note "sister concern of
  Labib Group". Asked which he meant; he said attach. `Labib Fashions Ltd.` is now a building of
  `LABIB FASHION` (ninth row of `_snapshot_dup_attach_20261013`); its old address redirects.
- **16 left** as two companies. On his word the same day, the 15 pairs that still exist were written
  to `resolution_edges` as `different` (`decided_by = founder:duplicate-review-2026-10-13`, the row
  number in the rationale). The sixteenth, row 108, no longer exists as a pair: one side was merged by
  row 100, and row 109 covers what is left. Re-run on a fresh pull after that: 0 certain, 0 to ask.
  Five of the 15 share one BKMEA membership entry between two differently named companies; ruling
  them two companies does not say whose entry it is.

Read after: 10,811 suppliers, 10,025 published, 744 linked buildings.

## 6. Found on the way, not fixed here

- **152 old web addresses now answer 404** (61 from the first merge, 91 from the second). A merged
  profile's address is gone, as with every earlier merge. The two `_suppliers` snapshot tables hold
  what a redirect would need (`slug`, `merged_into`). **Fixed 13 Oct 2026:** migration `0149` is
  applied and each old address redirects to its kept profile (`ops/plans/0149-dry-run.md`).
- **541 general manufacturers are typed "buying house"** (the loader's default for BGMEA). Twelve rows on
  the page are a factory beside a real buying house of the same name; the 541 are a separate fix.
- **Nine BKMEA membership numbers sit on two profiles each** (section "One membership number on two
  profiles"). Where the names differ, one profile is holding the other's entry. **Fixed 13 Oct 2026**
  for the five pairs left after the merges, each checked against the live BKMEA list and pages
  (`ops/plans/bkmea-shared-membership-fix.sql`, snapshot `_snapshot_bkmea_shared_20261013`, 90 rows):
  - 2178, 2129 and 338 belong to Dams Knit, Euphoria Apparels and Fatullah Fashion. A stray copy of
    each list row sat on AMS Knit Fashion, Euphoria Textile and Fatullah Apparels; the three copies
    were removed. Nothing a buyer saw was wrong on those six, only an extra entry.
  - 511 is Shatabdi Apparels (page 2293). `knit-fashion` showed 511 and now shows its own 675;
    `shatabdi-apparels` showed "511 - B/2009" and now shows "511 - B/2000" with its page.
  - 984 is H.R.S Composite Tex Wear (page 977). It showed Polestar's "402 - /2008" and 150 machines
    from Polestar's old page; it now shows 984 and its own 110.
  - Cause, fixed in `etl/scrapers/bkmea_web.py` with tests: a list row whose number did not read was
    keyed on its bare page id, which is also somebody's membership number. Two rows of the live list
    do this ("KNIT", no number, page 511; Polestar's old "402 - /2008", page 984).
  - Still open: the row "KNIT" (no membership number, another address and owner) stays on
    `knit-fashion`, whose workers (230), capacity and machines (90) come from that row, not from
    Knit Fashion's own entry. Whether "KNIT" is Knit Fashion or a third company is the founder's call.
  - Seen while checking, not touched: 35 BKMEA detail pages sit under a company whose name the page
    does not carry. About half are spellings of the same company; the rest look like another
    company's page (F.M Knitwear under `fm-apparels`, Orion Fashions under `ripon-fashions`, Fame
    Textile under `fame-apparels`, Asia Composite Mills under `aswad-composite-mills`).
- **Internal scores of the 68 kept rows were not recomputed.** Admin-only; the next scoring run does it.
- **The address matcher misses plain respellings** ("Khajur Bagan" / "Khejur Bagar"), so some pairs on
  the page say "the name only" while the two addresses printed beside them plainly agree.
