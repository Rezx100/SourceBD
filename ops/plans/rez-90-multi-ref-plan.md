# REZ-90 multi-member-ref plan (revises the rejected REZ-88 plan)

Detection-only. **No splits, merges, or unpublishing.**

## Reproduction

- BGMEA-sourced suppliers with >1 distinct active member `source_ref`: **199** (expected 199)
- Excess refs: **230** (expected 230)
- Signal class: `multi_member_ref` (structural; no name comparison) — detector unchanged from REZ-88

## Name recovery

- General member pages re-fetched this run: **0** / 138
- Names reused from the REZ-88 fetch: **426** refs across the 199 hosts (keepers + the 230 excess), byte-identical to the rejected plan on all 230 excess rows
- Associate PDF names available: **1678**
- Historical `scraped_company_name` was **not** backfilled

## Classification counts (excess refs)

| class | count | REZ-88 (rejected) |
| -- | -- | -- |
| split | 154 | 164 |
| attach-as-facility | 11 | 3 |
| attach-host-as-facility | 2 | — (class did not exist) |
| merge | 54 | 60 |
| review | 6 | — (class did not exist) |
| unresolved | 3 | 3 |
| **total** | **230** | **230** |

## How many published suppliers the split class creates

- Splits: **154**
- Of those, the company **already has a supplier row** and the record should be re-pointed rather than a new profile minted: **12**
- Genuinely new published rows: **142**

## Validation against REZ-98's 61 stripped suppliers

- Published suppliers whose every BGMEA number lacks a live record: **61** (REZ-98 measured 61)
- Of those, also one of the 199 multi-ref hosts: **0** — necessarily zero; a row holding two records cannot hold none
- Stranded numbers on those suppliers whose live record sits on one of the 199: **2**

The two populations barely intersect, so this plan does not repair the
61 — that stays REZ-99. What the overlap does give is independently
adjudicated rows: REZ-98 established where each of those records really
lives, and this plan agrees with it on every one.

- `iqbal-knitwear` published reg 330; the record sits on `ra-apparels`, classified **split**
- `speedwell-apparels` published reg 620; the record sits on `ritzy-apparels`, classified **merge**

## REZ-98 cross-check — excess regs still published by another supplier

- Excess refs whose registration number is also carried by another supplier's `bgmea_reg_numbers`: **76**
- These are REZ-98 residue, **not** split targets. The live record is
  on the host, so the other supplier is a former false attach that the
  conflation repair moved the record away from and never cleaned up.
  Re-pointing a split at one of them would repeat the original mistake.

| host slug | excess ref | excess name | reg also published by |
| -- | -- | -- | -- |
| a-and-c-bd | `901` | C & A Sourcing International Ltd. | florescent-apparels |
| abl | `1722` | — | shanghai-apparel, beijing-sports-wear |
| abl | `395` | ABL | clifton-garments |
| ams-fahion-house | `369` | Best Buy International Knit Wears | nzn-garments, jeans-2000 |
| anam-garments | `909` | Texture BD | aim-knitwear |
| apt-international | `598` | APT International | novel-garments-industries |
| artistic-apparels | `644` | Aartistic International | seema-garments, mm-brothers-wear |
| abid-export | `1545` | Off Price Clothing | kb-apparels |
| abid-export | `1546` | Trade Evidence | s-and-s-swimwear, tradescan-ltd-garments-div |
| abloom | `754` | Park Mode Wear Ltd. | pro-star-industrial |
| alex-bangladesh | `1018` | Alex Fashion | shirt-makers |
| ananta-apparels | `general:1181` | Ananta Apparels Ltd. | tasmia-international |
| apparel-trade-international | `207` | Triangle Venture Ltd. | hexa-garments, alif-textiles |
| atima-fashions | `679` | Atima Knitwear Ltd. | shah-makhdum-garments |
| attire-international | `1238` | Attire BD | mas-trade-international-l-garments |
| awss-fashions | `42` | Awss (BD) Limited | areana-garments |
| bd-tex | `664` | BD-Tex Sourcing | ak-khan-and-co-ltd-garments-div |
| blue-avenue-clothing | `458` | Feed Back Clothing Co. | crescent-trade-international |
| blue-bird-fashion | `781` | Zaima Fashion | youngone-cepz |
| bright-tex-trading | `1359` | Texsport Trading Corporation | unitrade-fashions |
| classic-fashion | `1256` | Classic Fashion Sourcing | chaity-garments, ashique-dress-design |
| caretex-sourcing | `1404` | Tex Care | aba-fashions, aba-garments |
| channel-expor-tex-international | `338` | Channel Expor-tex International Ltd. | nur-enterprise |
| classic-fashion-concept | `509` | Classic Fashion Concept | saint-garments, eian-apparels |
| dk-knitwear | `35` | DK Textile Ltd. | stylecraft |
| danny-dhaka | `54` | Danny Dhaka Ltd. | moazzem-garment-industries |
| dinatex-international | `60` | Landmark Designs Ltd. | abc-garments |
| dressen | `general:117` | Dressmen Ltd. | sunwah-textile-international |
| dynamic-export-zone | `1339` | Dynamic Export Zone | ably-garments, sea-blue-textile |
| dynamic-sourcing | `834` | Dynamic International Sourcing Ltd. | ornate-knit-garment-industries |
| eurotex-fashion | `1451` | Europtex Fashion Limited | newage-fashionwear |
| eastern-garments | `general:1142` | Eastern Garments Ltd. | touch-world-fashion |
| elham-international | `853` | Elham International Ltd. | syeed-trading |
| etam-international-l-sourcing-shanghai | `1591` | Fashion Theory Ltd. | sikder-apparels-hosiery |
| explore-fashion | `1668` | Xplore Sourcing | saad-sewing, milaco-textile-mills |
| fariha-fashion | `1362` | T.S.A. Bangladesh | kaw-garments-industries |
| fashion-makers | `61` | Fashion Makers Inc. | absolute-qualitywear, mbm-garments |
| fashion-tex | `254` | Fashion Tex | lovecraft-garments |
| fashion-tex | `699` | Fashion Tex International | wisdom-attires |
| fashion-exclusive | `596` | Fashion Exclusive Ltd. | babylon-garments |
| fashion-plus | `1436` | Fashion Plus International Ltd. | megastar-apparels |
| fashion-plus | `351` | Fashion Plus | kass-garments |
| fashion-zone-international | `935` | Knit Wear Creator Ltd. | baizid-fashion-wear, men-apparels |
| fashion-zone-international | `general:1341` | Fashion Zone Ltd. | royal-askot-ventures |
| golden-tex | `1342` | Golden Touch | taurus-styles |
| grassy | `141` | Mum Fashion Merchandising Ltd. | pearl-garments |
| hmn-fashion | `507` | Jenable Textile Ltd. | choice-garments, mission-apparel-industries |
| intercare | `882` | Intercare Fashion | epcot-international, epcot-apparels |
| jm-knitwear | `422` | Reglisse | miswar-hosiery-mills |
| jdk-fashion | `1101` | JDK Sourcing Ltd. | texport |
| jns-knitwear | `890` | JNS Knitwear Ltd. | alliance-garments |
| kl-fashion | `119` | K.L. International Ltd. | misami-garments, baridhi-garments |
| khan-sourcing-bd | `955` | Khan Sourcing | mark-fashion-wear-pvt-ltd-u-2 |
| knit-collection | `1137` | Knit Collection | zenith-fashions, bakul-apparels |
| m-and-z | `1677` | M & Z Sourcing BD | ital-adweg |
| mark-fashion-wear-pvt-ltd-u-2 | `general:374` | Mark Fashion Wear (Pvt). Ltd. | brothers-impex |
| mass-fashion-bd | `general:740` | Mass Fashion Ltd. | fm-fashion |
| mega-merchandising | `1082` | Winsome Sourcing | lucky-star-apparels |
| merchantex-co-bd | `1370` | Merchantex International | mika-fashion |
| mirza-fashion-and-design | `331` | Union Fashion | vanguard-garments |
| mustex-sourcing | `1382` | Textiss Bangladesh | ever-fashion |
| needle-thread | `1463` | WIKITEX - BD | bonny-apparels |
| next-apparels | `1115` | Next Sourcing Ltd. | alpha-knitting-wear |
| naba-apparel | `general:1623` | Naba Apparels Ltd. | marzan-fashion |
| pavel-fashion | `1266` | Pavel Sourcing (BD) Ltd. | maggie-and-liz |
| postex | `377` | RMT Corporation Ltd. | maxim, maxbrite |
| protex-international | `242` | Protex Enterprise Co. Ltd. | giant-knit-fashions, mavis-garments |
| ra-apparels | `1114` | A.R. Apparel Sourcing | elahi-garments |
| ra-apparels | `330` | A.R. Fashion | iqbal-knitwear, iqbal-enterprises |
| ritzy-apparels | `620` | Ritzy Apparels | speedwell, speedwell-apparels |
| saf-apparel-bd | `939` | SAF International | kanak-impex, kanak-hosiery |
| sagacious-fashions | `1146` | Sagacious Fashions Limited | hi-tech-fashions |
| sarah-knitwear | `999` | Sarah Knit Wear | panorama-apparels |
| texel | `1029` | Texel Limited . | jamuna-apparels |
| z7-apparels | `1561` | ZXY International DMCC | the-civil-engineers, tip-top-fashions |
| z7-apparels | `17` | ZXY Apparel Buying Solutions Ltd. | concorde-garments |

## Merge-rule self-check against the rejected plan's 60 merges

| band | count | expected |
| -- | -- | -- |
| root tokens identical (safe) | 50 | 50 |
| pluralisation / initials only (safe) | 4 | 4 |
| root token differs (review) | 6 | 6 |

## Rules

- **Keeper** = the ref whose recovered name IS the host's stored
  `company_name` (root tokens, then pluralisation, then
  `_names_compatible`); `general:` breaks ties. A host where no ref
  matches its own name is reported below, not silently resolved.
- **`merge`** requires the excess and keeper root tokens to be identical
  after stripping legal form, incorporation and country words,
  punctuation and repeated spaces — pluralisation and initial spacing
  aside. Similarity score is not consulted at all.
- **`review`** = a name-compatible pair whose root tokens differ. Never
  auto-merged: `Azim` / `Aziz` and `Eastern` / `Western` live here.
- **`attach-as-facility`** = the excess ref is a building of this
  company, per `extension_base_name` (REZ-87, the single definition).
- **`attach-host-as-facility`** = the HOST row is the building and the
  excess ref is the parent: the parent splits out and the host becomes
  its `facility_of` child.
- **`split`** = distinct legal entity. `split target` names the existing
  supplier to re-point to, or `new` when a profile must be created.
- **`unresolved`** = no live name recovered for the excess ref.

## Keeper changed from the rejected plan (7)

| host slug | host `company_name` | was | now |
| -- | -- | -- | -- |
| classic-fashion | CLASSIC FASHION | `68` Classic International (Pvt.) Ltd. | `55` Classic Fashion International Ltd. |
| dressen | Dressen Corporation | `general:117` Dressmen Ltd. | `131` Dressen Corporation |
| eurotex-fashion | EUROTEX FASHION LTD. | `1451` Europtex Fashion Limited | `1392` Eurotex Fashion |
| far-east-textile-and-clothing | Far East Textile & Clothing Ltd. | `605` Far East Textiles & Clothing | `39` Far East Textile & Clothing Ltd. |
| naba-apparel | Naba Apparel Inc. | `general:1623` Naba Apparels Ltd. | `951` Naba Apparel Inc. |
| tex-mart | TEX MART LTD. | `645` Tex Mart Apparels | `1581` Tex-Mart International |
| western-dresses | Western Dresses Ltd | `general:2001` Eastern Dresses Ltd. | `general:1179` Western Dresses Ltd. |

## Hosts where NO ref matches the supplier's own name (9)

Every registration on these rows names a different company than the row
does. Separate corruption — reported, not resolved here.

| host slug | host `company_name` | refs |
| -- | -- | -- |
| as-knitwear | A.S KNITWEAR | `528` S.A. Fashion · `953` A. S. Fashion |
| ags-apparels | Ags Apparels Ltd | `1204` AGS Fashion Ltd. · `930` Saint Martin Apparels |
| dk-knitwear | DK KNIT WEAR LTD | `1314` L. A. T Sportwear Ltd. · `35` DK Textile Ltd. · `478` DK Collection · `778` DK Design Ltd. |
| fariha-fashion | FARIHA FASHION LTD. | `1362` T.S.A. Bangladesh · `1669` Flaxen Fashionwears Limited |
| global-knitwear | Global Knitwear Ltd. | `543` Global Fashion · `914` Global Textile Sourcing Limited · `946` Global Apparel Sourcing Ltd. |
| jm-knitwear | J. M. KNITWEAR LTD. | `422` Reglisse · `423` J.M. Export Ltd. |
| next-apparels | NEXT APPARELS | `1115` Next Sourcing Ltd. · `1523` Next Sourcing Services Limited |
| pavel-fashion | PAVEL FASHION LTD. | `1266` Pavel Sourcing (BD) Ltd. · `1273` Pavel Style (BD) Ltd. |
| ra-apparels | R. A. APPARELS LTD | `1114` A.R. Apparel Sourcing · `330` A.R. Fashion · `601` R.A. Trading Limited |

## Per-ref plan

| host slug | keeper ref | keeper name | excess ref | excess name | action | split target |
| -- | -- | -- | -- | -- | -- | -- |
| 4a-yarn-dyeing | `general:4121` | 4A Yarn Dyeing Ltd. | `general:3778` | South End Sweater Co. Ltd. | split | south-end-sweater |
| a-and-c-bd | `109` | A & C (BD) Ltd. | `901` | C & A Sourcing International Ltd. | split | new |
| am-fashion | `general:6146` | A.M. Fashion | `231` | A.M. Fashion International Ltd. | split | new |
| a-plus-industries | `general:4221` | A Plus Industries Ltd. | `544` | A Plus Industries. | merge | — |
| as-knitwear | `953` | A. S. Fashion | `528` | S.A. Fashion | split | new |
| abc-international | `632` | ABC International | `1697` | — | unresolved | — |
| abl | `879` | ABL | `1722` | — | unresolved | — |
| abl | `879` | ABL | `395` | ABL | merge | — |
| ams-fahion-house | `482` | AMS Fahion House | `369` | Best Buy International Knit Wears | split | new |
| anam-garments | `general:1073` | Anam Garments Ltd. | `909` | Texture BD | split | new |
| apt-international | `general:4390` | Apt International Ltd. | `598` | APT International | merge | — |
| artistic-apparels | `general:3447` | Artistic Apparels Ltd. | `644` | Aartistic International | split | new |
| asrotex | `general:5403` | Asrotex Ltd. | `general:2751` | Asrotex | merge | — |
| attraction-garments | `general:4997` | Attraction Garments Ltd. | `637` | Tejgaon Eminent Fashion Ltd. | split | new |
| abdullah-fashions | `general:6594` | Abdullah Fashions | `general:6400` | Abdullah Fashions Ltd. | merge | — |
| abid-export | `747` | Abid Export Ltd. | `1545` | Off Price Clothing | split | off-price-clothing |
| abid-export | `747` | Abid Export Ltd. | `1546` | Trade Evidence | split | new |
| abloom | `719` | Abloom Limited | `754` | Park Mode Wear Ltd. | split | new |
| aesthetic-apparel | `1024` | Aesthetic Apparel | `1659` | Suxes Attires Ltd. | split | new |
| ags-apparels | `930` | Saint Martin Apparels | `1204` | AGS Fashion Ltd. | split | new |
| alex-bangladesh | `1594` | Alex Bangladesh | `1018` | Alex Fashion | split | new |
| alpha-product-development-company-bd | `general:7112` | Alpha Product Development Company (BD) Ltd. | `general:6746` | Gaya Product Development Company (BD) Ltd. | review | — |
| ananta-apparels | `general:6257` | Ananta Apparels Ltd. | `general:1181` | Ananta Apparels Ltd. | merge | — |
| ananta-apparels | `general:6257` | Ananta Apparels Ltd. | `general:4564` | Ananta Apparels Ltd. | merge | — |
| anzir-apparels | `general:3231` | Anzir Apparels Ltd. | `general:3843` | Anzir Apparels Ltd. (U-2) | attach-as-facility | — |
| apparel-gallery | `general:4577` | Apparel Gallery Ltd. | `1036` | Apparel Gallery | merge | — |
| apparel-trade-international | `591` | Apparel Trade International | `207` | Triangle Venture Ltd. | split | new |
| aries | `290` | Aries Corporation | `89` | Exo Bangladesh | split | new |
| atima-fashions | `174` | Atima Fashions Ltd. | `679` | Atima Knitwear Ltd. | split | new |
| attire-international | `252` | Attire International | `1238` | Attire BD | split | new |
| awss-fashions | `193` | Awss Fashions Ltd. | `42` | Awss (BD) Limited | split | new |
| axon-fashion-international | `927` | Axon Fashion International | `general:6881` | Axon Fashion Limited | split | new |
| ayesha-fashion | `general:4193` | Ayesha Fashion Ltd. | `1640` | Ayesha Trading | split | new |
| azim-garments | `general:634` | Azim Garments Ltd. | `general:2791` | Aziz Garments Ltd. | review | — |
| b-brothers-garments | `general:1737` | B. Brothers Garments Co. Ltd. | `general:3647` | B. Brothers Garments Co. Ltd.(U-2) | attach-as-facility | — |
| bd-tex | `1022` | BD TEX | `1440` | BD-Tex Apparels Ltd. | split | tex-apparels |
| bd-tex | `1022` | BD TEX | `664` | BD-Tex Sourcing | split | new |
| bangladesh-dresses | `general:1355` | Bangladesh Dresses Limited | `general:2431` | Bangladesh Dresses Ltd.(Unit-2) | attach-as-facility | — |
| basic-apparels | `general:721` | Basic Apparels Ltd. | `88` | Basic Fashion | split | new |
| blue-avenue-clothing | `638` | Blue Avenue Clothing Ltd. | `196` | RS Collection | split | new |
| blue-avenue-clothing | `638` | Blue Avenue Clothing Ltd. | `458` | Feed Back Clothing Co. | split | new |
| blue-bird-fashion | `453` | Blue Bird Fashion | `600` | Blue Bird Attire Ltd. | split | new |
| blue-bird-fashion | `453` | Blue Bird Fashion | `781` | Zaima Fashion | split | new |
| bodystretch-bangladesh | `948` | Bodystretch Bangladesh Ltd. | `929` | Trybe Bangladesh Limited | split | new |
| bonny-apparels | `general:1463` | Bonny Apparels (Pvt) Ltd. | `general:3051` | Bonny Apparels (Pvt) Ltd.(U-2) | attach-as-facility | — |
| boston-sportswear-manufacturing | `486` | Boston Sportswear Mfg. Ltd. | `157` | Boston Sportswear MFG. | merge | — |
| bright-tex-trading | `1433` | Bright Tex Trading Corporation | `1359` | Texsport Trading Corporation | split | new |
| classic-fashion | `55` | Classic Fashion International Ltd. | `1256` | Classic Fashion Sourcing | split | new |
| classic-fashion | `55` | Classic Fashion International Ltd. | `67` | Match International (Pvt.) Ltd. | split | new |
| classic-fashion | `55` | Classic Fashion International Ltd. | `68` | Classic International (Pvt.) Ltd. | split | new |
| coast-to-coast | `general:1081` | Coast To Coast (Pvt) Ltd. | `general:2768` | Coast To Coast Fashion Ltd. | split | new |
| coast-to-coast | `general:1081` | Coast To Coast (Pvt) Ltd. | `general:3070` | Coast To Coast Apparels Ltd. | split | new |
| creative-designers | `general:4154` | Creative Designers Ltd. | `63` | Creative Designers Ltd. | merge | — |
| csf-garments | `general:5738` | CSF Garments (Pvt) Ltd. | `general:5718` | CSF Garments (Pvt) Ltd. | merge | — |
| caravan-mode | `749` | Caravan Mode Ltd. | `1729` | — | unresolved | — |
| caretex-sourcing | `726` | Caretex Sourcing Ltd. | `1404` | Tex Care | split | new |
| caretex-sourcing | `726` | Caretex Sourcing Ltd. | `913` | Caretex | split | new |
| channel-expor-tex-international | `62` | Channel Expor-tex International | `338` | Channel Expor-tex International Ltd. | merge | — |
| channel-expor-tex-international | `62` | Channel Expor-tex International | `460` | HM Textile | split | hm-textile |
| city-import | `353` | City Import | `690` | City Apparel-Tex Co. (CATCO) | split | new |
| classic-fashion-concept | `general:3324` | Classic Fashion Concept Ltd. | `509` | Classic Fashion Concept | merge | — |
| coop-global-sourcing | `655` | Coop Global Sourcing Limited | `1443` | Coop Trading BD | split | new |
| creative-sweater | `general:1689` | Creative Sweaters (Pvt.) Ltd. | `general:3346` | Creative Sweaters (Pvt) Ltd.(U-2) | attach-as-facility | — |
| culture-clothing | `945` | Culture Clothing Inc. | `562` | Culture Clothings ltd | merge | — |
| cut-n-sew | `general:2647` | Cut N Sew Ltd. | `general:5756` | Snowtex Outerwear Ltd. | split | snowtex-outerwear |
| dekko-knitwear | `general:1401` | Dekko Knitwears Limited | `general:3294` | Dekko Knitwears Ltd. (Unit-2) | attach-as-facility | — |
| divine-textile | `general:2507` | Divine Textile Ltd. | `651` | Divine Sourcing Ltd. | split | new |
| dk-knitwear | `778` | DK Design Ltd. | `1314` | L. A. T Sportwear Ltd. | split | new |
| dk-knitwear | `778` | DK Design Ltd. | `35` | DK Textile Ltd. | split | dk-textile |
| dk-knitwear | `778` | DK Design Ltd. | `478` | DK Collection | split | new |
| danny-dhaka | `general:4929` | Danny Dhaka Ltd. | `53` | Kam Knit | split | new |
| danny-dhaka | `general:4929` | Danny Dhaka Ltd. | `54` | Danny Dhaka Ltd. | merge | — |
| data-fashion | `general:4994` | Data Fashion Ltd. | `71` | Data Fashion Ltd. | merge | — |
| desh-fashion | `general:6840` | Desh Fashion | `1086` | Desh Fashion Ltd. | merge | — |
| designtex-knitwear | `general:6167` | Designtex Knitwear Ltd. | `23` | Designtex Ltd. | split | new |
| dhaka-natex-sourcing | `1255` | Dhaka Natex Sourcing Ltd. | `1196` | Natex Bangladesh Limited | split | new |
| dhaka-natex-sourcing | `1255` | Dhaka Natex Sourcing Ltd. | `1464` | Natex of Scandinavia A/S Bangladesh | split | natex-of-scandinavia-as-bangladesh |
| dinatex-international | `698` | Dinatex International Ltd. | `60` | Landmark Designs Ltd. | split | new |
| discreet-fashion-wear | `general:6537` | Discreet Fashion Wear Ltd. | `1234` | Discreet Fashion Wear Ltd. | merge | — |
| dressen | `131` | Dressen Corporation | `general:117` | Dressmen Ltd. | review | — |
| dressytex | `1269` | Dressytex | `1040` | Dresstex Bangladesh | split | new |
| dynamic-export-zone | `general:6674` | Dynamic Export Zone Ltd. | `1339` | Dynamic Export Zone | merge | — |
| dynamic-sourcing | `1340` | Dynamic Sourcing Ltd. | `834` | Dynamic International Sourcing Ltd. | split | new |
| eurotex-fashion | `1392` | Eurotex Fashion | `1159` | Eurotex International | split | new |
| eurotex-fashion | `1392` | Eurotex Fashion | `1451` | Europtex Fashion Limited | review | — |
| eurotex-fashion | `1392` | Eurotex Fashion | `668` | Euro Tex | split | new |
| eurotex-fashion | `1392` | Eurotex Fashion | `695` | Euro Tex International | split | new |
| eurotex-fashion | `1392` | Eurotex Fashion | `697` | Top Grade International Enterprise Ltd. | split | new |
| eastern-garments | `general:5195` | Eastern Garments | `general:1142` | Eastern Garments Ltd. | merge | — |
| echo-sourcing | `734` | Echo Sourcing (Pvt.) Ltd. | `97` | Quality Assured Ltd. | split | quality-assured |
| elham-international | `general:6871` | Elham International Ltd. | `1277` | Elham Sourcing Ltd. | split | new |
| elham-international | `general:6871` | Elham International Ltd. | `853` | Elham International Ltd. | merge | — |
| elham-international | `general:6871` | Elham International Ltd. | `944` | Ejahar Brother's & Garments Ltd. | split | new |
| etam-international-l-sourcing-shanghai | `1402` | Etam Int'l Sourcing (Shanghai) Co. Ltd. | `1591` | Fashion Theory Ltd. | split | new |
| euro-point | `79` | Euro Point Ltd. | `106` | Unistar Distribution Company (BD) Ltd. | split | new |
| explore-fashion | `233` | Explore Fashion Ltd. | `1668` | Xplore Sourcing | split | new |
| fm-fashion-wear | `general:6835` | F M Fashion Wear | `general:1984` | F.M. Fashion Wear Ltd. | merge | — |
| fame-design | `general:5924` | Fame Design Ltd. | `258` | Fame Design | merge | — |
| fariha-fashion | `1669` | Flaxen Fashionwears Limited | `1362` | T.S.A. Bangladesh | split | new |
| fashion-flow-apparels | `general:6342` | Fashion Flow Apparels Ltd. | `1267` | Fashion Flow Limited | split | new |
| fashion-makers | `general:1456` | Fashion Makers Ltd. | `61` | Fashion Makers Inc. | merge | — |
| fashion-tex | `868` | Fashion Tex | `254` | Fashion Tex | merge | — |
| fashion-tex | `868` | Fashion Tex | `699` | Fashion Tex International | split | new |
| far-east-textile-and-clothing | `39` | Far East Textile & Clothing Ltd. | `605` | Far East Textiles & Clothing | merge | — |
| fashion-create | `1257` | Fashion Create | `general:3598` | Fashion Create Apparels Ltd. | split | new |
| fashion-exclusive | `789` | Fashion Exclusive | `596` | Fashion Exclusive Ltd. | merge | — |
| fashion-fair-international | `952` | Fashion Fair International | `general:2252` | Fashion Fair Ltd. | split | new |
| fashion-plus | `general:4030` | Fashion Plus Ltd. | `1436` | Fashion Plus International Ltd. | split | new |
| fashion-plus | `general:4030` | Fashion Plus Ltd. | `351` | Fashion Plus | merge | — |
| fashion-trade-international | `817` | Fashion Trade International | `general:6781` | Fashion Trade | split | new |
| fashion-world | `332` | Fashion World Ltd. | `341` | Fashion World International | split | new |
| fashion-xpress | `521` | Fashion Xpress Ltd. | `580` | Map Tex | split | new |
| fashion-zone-international | `823` | Fashion Zone International | `935` | Knit Wear Creator Ltd. | split | new |
| fashion-zone-international | `823` | Fashion Zone International | `general:1341` | Fashion Zone Ltd. | split | new |
| floreal-international | `937` | Floreal International Ltd. | `1039` | Walther & Walther International | split | new |
| friends-fashion | `general:975` | Friends Fashion | `548` | Friends Fashion | merge | — |
| grs-sourcing | `961` | GRS Sourcing Ltd. | `1435` | H.R.M. Sourcing Ltd. | split | new |
| garib-and-garib | `general:1930` | Garib & Garib Co. Ltd. | `general:3302` | Garib & Garib Co. Ltd. (Unit-2) | attach-as-facility | — |
| gemtex-sourcing | `1400` | Gemtex Sourcing Ltd. | `1686` | Tex Stitch Concept Limited | split | new |
| gilco-fashion | `1151` | Gilco Fashion Ltd. | `239` | Gilco Industries Ltd. | split | new |
| global-knitwear | `946` | Global Apparel Sourcing Ltd. | `543` | Global Fashion | split | new |
| global-knitwear | `946` | Global Apparel Sourcing Ltd. | `914` | Global Textile Sourcing Limited | split | new |
| global-usa | `1055` | Global USA Ltd. | `1012` | Price Club General Trading Ltd. | split | new |
| golden-tex | `669` | Golden Tex | `1342` | Golden Touch | split | new |
| grassy | `277` | Grassy | `141` | Mum Fashion Merchandising Ltd. | split | new |
| hmn-fashion | `general:3732` | HMN Fashion Ltd. | `507` | Jenable Textile Ltd. | split | new |
| haque-apparels-and-textile | `general:6818` | Haque Apparels & Textile Ltd. | `1384` | Haque Apparels & Textile Ltd. | merge | — |
| interloop-bd | `general:6617` | Interloop BD Ltd | `1595` | Interloop Sourcing Ltd. | split | new |
| interstoff-apparels | `general:4052` | Interstoff Apparels Ltd. | `1265` | Renaissance Design Ltd. | split | new |
| impression-design | `1678` | Impression Design | `1568` | Impression Sourcing & Design Limited | split | new |
| incredible-fashions | `general:5810` | Incredible Fashions Ltd. | `715` | Incredible Fashions Ltd. | merge | — |
| indomanu-bangladesh | `451` | Indomanu Bangladesh | `816` | Yashmak International | split | new |
| integra-apparels-bangladesh | `general:5430` | Integra Apparels (Bangladesh) Ltd. | `1285` | Integral Fashion | split | new |
| intend-tex-sourcing | `1478` | Intend Tex Sourcing Ltd. | `1499` | Intend Fashion | split | new |
| intercare | `general:961` | Intercare Limited | `882` | Intercare Fashion | split | new |
| intramex-knitwear-ltd-unit-2 | `general:5904` | Intramex Knit Wear Ltd. (Unit-2) | `general:4210` | Intramex Knitwear Ltd. | attach-host-as-facility | — |
| jm-knitwear | `423` | J.M. Export Ltd. | `422` | Reglisse | split | new |
| jr-enterprise | `general:5593` | J.R. Enterprise Ltd. | `1020` | J.R. International | split | new |
| jdk-fashion | `934` | JDK Fashion Ltd. | `1101` | JDK Sourcing Ltd. | split | new |
| jms-clothing | `1579` | JMS Clothing Ltd. | `1398` | JMS International | split | new |
| jns-knitwear | `general:6475` | Jns Knitwear Ltd. | `890` | JNS Knitwear Ltd. | merge | — |
| kl-fashion | `general:5621` | KL Fashion Ltd. | `119` | K.L. International Ltd. | split | new |
| kgs-sourcing-ltd-redcats | `549` | KGS Sourcing Ltd (Redcats ). | `916` | Otto Int'l (Hong Kong) Limited Bangladesh | split | new |
| knit-fair | `general:5902` | Knit Fair Ltd. | `152` | Knit Fair | merge | — |
| kenpark-bangladesh | `general:2197` | Kenpark Bangladesh (Pvt) Ltd. | `general:4572` | Kenpark Bangladesh Apparel (Pvt) Ltd. | split | new |
| kento-asia | `general:4466` | Kento Asia Ltd. | `537` | Kento Asia Ltd. | merge | — |
| khan-sourcing-bd | `1305` | Khan Sourcing (BD) Ltd. | `955` | Khan Sourcing | split | new |
| knit-collection | `954` | Knit Collection Limited | `1137` | Knit Collection | merge | — |
| libas-knitwear | `general:5089` | Libas Knit Wear Ltd. | `175` | Libas International Ltd. | split | new |
| libas-stitch | `general:5977` | Libas Stitch | `525` | Lawyee Apparel Exports Ltd. | split | new |
| le-nouveautex | `general:2125` | Le Nouveautex (Pvt) Ltd. | `general:4800` | Le-Nouveautex Knit Fashion | split | new |
| m-and-z | `91` | M & Z Co. Ltd. | `1677` | M & Z Sourcing BD | split | new |
| matrix-dresses | `general:7008` | Matrix Dresses | `general:5471` | Matrix Dresses Ltd. | merge | — |
| md-tex | `1211` | MD Tex | `1556` | Sunrise Apparel BD | split | new |
| mahmud-fashion | `general:6303` | Mahmud Fashion Ltd. | `503` | Mahmud Enterprise | split | new |
| mak-tex-international | `1213` | Mak Tex International Inc. | `237` | Tex Mark | split | new |
| mark-fashion-wear-pvt-ltd-u-2 | `general:955` | Mark Fashion Wear (Pvt.) Ltd. (U-2) | `general:374` | Mark Fashion Wear (Pvt). Ltd. | attach-host-as-facility | — |
| mass-fashion-bd | `general:6753` | Mass Fashion BD | `general:740` | Mass Fashion Ltd. | split | new |
| matrix-apparels | `general:6435` | Matrix Apparels Ltd. | `968` | Matrix Sourcing Ltd. | split | new |
| mega-merchandising | `1083` | Mega Merchandising Company Ltd. | `1082` | Winsome Sourcing | split | new |
| merchantex-co-bd | `125` | Merchantex Co. (BD) Ltd. | `1370` | Merchantex International | split | new |
| midasia-designers | `390` | Midasia Designers Ltd. | `393` | Studio Max Mazza | split | new |
| mirza-fashion-and-design | `836` | Mirza Fashion & Design | `331` | Union Fashion | split | union-fashion |
| mirza-fashion-and-design | `836` | Mirza Fashion & Design | `779` | Union Trade Impex Limited | split | new |
| mustang-associates | `791` | Mustang Associates Ltd. | `11` | Mustang International Limited | split | new |
| mustex-sourcing | `1371` | Mustex Sourcing | `1382` | Textiss Bangladesh | split | new |
| needle-thread | `1088` | Needle Thread Pvt. Ltd. | `1463` | WIKITEX - BD | split | new |
| next-apparels | `1523` | Next Sourcing Services Limited | `1115` | Next Sourcing Ltd. | split | new |
| naba-apparel | `951` | Naba Apparel Inc. | `general:1623` | Naba Apparels Ltd. | merge | — |
| new-wave-group-ab | `619` | New Wave Group AB | `1498` | New Wave Group SA | review | — |
| nisha-trade-international | `20` | Nisha Trade International | `1506` | Nisha Fashions Wear | split | new |
| novatex-international | `273` | Novatex International | `278` | Pacers International | split | new |
| pavel-fashion | `1273` | Pavel Style (BD) Ltd. | `1266` | Pavel Sourcing (BD) Ltd. | split | new |
| prominent-apparels | `general:5917` | Prominent Apparels Ltd. | `general:2348` | Prominent Apparels | merge | — |
| panache-international | `12` | Panache International Limited | `255` | Panache Pvt. Ltd. | split | new |
| penny-design | `1133` | Penny Design Limited | `general:5837` | Penny Design Knitwear | split | new |
| perfect-fashion | `general:4602` | Perfect Fashion | `25` | Perfect Fashion | merge | — |
| postex | `585` | Postex Ltd. | `377` | RMT Corporation Ltd. | split | new |
| preston-france-bd | `604` | Preston France (BD) Limited | `266` | Square Int. Inc. | split | new |
| protex-international | `150` | Protex International | `242` | Protex Enterprise Co. Ltd. | split | new |
| quattro-fashion | `general:6428` | Quattro Fashion Ltd. | `319` | Quatro International | split | new |
| qtex-merchandising | `244` | Qtex Merchandising Ltd. | `1210` | Qtex Merchandising | merge | — |
| ra-apparels | `601` | R.A. Trading Limited | `1114` | A.R. Apparel Sourcing | split | new |
| ra-apparels | `601` | R.A. Trading Limited | `330` | A.R. Fashion | split | new |
| rr-apparels | `general:6714` | RR Apparels | `general:4171` | R.R. Apparels Ltd. | merge | — |
| ratool-apparels | `general:5351` | Ratool Apparels Ltd. | `1550` | Ratool Sourcing | split | new |
| ritzy-apparels | `general:4176` | Ritzy Apparels Ltd. | `620` | Ritzy Apparels | merge | — |
| rainbow-tex | `195` | Rainbow Tex | `732` | Stayn Unn | split | new |
| remix-collections | `general:7101` | Remix Collections Ltd. | `1510` | Remix Collections | merge | — |
| rhyam-international | `108` | Rhyam International Ltd. | `240` | Rhyme Trading | split | new |
| rich-cotton-apparels | `general:6796` | Rich Cotton Apparels Limited | `1445` | Rich Cotton Limited | split | new |
| rosemary | `36` | Rosemary Limited | `154` | Simtrade Limited | split | new |
| s-asia-high-lights | `762` | S Asia High Lights | `769` | Zzan Design Ltd. | split | new |
| sk-apparels | `general:5781` | SK Apparels Ltd. | `1190` | S.K. Fashion | split | new |
| section-seven-apparels | `general:5045` | Section Seven Apparels Ltd. | `general:4298` | Section Seven Ltd. | split | section-seven |
| standard-stitches | `general:5350` | Standard Stitches Ltd | `general:5663` | Standard Stitches Ltd. (Woven Unit) | attach-as-facility | — |
| saf-apparel-bd | `1227` | Saf Apparel BD Ltd. | `939` | SAF International | split | new |
| sagacious-fashions | `general:6126` | Sagacious Fashions Ltd. | `1146` | Sagacious Fashions Limited | merge | — |
| sarah-knitwear | `general:4616` | Sarah Knit Wear | `999` | Sarah Knit Wear | merge | — |
| scandex-bd | `general:3571` | Scandex (BD) Ltd. | `30` | Scandex Fashion Ltd. | split | new |
| shan-global | `1411` | Shan Global Company | `1477` | Shan International Trading Company | split | new |
| shangu-tex | `general:3333` | Shangu Tex Ltd. | `general:4669` | Shangu Tex Ltd.-2 | attach-as-facility | — |
| spark-international | `1415` | Spark International | `1660` | Styelaa Fashion (Pvt.) Limited | split | new |
| styleelite | `1448` | Styleelite Limited | `1447` | White Swan Limited | split | new |
| sunwah-textile-international | `117` | Sunwah Textile International Co., Ltd. | `118` | Tex Well International Co. Ltd. | split | new |
| tex-mart | `1581` | Tex-Mart International | `645` | Tex Mart Apparels | split | new |
| the-fashion-island | `general:2534` | The Fashion Island Ltd. | `1128` | Riviera Resources Ltd. | split | riviera-resources |
| the-fashion-island | `general:2534` | The Fashion Island Ltd. | `326` | Riviera International Ltd. | split | new |
| tokio-mode | `general:2394` | Tokio Mode Limited | `373` | Tokio Mode Ltd. | merge | — |
| total-fashion | `general:4464` | Total Fashion Ltd. | `983` | Total Sourcing | split | new |
| tabassum-trade-international | `general:4888` | Tabassum Trade International | `950` | Tabassum Trade International | merge | — |
| tamishna-apparels | `general:5047` | Tamishna Apparels Ltd. | `612` | Tamishna Apparels Ltd. | merge | — |
| tashfia-export | `general:6958` | Tashfia Export | `1569` | Tashfia Export | merge | — |
| tex-design | `972` | Tex Design | `1375` | Tex-Design Sourcing Limited | split | new |
| tex-design | `972` | Tex Design | `848` | Tex Design | merge | — |
| texel | `13` | Texel Limited | `1029` | Texel Limited . | merge | — |
| teximco-bd | `1549` | Teximco (BD) Ltd. | `1087` | Teximco (BD) | merge | — |
| textile-apparel-sourcing | `1117` | Textile Apparel Sourcing Corp. | `1431` | Textile Sourcing | split | new |
| the-civil-engineers | `general:3041` | The Civil Engineers Ltd. | `general:4834` | The Civil Engineers Ltd. (Sw Unit) | attach-as-facility | — |
| the-shanin | `general:872` | The Shanin Corporation Ltd. | `general:2247` | The Shanin Ltd. | merge | — |
| trigon-merchandising | `1188` | Trigon Merchandising Corporation Ltd. | `978` | Trigon Merchandising Services (Pvt.) Ltd. | split | new |
| univogue-garments | `general:424` | Univogue Garments Co. Ltd. | `general:2436` | Univogue Garments Co. Ltd. Unit-II | attach-as-facility | — |
| viyellatex | `general:4127` | Viyellatex Ltd. | `general:6510` | Viyellatex Apparels Ltd. | split | new |
| vintage-denim-apparels | `general:6213` | Vintage Denim Apparels Ltd. | `general:4562` | Vintage Denim Ltd. | split | vintage-denim |
| welldone-apparel | `general:3010` | Welldone Apparel Ltd. | `38` | Welldone (BD) Ltd. | split | new |
| western-dresses | `general:1179` | Western Dresses Ltd. | `general:2001` | Eastern Dresses Ltd. | review | — |
| young-fashion | `general:1996` | Young Fashion (Pvt) Ltd. | `772` | Young Fashion Ltd. | merge | — |
| z7-apparels | `1562` | Z7 Apparels Ltd. | `1561` | ZXY International DMCC | split | new |
| z7-apparels | `1562` | Z7 Apparels Ltd. | `1563` | ZXY International FZCO | split | new |
| z7-apparels | `1562` | Z7 Apparels Ltd. | `17` | ZXY Apparel Buying Solutions Ltd. | split | new |
