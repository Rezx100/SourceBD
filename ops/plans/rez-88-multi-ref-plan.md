# REZ-88 multi-member-ref plan

Detection-only. **No splits, merges, or unpublishing.**

## Reproduction

- BGMEA-sourced suppliers with >1 distinct active member `source_ref`: **199** (expected 199)
- Excess refs: **230** (expected 230)
- Signal class: `multi_member_ref` (structural; no name comparison)
- Why the name-based detector missed them: all 199 lack `fields.scraped_company_name` (pre-REZ-56 `bgmea_web` payload)

## Name recovery

- General member pages re-fetched: **138** / 138
- Associate PDF names available: **1678**
- Historical `scraped_company_name` was **not** backfilled

## Classification counts (excess refs)

| class | count |
| -- | -- |
| split | 164 |
| attach-as-facility | 3 |
| merge | 60 |
| unresolved | 3 |
| **total** | **230** |

## Rules

- Keeper = ref whose recovered name is `_names_compatible` with the host;
  ties prefer `general:` over bare associate regs.
- `attach-as-facility`: excess name matches `extension_base_name` against
  keeper/host (A7 definition; not `_compatible`).
- `merge`: recovered names compatible with keeper/host.
- `split`: distinct legal entity — becomes its own supplier.
- `unresolved`: no live name recovered for the excess ref.

## Per-ref plan

| host slug | keeper ref | keeper name | excess ref | excess name | action |
| -- | -- | -- | -- | -- | -- |
| 4a-yarn-dyeing | `general:4121` | 4A Yarn Dyeing Ltd. | `general:3778` | South End Sweater Co. Ltd. | split |
| a-and-c-bd | `109` | A & C (BD) Ltd. | `901` | C & A Sourcing International Ltd. | split |
| am-fashion | `general:6146` | A.M. Fashion | `231` | A.M. Fashion International Ltd. | split |
| a-plus-industries | `general:4221` | A Plus Industries Ltd. | `544` | A Plus Industries. | merge |
| as-knitwear | `953` | A. S. Fashion | `528` | S.A. Fashion | split |
| abc-international | `632` | ABC International | `1697` | — | unresolved |
| abl | `879` | ABL | `1722` | — | unresolved |
| abl | `879` | ABL | `395` | ABL | merge |
| ams-fahion-house | `482` | AMS Fahion House | `369` | Best Buy International Knit Wears | split |
| anam-garments | `general:1073` | Anam Garments Ltd. | `909` | Texture BD | split |
| apt-international | `general:4390` | Apt International Ltd. | `598` | APT International | merge |
| artistic-apparels | `general:3447` | Artistic Apparels Ltd. | `644` | Aartistic International | split |
| asrotex | `general:5403` | Asrotex Ltd. | `general:2751` | Asrotex | merge |
| attraction-garments | `general:4997` | Attraction Garments Ltd. | `637` | Tejgaon Eminent Fashion Ltd. | split |
| abdullah-fashions | `general:6594` | Abdullah Fashions | `general:6400` | Abdullah Fashions Ltd. | merge |
| abid-export | `747` | Abid Export Ltd. | `1545` | Off Price Clothing | split |
| abid-export | `747` | Abid Export Ltd. | `1546` | Trade Evidence | split |
| abloom | `719` | Abloom Limited | `754` | Park Mode Wear Ltd. | split |
| aesthetic-apparel | `1024` | Aesthetic Apparel | `1659` | Suxes Attires Ltd. | split |
| ags-apparels | `930` | Saint Martin Apparels | `1204` | AGS Fashion Ltd. | split |
| alex-bangladesh | `1594` | Alex Bangladesh | `1018` | Alex Fashion | split |
| alpha-product-development-company-bd | `general:7112` | Alpha Product Development Company (BD) Ltd. | `general:6746` | Gaya Product Development Company (BD) Ltd. | merge |
| ananta-apparels | `general:6257` | Ananta Apparels Ltd. | `general:1181` | Ananta Apparels Ltd. | merge |
| ananta-apparels | `general:6257` | Ananta Apparels Ltd. | `general:4564` | Ananta Apparels Ltd. | merge |
| anzir-apparels | `general:3231` | Anzir Apparels Ltd. | `general:3843` | Anzir Apparels Ltd. (U-2) | split |
| apparel-gallery | `general:4577` | Apparel Gallery Ltd. | `1036` | Apparel Gallery | merge |
| apparel-trade-international | `591` | Apparel Trade International | `207` | Triangle Venture Ltd. | split |
| aries | `290` | Aries Corporation | `89` | Exo Bangladesh | split |
| atima-fashions | `174` | Atima Fashions Ltd. | `679` | Atima Knitwear Ltd. | split |
| attire-international | `252` | Attire International | `1238` | Attire BD | split |
| awss-fashions | `193` | Awss Fashions Ltd. | `42` | Awss (BD) Limited | split |
| axon-fashion-international | `927` | Axon Fashion International | `general:6881` | Axon Fashion Limited | split |
| ayesha-fashion | `general:4193` | Ayesha Fashion Ltd. | `1640` | Ayesha Trading | split |
| azim-garments | `general:634` | Azim Garments Ltd. | `general:2791` | Aziz Garments Ltd. | merge |
| b-brothers-garments | `general:1737` | B. Brothers Garments Co. Ltd. | `general:3647` | B. Brothers Garments Co. Ltd.(U-2) | split |
| bd-tex | `1022` | BD TEX | `1440` | BD-Tex Apparels Ltd. | split |
| bd-tex | `1022` | BD TEX | `664` | BD-Tex Sourcing | split |
| bangladesh-dresses | `general:1355` | Bangladesh Dresses Limited | `general:2431` | Bangladesh Dresses Ltd.(Unit-2) | attach-as-facility |
| basic-apparels | `general:721` | Basic Apparels Ltd. | `88` | Basic Fashion | split |
| blue-avenue-clothing | `638` | Blue Avenue Clothing Ltd. | `196` | RS Collection | split |
| blue-avenue-clothing | `638` | Blue Avenue Clothing Ltd. | `458` | Feed Back Clothing Co. | split |
| blue-bird-fashion | `453` | Blue Bird Fashion | `600` | Blue Bird Attire Ltd. | split |
| blue-bird-fashion | `453` | Blue Bird Fashion | `781` | Zaima Fashion | split |
| bodystretch-bangladesh | `948` | Bodystretch Bangladesh Ltd. | `929` | Trybe Bangladesh Limited | split |
| bonny-apparels | `general:1463` | Bonny Apparels (Pvt) Ltd. | `general:3051` | Bonny Apparels (Pvt) Ltd.(U-2) | split |
| boston-sportswear-manufacturing | `486` | Boston Sportswear Mfg. Ltd. | `157` | Boston Sportswear MFG. | merge |
| bright-tex-trading | `1433` | Bright Tex Trading Corporation | `1359` | Texsport Trading Corporation | split |
| classic-fashion | `68` | Classic International (Pvt.) Ltd. | `1256` | Classic Fashion Sourcing | split |
| classic-fashion | `68` | Classic International (Pvt.) Ltd. | `55` | Classic Fashion International Ltd. | split |
| classic-fashion | `68` | Classic International (Pvt.) Ltd. | `67` | Match International (Pvt.) Ltd. | split |
| coast-to-coast | `general:1081` | Coast To Coast (Pvt) Ltd. | `general:2768` | Coast To Coast Fashion Ltd. | split |
| coast-to-coast | `general:1081` | Coast To Coast (Pvt) Ltd. | `general:3070` | Coast To Coast Apparels Ltd. | split |
| creative-designers | `general:4154` | Creative Designers Ltd. | `63` | Creative Designers Ltd. | merge |
| csf-garments | `general:5738` | CSF Garments (Pvt) Ltd. | `general:5718` | CSF Garments (Pvt) Ltd. | merge |
| caravan-mode | `749` | Caravan Mode Ltd. | `1729` | — | unresolved |
| caretex-sourcing | `726` | Caretex Sourcing Ltd. | `1404` | Tex Care | split |
| caretex-sourcing | `726` | Caretex Sourcing Ltd. | `913` | Caretex | split |
| channel-expor-tex-international | `62` | Channel Expor-tex International | `338` | Channel Expor-tex International Ltd. | merge |
| channel-expor-tex-international | `62` | Channel Expor-tex International | `460` | HM Textile | split |
| city-import | `353` | City Import | `690` | City Apparel-Tex Co. (CATCO) | split |
| classic-fashion-concept | `general:3324` | Classic Fashion Concept Ltd. | `509` | Classic Fashion Concept | merge |
| coop-global-sourcing | `655` | Coop Global Sourcing Limited | `1443` | Coop Trading BD | split |
| creative-sweater | `general:1689` | Creative Sweaters (Pvt.) Ltd. | `general:3346` | Creative Sweaters (Pvt) Ltd.(U-2) | split |
| culture-clothing | `945` | Culture Clothing Inc. | `562` | Culture Clothings ltd | merge |
| cut-n-sew | `general:2647` | Cut N Sew Ltd. | `general:5756` | Snowtex Outerwear Ltd. | split |
| dekko-knitwear | `general:1401` | Dekko Knitwears Limited | `general:3294` | Dekko Knitwears Ltd. (Unit-2) | attach-as-facility |
| divine-textile | `general:2507` | Divine Textile Ltd. | `651` | Divine Sourcing Ltd. | split |
| dk-knitwear | `778` | DK Design Ltd. | `1314` | L. A. T Sportwear Ltd. | split |
| dk-knitwear | `778` | DK Design Ltd. | `35` | DK Textile Ltd. | split |
| dk-knitwear | `778` | DK Design Ltd. | `478` | DK Collection | split |
| danny-dhaka | `general:4929` | Danny Dhaka Ltd. | `53` | Kam Knit | split |
| danny-dhaka | `general:4929` | Danny Dhaka Ltd. | `54` | Danny Dhaka Ltd. | merge |
| data-fashion | `general:4994` | Data Fashion Ltd. | `71` | Data Fashion Ltd. | merge |
| desh-fashion | `general:6840` | Desh Fashion | `1086` | Desh Fashion Ltd. | merge |
| designtex-knitwear | `general:6167` | Designtex Knitwear Ltd. | `23` | Designtex Ltd. | split |
| dhaka-natex-sourcing | `1255` | Dhaka Natex Sourcing Ltd. | `1196` | Natex Bangladesh Limited | split |
| dhaka-natex-sourcing | `1255` | Dhaka Natex Sourcing Ltd. | `1464` | Natex of Scandinavia A/S Bangladesh | split |
| dinatex-international | `698` | Dinatex International Ltd. | `60` | Landmark Designs Ltd. | split |
| discreet-fashion-wear | `general:6537` | Discreet Fashion Wear Ltd. | `1234` | Discreet Fashion Wear Ltd. | merge |
| dressen | `general:117` | Dressmen Ltd. | `131` | Dressen Corporation | merge |
| dressytex | `1269` | Dressytex | `1040` | Dresstex Bangladesh | split |
| dynamic-export-zone | `general:6674` | Dynamic Export Zone Ltd. | `1339` | Dynamic Export Zone | merge |
| dynamic-sourcing | `1340` | Dynamic Sourcing Ltd. | `834` | Dynamic International Sourcing Ltd. | split |
| eurotex-fashion | `1451` | Europtex Fashion Limited | `1159` | Eurotex International | split |
| eurotex-fashion | `1451` | Europtex Fashion Limited | `1392` | Eurotex Fashion | merge |
| eurotex-fashion | `1451` | Europtex Fashion Limited | `668` | Euro Tex | split |
| eurotex-fashion | `1451` | Europtex Fashion Limited | `695` | Euro Tex International | split |
| eurotex-fashion | `1451` | Europtex Fashion Limited | `697` | Top Grade International Enterprise Ltd. | split |
| eastern-garments | `general:5195` | Eastern Garments | `general:1142` | Eastern Garments Ltd. | merge |
| echo-sourcing | `734` | Echo Sourcing (Pvt.) Ltd. | `97` | Quality Assured Ltd. | split |
| elham-international | `general:6871` | Elham International Ltd. | `1277` | Elham Sourcing Ltd. | split |
| elham-international | `general:6871` | Elham International Ltd. | `853` | Elham International Ltd. | merge |
| elham-international | `general:6871` | Elham International Ltd. | `944` | Ejahar Brother's & Garments Ltd. | split |
| etam-international-l-sourcing-shanghai | `1402` | Etam Int'l Sourcing (Shanghai) Co. Ltd. | `1591` | Fashion Theory Ltd. | split |
| euro-point | `79` | Euro Point Ltd. | `106` | Unistar Distribution Company (BD) Ltd. | split |
| explore-fashion | `233` | Explore Fashion Ltd. | `1668` | Xplore Sourcing | split |
| fm-fashion-wear | `general:6835` | F M Fashion Wear | `general:1984` | F.M. Fashion Wear Ltd. | merge |
| fame-design | `general:5924` | Fame Design Ltd. | `258` | Fame Design | merge |
| fariha-fashion | `1669` | Flaxen Fashionwears Limited | `1362` | T.S.A. Bangladesh | split |
| fashion-flow-apparels | `general:6342` | Fashion Flow Apparels Ltd. | `1267` | Fashion Flow Limited | split |
| fashion-makers | `general:1456` | Fashion Makers Ltd. | `61` | Fashion Makers Inc. | merge |
| fashion-tex | `868` | Fashion Tex | `254` | Fashion Tex | merge |
| fashion-tex | `868` | Fashion Tex | `699` | Fashion Tex International | split |
| far-east-textile-and-clothing | `605` | Far East Textiles & Clothing | `39` | Far East Textile & Clothing Ltd. | merge |
| fashion-create | `1257` | Fashion Create | `general:3598` | Fashion Create Apparels Ltd. | split |
| fashion-exclusive | `789` | Fashion Exclusive | `596` | Fashion Exclusive Ltd. | merge |
| fashion-fair-international | `952` | Fashion Fair International | `general:2252` | Fashion Fair Ltd. | split |
| fashion-plus | `general:4030` | Fashion Plus Ltd. | `1436` | Fashion Plus International Ltd. | split |
| fashion-plus | `general:4030` | Fashion Plus Ltd. | `351` | Fashion Plus | merge |
| fashion-trade-international | `817` | Fashion Trade International | `general:6781` | Fashion Trade | split |
| fashion-world | `332` | Fashion World Ltd. | `341` | Fashion World International | split |
| fashion-xpress | `521` | Fashion Xpress Ltd. | `580` | Map Tex | split |
| fashion-zone-international | `823` | Fashion Zone International | `935` | Knit Wear Creator Ltd. | split |
| fashion-zone-international | `823` | Fashion Zone International | `general:1341` | Fashion Zone Ltd. | split |
| floreal-international | `937` | Floreal International Ltd. | `1039` | Walther & Walther International | split |
| friends-fashion | `general:975` | Friends Fashion | `548` | Friends Fashion | merge |
| grs-sourcing | `961` | GRS Sourcing Ltd. | `1435` | H.R.M. Sourcing Ltd. | split |
| garib-and-garib | `general:1930` | Garib & Garib Co. Ltd. | `general:3302` | Garib & Garib Co. Ltd. (Unit-2) | attach-as-facility |
| gemtex-sourcing | `1400` | Gemtex Sourcing Ltd. | `1686` | Tex Stitch Concept Limited | split |
| gilco-fashion | `1151` | Gilco Fashion Ltd. | `239` | Gilco Industries Ltd. | split |
| global-knitwear | `946` | Global Apparel Sourcing Ltd. | `543` | Global Fashion | split |
| global-knitwear | `946` | Global Apparel Sourcing Ltd. | `914` | Global Textile Sourcing Limited | split |
| global-usa | `1055` | Global USA Ltd. | `1012` | Price Club General Trading Ltd. | split |
| golden-tex | `669` | Golden Tex | `1342` | Golden Touch | split |
| grassy | `277` | Grassy | `141` | Mum Fashion Merchandising Ltd. | split |
| hmn-fashion | `general:3732` | HMN Fashion Ltd. | `507` | Jenable Textile Ltd. | split |
| haque-apparels-and-textile | `general:6818` | Haque Apparels & Textile Ltd. | `1384` | Haque Apparels & Textile Ltd. | merge |
| interloop-bd | `general:6617` | Interloop BD Ltd | `1595` | Interloop Sourcing Ltd. | split |
| interstoff-apparels | `general:4052` | Interstoff Apparels Ltd. | `1265` | Renaissance Design Ltd. | split |
| impression-design | `1678` | Impression Design | `1568` | Impression Sourcing & Design Limited | split |
| incredible-fashions | `general:5810` | Incredible Fashions Ltd. | `715` | Incredible Fashions Ltd. | merge |
| indomanu-bangladesh | `451` | Indomanu Bangladesh | `816` | Yashmak International | split |
| integra-apparels-bangladesh | `general:5430` | Integra Apparels (Bangladesh) Ltd. | `1285` | Integral Fashion | split |
| intend-tex-sourcing | `1478` | Intend Tex Sourcing Ltd. | `1499` | Intend Fashion | split |
| intercare | `general:961` | Intercare Limited | `882` | Intercare Fashion | split |
| intramex-knitwear-ltd-unit-2 | `general:5904` | Intramex Knit Wear Ltd. (Unit-2) | `general:4210` | Intramex Knitwear Ltd. | split |
| jm-knitwear | `423` | J.M. Export Ltd. | `422` | Reglisse | split |
| jr-enterprise | `general:5593` | J.R. Enterprise Ltd. | `1020` | J.R. International | split |
| jdk-fashion | `934` | JDK Fashion Ltd. | `1101` | JDK Sourcing Ltd. | split |
| jms-clothing | `1579` | JMS Clothing Ltd. | `1398` | JMS International | split |
| jns-knitwear | `general:6475` | Jns Knitwear Ltd. | `890` | JNS Knitwear Ltd. | merge |
| kl-fashion | `general:5621` | KL Fashion Ltd. | `119` | K.L. International Ltd. | split |
| kgs-sourcing-ltd-redcats | `549` | KGS Sourcing Ltd (Redcats ). | `916` | Otto Int'l (Hong Kong) Limited Bangladesh | split |
| knit-fair | `general:5902` | Knit Fair Ltd. | `152` | Knit Fair | merge |
| kenpark-bangladesh | `general:2197` | Kenpark Bangladesh (Pvt) Ltd. | `general:4572` | Kenpark Bangladesh Apparel (Pvt) Ltd. | split |
| kento-asia | `general:4466` | Kento Asia Ltd. | `537` | Kento Asia Ltd. | merge |
| khan-sourcing-bd | `1305` | Khan Sourcing (BD) Ltd. | `955` | Khan Sourcing | split |
| knit-collection | `954` | Knit Collection Limited | `1137` | Knit Collection | merge |
| libas-knitwear | `general:5089` | Libas Knit Wear Ltd. | `175` | Libas International Ltd. | split |
| libas-stitch | `general:5977` | Libas Stitch | `525` | Lawyee Apparel Exports Ltd. | split |
| le-nouveautex | `general:2125` | Le Nouveautex (Pvt) Ltd. | `general:4800` | Le-Nouveautex Knit Fashion | split |
| m-and-z | `91` | M & Z Co. Ltd. | `1677` | M & Z Sourcing BD | split |
| matrix-dresses | `general:7008` | Matrix Dresses | `general:5471` | Matrix Dresses Ltd. | merge |
| md-tex | `1211` | MD Tex | `1556` | Sunrise Apparel BD | split |
| mahmud-fashion | `general:6303` | Mahmud Fashion Ltd. | `503` | Mahmud Enterprise | split |
| mak-tex-international | `1213` | Mak Tex International Inc. | `237` | Tex Mark | split |
| mark-fashion-wear-pvt-ltd-u-2 | `general:955` | Mark Fashion Wear (Pvt.) Ltd. (U-2) | `general:374` | Mark Fashion Wear (Pvt). Ltd. | split |
| mass-fashion-bd | `general:6753` | Mass Fashion BD | `general:740` | Mass Fashion Ltd. | split |
| matrix-apparels | `general:6435` | Matrix Apparels Ltd. | `968` | Matrix Sourcing Ltd. | split |
| mega-merchandising | `1083` | Mega Merchandising Company Ltd. | `1082` | Winsome Sourcing | split |
| merchantex-co-bd | `125` | Merchantex Co. (BD) Ltd. | `1370` | Merchantex International | split |
| midasia-designers | `390` | Midasia Designers Ltd. | `393` | Studio Max Mazza | split |
| mirza-fashion-and-design | `836` | Mirza Fashion & Design | `331` | Union Fashion | split |
| mirza-fashion-and-design | `836` | Mirza Fashion & Design | `779` | Union Trade Impex Limited | split |
| mustang-associates | `791` | Mustang Associates Ltd. | `11` | Mustang International Limited | split |
| mustex-sourcing | `1371` | Mustex Sourcing | `1382` | Textiss Bangladesh | split |
| needle-thread | `1088` | Needle Thread Pvt. Ltd. | `1463` | WIKITEX - BD | split |
| next-apparels | `1523` | Next Sourcing Services Limited | `1115` | Next Sourcing Ltd. | split |
| naba-apparel | `general:1623` | Naba Apparels Ltd. | `951` | Naba Apparel Inc. | merge |
| new-wave-group-ab | `619` | New Wave Group AB | `1498` | New Wave Group SA | merge |
| nisha-trade-international | `20` | Nisha Trade International | `1506` | Nisha Fashions Wear | split |
| novatex-international | `273` | Novatex International | `278` | Pacers International | split |
| pavel-fashion | `1273` | Pavel Style (BD) Ltd. | `1266` | Pavel Sourcing (BD) Ltd. | split |
| prominent-apparels | `general:5917` | Prominent Apparels Ltd. | `general:2348` | Prominent Apparels | merge |
| panache-international | `12` | Panache International Limited | `255` | Panache Pvt. Ltd. | split |
| penny-design | `1133` | Penny Design Limited | `general:5837` | Penny Design Knitwear | split |
| perfect-fashion | `general:4602` | Perfect Fashion | `25` | Perfect Fashion | merge |
| postex | `585` | Postex Ltd. | `377` | RMT Corporation Ltd. | split |
| preston-france-bd | `604` | Preston France (BD) Limited | `266` | Square Int. Inc. | split |
| protex-international | `150` | Protex International | `242` | Protex Enterprise Co. Ltd. | split |
| quattro-fashion | `general:6428` | Quattro Fashion Ltd. | `319` | Quatro International | split |
| qtex-merchandising | `244` | Qtex Merchandising Ltd. | `1210` | Qtex Merchandising | merge |
| ra-apparels | `601` | R.A. Trading Limited | `1114` | A.R. Apparel Sourcing | split |
| ra-apparels | `601` | R.A. Trading Limited | `330` | A.R. Fashion | split |
| rr-apparels | `general:6714` | RR Apparels | `general:4171` | R.R. Apparels Ltd. | merge |
| ratool-apparels | `general:5351` | Ratool Apparels Ltd. | `1550` | Ratool Sourcing | split |
| ritzy-apparels | `general:4176` | Ritzy Apparels Ltd. | `620` | Ritzy Apparels | merge |
| rainbow-tex | `195` | Rainbow Tex | `732` | Stayn Unn | split |
| remix-collections | `general:7101` | Remix Collections Ltd. | `1510` | Remix Collections | merge |
| rhyam-international | `108` | Rhyam International Ltd. | `240` | Rhyme Trading | split |
| rich-cotton-apparels | `general:6796` | Rich Cotton Apparels Limited | `1445` | Rich Cotton Limited | split |
| rosemary | `36` | Rosemary Limited | `154` | Simtrade Limited | split |
| s-asia-high-lights | `762` | S Asia High Lights | `769` | Zzan Design Ltd. | split |
| sk-apparels | `general:5781` | SK Apparels Ltd. | `1190` | S.K. Fashion | split |
| section-seven-apparels | `general:5045` | Section Seven Apparels Ltd. | `general:4298` | Section Seven Ltd. | split |
| standard-stitches | `general:5350` | Standard Stitches Ltd | `general:5663` | Standard Stitches Ltd. (Woven Unit) | split |
| saf-apparel-bd | `1227` | Saf Apparel BD Ltd. | `939` | SAF International | split |
| sagacious-fashions | `general:6126` | Sagacious Fashions Ltd. | `1146` | Sagacious Fashions Limited | merge |
| sarah-knitwear | `general:4616` | Sarah Knit Wear | `999` | Sarah Knit Wear | merge |
| scandex-bd | `general:3571` | Scandex (BD) Ltd. | `30` | Scandex Fashion Ltd. | split |
| shan-global | `1411` | Shan Global Company | `1477` | Shan International Trading Company | split |
| shangu-tex | `general:3333` | Shangu Tex Ltd. | `general:4669` | Shangu Tex Ltd.-2 | split |
| spark-international | `1415` | Spark International | `1660` | Styelaa Fashion (Pvt.) Limited | split |
| styleelite | `1448` | Styleelite Limited | `1447` | White Swan Limited | split |
| sunwah-textile-international | `117` | Sunwah Textile International Co., Ltd. | `118` | Tex Well International Co. Ltd. | split |
| tex-mart | `645` | Tex Mart Apparels | `1581` | Tex-Mart International | split |
| the-fashion-island | `general:2534` | The Fashion Island Ltd. | `1128` | Riviera Resources Ltd. | split |
| the-fashion-island | `general:2534` | The Fashion Island Ltd. | `326` | Riviera International Ltd. | split |
| tokio-mode | `general:2394` | Tokio Mode Limited | `373` | Tokio Mode Ltd. | merge |
| total-fashion | `general:4464` | Total Fashion Ltd. | `983` | Total Sourcing | split |
| tabassum-trade-international | `general:4888` | Tabassum Trade International | `950` | Tabassum Trade International | merge |
| tamishna-apparels | `general:5047` | Tamishna Apparels Ltd. | `612` | Tamishna Apparels Ltd. | merge |
| tashfia-export | `general:6958` | Tashfia Export | `1569` | Tashfia Export | merge |
| tex-design | `972` | Tex Design | `1375` | Tex-Design Sourcing Limited | split |
| tex-design | `972` | Tex Design | `848` | Tex Design | merge |
| texel | `13` | Texel Limited | `1029` | Texel Limited . | merge |
| teximco-bd | `1549` | Teximco (BD) Ltd. | `1087` | Teximco (BD) | merge |
| textile-apparel-sourcing | `1117` | Textile Apparel Sourcing Corp. | `1431` | Textile Sourcing | split |
| the-civil-engineers | `general:3041` | The Civil Engineers Ltd. | `general:4834` | The Civil Engineers Ltd. (Sw Unit) | split |
| the-shanin | `general:872` | The Shanin Corporation Ltd. | `general:2247` | The Shanin Ltd. | merge |
| trigon-merchandising | `1188` | Trigon Merchandising Corporation Ltd. | `978` | Trigon Merchandising Services (Pvt.) Ltd. | split |
| univogue-garments | `general:424` | Univogue Garments Co. Ltd. | `general:2436` | Univogue Garments Co. Ltd. Unit-II | split |
| viyellatex | `general:4127` | Viyellatex Ltd. | `general:6510` | Viyellatex Apparels Ltd. | split |
| vintage-denim-apparels | `general:6213` | Vintage Denim Apparels Ltd. | `general:4562` | Vintage Denim Ltd. | split |
| welldone-apparel | `general:3010` | Welldone Apparel Ltd. | `38` | Welldone (BD) Ltd. | split |
| western-dresses | `general:2001` | Eastern Dresses Ltd. | `general:1179` | Western Dresses Ltd. | merge |
| young-fashion | `general:1996` | Young Fashion (Pvt) Ltd. | `772` | Young Fashion Ltd. | merge |
| z7-apparels | `1562` | Z7 Apparels Ltd. | `1561` | ZXY International DMCC | split |
| z7-apparels | `1562` | Z7 Apparels Ltd. | `1563` | ZXY International FZCO | split |
| z7-apparels | `1562` | Z7 Apparels Ltd. | `17` | ZXY Apparel Buying Solutions Ltd. | split |
