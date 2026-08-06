# Do published BGMEA registrations name the supplier showing them?

Re-measured against `ops/plans/bgmea-names.json`, which recovered the
registered name for both BGMEA registers. REZ-102 reported these same
counts against the associate register only, so its figures were a floor.

## Coverage

| measure | count |
| -- | -- |
| published suppliers holding a BGMEA record | 5740 |
| BGMEA records on them | 5970 |
| records whose registered name is now known | 5962 (99.9%) |
| records still without a name | 8 |

## Verdicts

| measure | count |
| -- | -- |
| records naming their supplier | 5756 |
| records naming someone else | **206** |
| suppliers where every record names someone else | **53** |
| suppliers where at least one record does | **176** |
| suppliers fully clean | 5559 |

## Display-rule options, re-costed

The spread between fail-open and fail-closed was previously an artefact
of missing names, not of disagreement. With the register named, the two
readings converge and the choice is far less consequential.

| option | numbers removed | suppliers losing a number | suppliers losing the pill |
| -- | -- | -- | -- |
| (i) status quo | 0 | 0 | 0 |
| (ii-open) unknown names pass | 206 | 176 | 53 |
| (ii-closed) unknown names fail | 214 | 184 | 58 |

## Suppliers whose every BGMEA record names another company (53)

REZ-102 measured 50 of these and said it was a floor. This is the figure
with both registers named.

| supplier | shows | registered to |
| -- | -- | -- |
| `ags-apparels` — Ags Apparels Ltd | 1204 | AGS Fashion Ltd. |
| `ags-apparels` — Ags Apparels Ltd | 930 | Saint Martin Apparels |
| `al-baraka-apparels` — AL-BARAKA APPARELS | 504 | Al-Baraka Trading |
| `amh-apparels` — AMH APPARELS LIMITED | 1652 | AMH Corporation |
| `as-knitwear` — A.S KNITWEAR | 953 | A. S. Fashion |
| `as-knitwear` — A.S KNITWEAR | 528 | S.A. Fashion |
| `asdwa-fashion` — ASDWA FASHION LTD. | 797 | Fashion Comfort (BD) Ltd. |
| `authentic-knitwear` — Authentic knitwear ltd. | 840 | Authentic Fashion International |
| `color-city` — COLOR CITY LTD. | 687 | Atelier Sourcing Ltd. |
| `desh-bangla-enterprise` — DESH BANGLA ENTERPRISE | 1573 | Bangladesh Apparel Inc. |
| `dk-knitwear` — DK KNIT WEAR LTD | 778 | DK Design Ltd. |
| `dk-knitwear` — DK KNIT WEAR LTD | 478 | DK Collection |
| `dk-knitwear` — DK KNIT WEAR LTD | 35 | DK Textile Ltd. |
| `dk-knitwear` — DK KNIT WEAR LTD | 1314 | L. A. T Sportwear Ltd. |
| `doel-associate` — DOEL ASSOCIATE LTD. | 1403 | Doel Sourcing Ltd. |
| `fariha-fashion` — FARIHA FASHION LTD. | 1669 | Flaxen Fashionwears Limited |
| `fariha-fashion` — FARIHA FASHION LTD. | 1362 | T.S.A. Bangladesh |
| `friends-world-composite-industries-ltd-unit-2` — FRIENDS WORLD COMPOSITE IND. LTD (UNIT-2) | general:3673 | Friends World Composite Inds. Ltd. |
| `global-knitwear` — Global Knitwear Ltd. | 946 | Global Apparel Sourcing Ltd. |
| `global-knitwear` — Global Knitwear Ltd. | 543 | Global Fashion |
| `global-knitwear` — Global Knitwear Ltd. | 914 | Global Textile Sourcing Limited |
| `gm-fashion` — GM FASHION | general:3624 | Southeast Sweaters Ltd. |
| `helix-garments` — HELIX GARMENTS LIMITED. | 142 | Heliix Limited |
| `hp-chemical` — H.P. CHEMICAL LTD | 1124 | Orient Crafts Ltd. |
| `jm-knitwear` — J. M. KNITWEAR LTD. | 423 | J.M. Export Ltd. |
| `jm-knitwear` — J. M. KNITWEAR LTD. | 422 | Reglisse |
| `just-knitwear` — JUST KNITWEAR LTD | 1416 | Just Group Bangladesh Ltd. |
| `kader-knitwear` — KADER KNITWEAR | 144 | Kader International |
| `manha-attires-composite` — MANHA ATTIRES COMPOSITE LTD. | 1454 | Manha Apparels Limited |
| `mars-fashion` — MARS FASHION | 421 | Mars Associates |
| `mastex-designers` — MASTEX DESIGNERS LTD. | 293 | Mastex |
| `mh-apparels` — M. H APPARELS LTD | 1437 | M.H. Import Export |
| `minar-textile` — MINAR TEXTILE | general:698 | Minar Textiles (Garments Div.) |
| `moon-knitwear` — MOON KNITWEAR | 1081 | Moon Apparels Limited |
| `ms-fashion-wear` — M. S. FASHION WEAR | 1283 | Mim Fashion wear's |
| `multi-style-custome` — MULTI STYLE CUSTOME | 74 | Reliance Fashions Ltd. |
| `next-apparels` — NEXT APPARELS | 1115 | Next Sourcing Ltd. |
| `next-apparels` — NEXT APPARELS | 1523 | Next Sourcing Services Limited |
| `nm-fashion` — N.M. FASHION | 1129 | M.N. Enterprise |
| `pa-textile` — P. A. TEXTILE LTD. | 1168 | P.A. Fashion Ltd. |
| `paramount-apparels` — PARAMOUNT APPARELS LTD | 65 | Paramount International |
| `pavel-fashion` — PAVEL FASHION LTD. | 1266 | Pavel Sourcing (BD) Ltd. |
| `pavel-fashion` — PAVEL FASHION LTD. | 1273 | Pavel Style (BD) Ltd. |
| `perfoace-knitwear` — PERFOACE KNITWEAR LTD. | 871 | Perfoace Fashion Apparel (Pvt.) Ltd. |
| `ra-apparels` — R. A. APPARELS LTD | 1114 | A.R. Apparel Sourcing |
| `ra-apparels` — R. A. APPARELS LTD | 330 | A.R. Fashion |
| `ra-apparels` — R. A. APPARELS LTD | 601 | R.A. Trading Limited |
| `raz-apparels` — R. A. Z APPARELS. | 1604 | A.R.Z Sourcing BD |
| `red-dot-apparels` — RED DOT APPARELS LTD. | 1092 | Universal Sourcin BD |
| `sadia-knit-composite` — SADIA KNIT COMPOSITE (PVT) LTD. | 990 | Islam Trading Corporation |
| `sakib-knitwear` — SAKIB KNITWEAR | 1631 | Sakib Apparels Limited |
| `sara-fashion` — SARA FASHION (PVT) LTD. | 1639 | Sara Sourcing Ltd. |
| `shan-knitting-and-processing` — SHAN KNITTING & PROCESSING LTD. | 296 | Maxim International |
| `sohel-knitwear` — SOHEL KNITWEAR (PVT) LTD | 135 | Sohel International |
| `spicy-fashion` — SPICY FASHION LTD. | 227 | Spicy Bangladesh Ltd. |
| `sr-apparels` — S. R. APPARELS. | 1209 | R. S. Corporation |
| `suntex-apparels-bd` — SUNTEX APPARELS (BD) LTD | 1064 | Suntex International |
| `tamanna-apparels` — TAMANNA APPARELS LTD | 468 | Tamanna International Ltd. |
| `tandem-fashion` — Tandem Fashion Ltd | 69 | Tandem Limited |
| `techno-knitwear` — TECHNO KNITWEAR (PVT.) LIMITED. | 310 | Techno Apparels |
| `ten-cate-permess-interlining-bd` — TEN CATE PERMESS INTERLINING (BD) LTD. | 159 | Oyon Design |
| `tex-apparels` — TEX APPARELS | 1261 | Tex Fashion (BD) |
| `that-it-fashion` — That's It Fashion Ltd | 1014 | That's It Limited |
| `unitex-knitwear` — UNITEX KNITWEAR LTD | 402 | Unitex |
| `universal-trims` — UNIVERSAL TRIMS | 846 | Universal Fashion Club |
| `vogue-axis-associates` — VOGUE AXIS ASSOCIATES LTD. | 508 | Vogue Axis |

## Suppliers holding a mix (123)

At least one record names them and at least one names someone else.
These are the group-of-companies shape REZ-102 examined: the row is a
real company, but it carries registrations that are not its own.

| supplier | foreign registration | registered to |
| -- | -- | -- |
| `4a-yarn-dyeing` — 4A YARN DYEING LTD. | general:3778 | South End Sweater Co. Ltd. |
| `a-and-c-bd` — A & C (BD) Ltd. | 901 | C & A Sourcing International Ltd. |
| `abid-export` — Abid Export Ltd. | 1545 | Off Price Clothing |
| `abid-export` — Abid Export Ltd. | 1546 | Trade Evidence |
| `abloom` — Abloom Limited | 754 | Park Mode Wear Ltd. |
| `aesthetic-apparel` — Aesthetic Apparel | 1659 | Suxes Attires Ltd. |
| `alex-bangladesh` — Alex Bangladesh | 1018 | Alex Fashion |
| `ams-fahion-house` — AMS Fahion House | 369 | Best Buy International Knit Wears |
| `anam-garments` — ANAM GARMENTS LTD. | 909 | Texture BD |
| `anzir-apparels` — Anzir Apparels Ltd. | general:3843 | Anzir Apparels Ltd. (U-2) |
| `apparel-trade-international` — Apparel Trade International | 207 | Triangle Venture Ltd. |
| `aries` — Aries Corporation | 89 | Exo Bangladesh |
| `artistic-apparels` — ARTISTIC APPARELS LTD. | 644 | Aartistic International |
| `atima-fashions` — Atima Fashions Ltd. | 679 | Atima Knitwear Ltd. |
| `attraction-garments` — ATTRACTION GARMENTS LTD. | 637 | Tejgaon Eminent Fashion Ltd. |
| `awss-fashions` — Awss Fashions Ltd. | 42 | Awss (BD) Limited |
| `ayesha-fashion` — Ayesha Fashion Limited | 1640 | Ayesha Trading |
| `b-brothers-garments` — B.Brothers Garments Co. Ltd. | general:3647 | B. Brothers Garments Co. Ltd.(U-2) |
| `bangladesh-dresses` — Bangladesh Dresses Limited | general:2431 | Bangladesh Dresses Ltd.(Unit-2) |
| `basic-apparels` — Basic Apparels Ltd. | 88 | Basic Fashion |
| `bd-tex` — BD TEX | 664 | BD-Tex Sourcing |
| `bd-tex` — BD TEX | 1440 | BD-Tex Apparels Ltd. |
| `blue-avenue-clothing` — Blue Avenue Clothing Ltd. | 458 | Feed Back Clothing Co. |
| `blue-avenue-clothing` — Blue Avenue Clothing Ltd. | 196 | RS Collection |
| `blue-bird-fashion` — Blue Bird Fashion | 600 | Blue Bird Attire Ltd. |
| `blue-bird-fashion` — Blue Bird Fashion | 781 | Zaima Fashion |
| `bodystretch-bangladesh` — Bodystretch Bangladesh Ltd. | 929 | Trybe Bangladesh Limited |
| `bonny-apparels` — Bonny Apparels (Pvt) Ltd. | general:3051 | Bonny Apparels (Pvt) Ltd.(U-2) |
| `bright-tex-trading` — Bright Tex Trading Corporation | 1359 | Texsport Trading Corporation |
| `caretex-sourcing` — Caretex Sourcing Ltd. | 913 | Caretex |
| `caretex-sourcing` — Caretex Sourcing Ltd. | 1404 | Tex Care |
| `channel-expor-tex-international` — Channel Expor-tex International | 460 | HM Textile |
| `city-import` — City Import | 690 | City Apparel-Tex Co. (CATCO) |
| `classic-fashion` — CLASSIC FASHION | 1256 | Classic Fashion Sourcing |
| `classic-fashion` — CLASSIC FASHION | 68 | Classic International (Pvt.) Ltd. |
| `classic-fashion` — CLASSIC FASHION | 67 | Match International (Pvt.) Ltd. |
| `coast-to-coast` — COAST TO COAST (PVT.) LTD. | general:3070 | Coast To Coast Apparels Ltd. |
| `coast-to-coast` — COAST TO COAST (PVT.) LTD. | general:2768 | Coast To Coast Fashion Ltd. |
| `coop-global-sourcing` — Coop Global Sourcing Limited | 1443 | Coop Trading BD |
| `creative-sweater` — Creative Sweaters (Pvt.) Ltd. | general:3346 | Creative Sweaters (Pvt) Ltd.(U-2) |
| `cut-n-sew` — Cut N Sew Ltd. | general:5756 | Snowtex Outerwear Ltd. |
| `danny-dhaka` — Danny Dhaka Ltd. | 53 | Kam Knit |
| `dekko-knitwear` — DEKKO KNITWEARS LTD. | general:3294 | Dekko Knitwears Ltd. (Unit-2) |
| `designtex-knitwear` — Designtex Knitwear Ltd. | 23 | Designtex Ltd. |
| `dhaka-natex-sourcing` — Dhaka Natex Sourcing Ltd. | 1196 | Natex Bangladesh Limited |
| `dhaka-natex-sourcing` — Dhaka Natex Sourcing Ltd. | 1464 | Natex of Scandinavia A/S Bangladesh |
| `dinatex-international` — Dinatex International Ltd. | 60 | Landmark Designs Ltd. |
| `divine-textile` — DIVINE TEXTILE LTD | 651 | Divine Sourcing Ltd. |
| `dressytex` — Dressytex | 1040 | Dresstex Bangladesh |
| `echo-sourcing` — Echo Sourcing (Pvt.) Ltd. | 97 | Quality Assured Ltd. |
| `elham-international` — Elham International Ltd. | 944 | Ejahar Brother's & Garments Ltd. |
| `elham-international` — Elham International Ltd. | 1277 | Elham Sourcing Ltd. |
| `etam-international-l-sourcing-shanghai` — Etam Int'l Sourcing (Shanghai) Co. Ltd. | 1591 | Fashion Theory Ltd. |
| `euro-point` — Euro Point Ltd. | 106 | Unistar Distribution Company (BD) Ltd. |
| `eurotex-fashion` — EUROTEX FASHION LTD. | 668 | Euro Tex |
| `eurotex-fashion` — EUROTEX FASHION LTD. | 1159 | Eurotex International |
| `eurotex-fashion` — EUROTEX FASHION LTD. | 695 | Euro Tex International |
| `eurotex-fashion` — EUROTEX FASHION LTD. | 697 | Top Grade International Enterprise Ltd. |
| `explore-fashion` — Explore Fashion Ltd. | 1668 | Xplore Sourcing |
| `fashion-create` — Fashion Create | general:3598 | Fashion Create Apparels Ltd. |
| `fashion-flow-apparels` — FASHION FLOW APPARELS LTD. | 1267 | Fashion Flow Limited |
| `fashion-xpress` — Fashion Xpress Ltd. | 580 | Map Tex |
| `fashion-zone-international` — Fashion Zone International | 935 | Knit Wear Creator Ltd. |
| `floreal-international` — Floreal International Ltd. | 1039 | Walther & Walther International |
| `garib-and-garib` — Garib & Garib Co. Ltd. | general:3302 | Garib & Garib Co. Ltd. (Unit-2) |
| `gemtex-sourcing` — Gemtex Sourcing Ltd. | 1686 | Tex Stitch Concept Limited |
| `gilco-fashion` — Gilco Fashion Ltd. | 239 | Gilco Industries Ltd. |
| `global-usa` — Global USA Ltd. | 1012 | Price Club General Trading Ltd. |
| `golden-tex` — Golden Tex | 1342 | Golden Touch |
| `grassy` — Grassy | 141 | Mum Fashion Merchandising Ltd. |
| `grs-sourcing` — GRS Sourcing Ltd. | 1435 | H.R.M. Sourcing Ltd. |
| `hmn-fashion` — HMN FASHION LTD. | 507 | Jenable Textile Ltd. |
| `impression-design` — Impression Design | 1568 | Impression Sourcing & Design Limited |
| … and 63 more suppliers | | |

## What this is not

A name disagreement is evidence that a registration sits on the wrong
row, not proof of it. A group of companies can legitimately register
several arms, and REZ-102 showed the name stems do not predict which
case a row is. Nothing here should be repaired without the premises and
switchboard test that report applies.
