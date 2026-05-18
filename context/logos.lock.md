# SourceBD — Logos & Asset Lock

> **Status:** Phase 0 (data moat). This file is the **registry contract** for
> every source mark, certification mark, and brand wordmark that will appear
> in the SourceBD UI. It does **not** create assets — it defines what assets
> must exist before any UI ships, what they look like, and where they live.
>
> Treat this like a dependency lockfile: every external mark referenced in
> the product MUST be listed here with a verified source URL and licence
> note. No row → no render.

---

## 1. Visual contract (locked)

| Property | Value |
|---|---|
| Frame shape | Square, 6 px corner radius |
| Frame sizes | `xs` 16×16 · `sm` 20×20 · `md` 32×32 (no other sizes) |
| Mark padding inside frame | xs 2 px · sm 3 px · md 5 px |
| Default mark colour (light) | `--ink-700` (≈ `#1F2937`) |
| Default mark colour (dark) | `--ink-100` (≈ `#F3F4F6`) |
| Original brand colour | **Only** in source-detail drawer at `md` size, on `#FFFFFF` card |
| Frame background (light) | `--surface-50` (≈ `#F9FAFB`) |
| Frame background (dark) | `--surface-800` |
| Frame hairline | 1 px `--ink-200` @ 30 % opacity |
| Stale state (>90 days since refresh) | 60 % opacity |
| Tier ring | 1 px outer ring, **only on `sm` and `md`**, colour by tier (table below) |
| Hover (clickable source pill only) | mark → `--ink-900` |
| Animation | logos themselves never animate; **only the tier ring may pulse** for max 3 cycles when a fresh refresh just landed |
| Accessibility | every mark wrapped with `role="img"` + `aria-label="Source: <full display name>"` |
| Reduced motion | all motion honours `prefers-reduced-motion` |

### Tier ring colour map

| `tier` (DB value) | Display label | Ring token | Means |
|---|---|---|---|
| `tier1_gov` | Government | `--green-600` | Statutory authority / ministry-level register |
| `tier2_industry` | Trade association | `--green-500` | Industry membership register |
| `tier3_cert` | Certification body | `--blue-500` | Independent third-party audit |
| `tier4_brand` | Brand disclosure | `--amber-500` | Buyer-published supplier list (self-reported) |
| `tier5_regulatory` | Regulatory / sanctions | `--red-500` | Negative-screening source (UFLPA, OFAC, etc.) |
| `tier6_crosscheck` | Cross-check only | `--ink-300` | Corroboration only — never primary evidence |

### External vs. own metadata — the one rule

> **If it has a frame, it's an external authority. If it's a stroke icon (no
> frame), it's SourceBD's own metadata** (product category, MOQ, tier badge,
> verified/stale state, etc.).

Stroke pack is a single Lucide-family set, 24×24 grid, 1.5 px stroke,
`--ink-500` default, `--brand-600` active. **Never mix two icon families.**

### Buyer brand names — typography only

Buyer brands (H&M, Inditex, Primark, …) are **never** rendered as logos.
Use `<BrandWordmark name="H&M" />` which prints the brand name in our
display font at the surrounding x-height. This sidesteps trademark
imitation risk entirely while keeping recognition.

---

## 2. Asset filesystem layout

```
public/icons/
├── sources/
│   ├── regulatory/    ← tier1_gov, tier5_regulatory (gov seals)
│   ├── associations/  ← tier2_industry
│   ├── cert/          ← tier3_cert
│   └── brands/        ← tier4_brand (RESERVED — typography wordmarks preferred)
├── meta/              ← SourceBD's own stroke icons (Lucide-family, no frame)
└── brand/             ← SourceBD flame, full-colour, hero use only
```

Each external mark ships as **two files** keyed by source `code`:

```
{code-lower}.svg         ← monochrome silhouette (default render)
{code-lower}-color.svg   ← original colour (drawer only, md size only)
```

Example: `bgmea.svg`, `bgmea-color.svg`.

---

## 3. Source registry — authoritative list

Generated from the `public.sources` table on 2026-05-14 (18 rows). Any new
ingest source MUST add a row here in the same migration that adds it to
the `sources` table. **Status legend:** `pending` = no asset yet ·
`drafted` = SVG in repo, awaiting design review · `locked` = approved.

### Tier 1 — Government

| code | Display name | Official URL (asset source) | Asset path (mono / colour) | Licence note | Status |
|---|---|---|---|---|---|
| `BEPZA` | Bangladesh Export Processing Zones Authority | https://www.bepza.gov.bd | `sources/regulatory/bepza.svg` / `…-color.svg` | Bangladesh govt seal — public domain for non-misleading use | pending |
| `DIFE` | Dept of Inspection for Factories & Establishments | https://dife.gov.bd | `sources/regulatory/dife.svg` / `…-color.svg` | Bangladesh govt seal — public domain for non-misleading use | pending |
| `EPB` | Export Promotion Bureau | https://epb.gov.bd | `sources/regulatory/epb.svg` / `…-color.svg` | Bangladesh govt seal — public domain for non-misleading use | pending |
| `RJSC` | Registrar of Joint Stock Companies | https://www.roc.gov.bd | `sources/regulatory/rjsc.svg` / `…-color.svg` | Bangladesh govt seal — public domain for non-misleading use | pending |
| `RSC` | RMG Sustainability Council | https://rsc-bd.org | `sources/regulatory/rsc.svg` / `…-color.svg` | Industry-statutory body; mark used under nominative fair use | pending |

### Tier 2 — Trade associations

| code | Display name | Official URL (asset source) | Asset path (mono / colour) | Licence note | Status |
|---|---|---|---|---|---|
| `BGMEA` | Bangladesh Garment Manufacturers & Exporters Assoc. | https://www.bgmea.com.bd | `sources/associations/bgmea.svg` / `…-color.svg` | Trade-association mark, nominative fair use | pending |
| `BKMEA` | Bangladesh Knitwear Manufacturers & Exporters Assoc. | https://www.bkmea.com | `sources/associations/bkmea.svg` / `…-color.svg` | Trade-association mark, nominative fair use | pending |
| `BTMA` | Bangladesh Textile Mills Association | https://btmadhaka.com | `sources/associations/btma.svg` / `…-color.svg` | Trade-association mark, nominative fair use | pending |
| `BGAPMEA` | Bangladesh Garment Accessories & Packaging MEA | https://bgapmea.org | `sources/associations/bgapmea.svg` / `…-color.svg` | Trade-association mark, nominative fair use | pending |

### Tier 3 — Certification bodies

| code | Display name | Official URL (asset source) | Asset path (mono / colour) | Licence note | Status |
|---|---|---|---|---|---|
| `WRAP` | Worldwide Responsible Accredited Production | https://wrapcompliance.org | `sources/cert/wrap.svg` / `…-color.svg` | Cert mark, nominative fair use; do **not** display "WRAP-Certified" badge variants — use the corporate mark only | pending |
| `BSCI` | amfori BSCI | https://www.amfori.org | `sources/cert/bsci.svg` / `…-color.svg` | "amfori BSCI" wordmark; cert is amfori's, used nominatively | pending |
| `OEKO_TEX` | OEKO-TEX | https://www.oeko-tex.com | `sources/cert/oeko-tex.svg` / `…-color.svg` | Cert wordmark, nominative use only — never the "STANDARD 100 by OEKO-TEX" hangtag | pending |
| `GOTS` | Global Organic Textile Standard | https://global-standard.org | `sources/cert/gots.svg` / `…-color.svg` | Cert mark, nominative fair use | pending |

### Tier 4 — Brand disclosures (RESERVED)

> **Authenticity rule (hard):** a `BRAND_*` source pill is permitted on a
> supplier profile **only when the brand's own publication names that
> specific factory** (tabular supplier list, interactive-map detail card,
> or sustainability page mentioning the factory by name). A brand-wide
> Modern Slavery Statement is **not** per-factory evidence and must not
> attach to any supplier row, no matter how official the document.
> **Render strategy:** typography wordmark, no SVG.

| code | Display name | Render | Status |
|---|---|---|---|
| `BRAND_HM` | H&M Group supplier list | `<BrandWordmark name="H&M" />` | active (Spec 09, 188 BD suppliers named in published XLSX) |
| `BRAND_INDITEX` | Inditex supplier list | `<BrandWordmark name="Inditex" />` | reserved (deep probe 2026-05-19 confirms inditex.com publishes no per-factory list: `/sustainability` hub enumerates 38 policy/report PDFs with zero supplier-list titles; sibling URLs `/transparency`, `/our-workers`, `/who-makes-our-products`, `/reporting`, `/people-in-our-supply-chain` all return generic SPA shells; deep PDF inspection of 2025 Sustainability Report (165pp), Workers at the Centre 2023 (84pp), MSS FY24 (15pp) yields 0 keyword hits for "list of suppliers / factory list / who makes our" and 0 tabular per-factory rows. Inditex discloses per-factory only via Open Supply Hub (third-party). Activation would require either a policy decision to accept OSH as authoritative, or a future inditex.com surface change.) |
| `BRAND_PRIMARK` | Primark supplier list | `<BrandWordmark name="Primark" />` | reserved (MSS mirrored but names no factories — no per-supplier attribution; awaiting factory-map detail-card scrape) |
| `BRAND_ASOS` | ASOS supplier list | `<BrandWordmark name="ASOS" />` | active (factory list April 2026 PDF, 44 BD suppliers named — `asosplc.com/sustainability/supply-chain-and-policies/` → `/media/cmzk3m5n/factory-list-april-2026.pdf`, refreshed quarterly; mirrored at `brand-disclosures/brand_asos/2026-04-01.pdf`) |
| `BRAND_MS` | Marks & Spencer supplier list | `<BrandWordmark name="M&S" />` | reserved (interactive supplier-map widget — bespoke map-API client required) |
| `BRAND_NEXT` | Next supplier list | `<BrandWordmark name="Next" />` | reserved (MSS mirrored but names no factories — no per-supplier attribution; awaiting Tier-1 supplier-list page scrape) |

### Tier 5 — Regulatory / sanctions

| code | Display name | Official URL (asset source) | Asset path (mono / colour) | Licence note | Status |
|---|---|---|---|---|---|
| `OFAC` | US OFAC SDN List | https://sanctionssearch.ofac.treas.gov | `sources/regulatory/ofac.svg` / `…-color.svg` | US Treasury seal — federal work, not subject to copyright; display mono to avoid implying official endorsement | pending |
| `UFLPA` | US CBP UFLPA Entity List | https://www.cbp.gov/trade/forced-labor/UFLPA | `sources/regulatory/cbp.svg` / `…-color.svg` (shared with `US_WRO`) | US CBP seal — federal work, not subject to copyright | pending |
| `US_WRO` | US CBP Withhold Release Orders & Findings | https://www.cbp.gov/trade/forced-labor/withhold-release-orders-and-findings | `sources/regulatory/cbp.svg` / `…-color.svg` (shared with `UFLPA`) | Same CBP seal as UFLPA; one asset, two source codes | pending |
| `UK_OFSI` | UK OFSI Consolidated Sanctions | https://www.gov.uk/government/publications/financial-sanctions-consolidated-list-of-targets | `sources/regulatory/uk-ofsi.svg` / `…-color.svg` | UK Crown copyright — Open Government Licence v3.0; mono render preferred to avoid implying HMG endorsement | pending |
| `EU_SANC` | EU Sanctions Map | https://www.sanctionsmap.eu | `sources/regulatory/eu.svg` / `…-color.svg` | EU emblem — usage governed by Council Regulation; mono only, never as primary visual element | pending |

---

## 4. SourceBD's own marks

| Asset | Path | Use |
|---|---|---|
| Flame logomark, full colour | `brand/sourcebd-mark.svg` | Hero, footer, favicon — the only mark allowed >32 px |
| Flame logomark, mono | `brand/sourcebd-mark-mono.svg` | When laid over imagery / coloured ground |
| Wordmark, "SourceBD" | `brand/sourcebd-wordmark.svg` | Nav, email signature |
| Stroke icon set | `meta/*.svg` | All product metadata icons (Lucide family, 1.5 px stroke, 24 grid, no frame) |

---

## 5. Hard rules (do not break)

1. **No row in this file → no render in product.** PR review will reject any
   commit that uses an external mark not listed here.
2. **Never modify a third-party mark** beyond the documented mono/colour
   reduction. No re-coloring to brand palette, no rotating, no overlaying.
3. **Never use any external mark in marketing surfaces** (hero, CTA, ad
   creative, social card, deck cover). Source pills appear only on
   product surfaces where they identify the actual source of a fact.
4. **Tier 4 brand wordmarks are typography**, not SVG. If a designer
   exports an SVG for a brand wordmark, reject the PR.
5. **Footer must include** `/legal/trademarks` linking to:
   > "All third-party trademarks shown on supplier profiles belong to
   > their respective owners and are used solely to identify the source
   > of publicly available data. SourceBD is not affiliated with,
   > endorsed by, or sponsored by any of these organisations."
6. **`*-color.svg` files render only inside the source-detail drawer** at
   `md` size on a white card. Anywhere else, use the mono variant.
7. **Stale-state rendering** is automatic from the `last_verified_at`
   column on each source attribution; do not hard-code stale styling.

---

## 6. Open items (track, not block)

- [ ] Confirm Bangladesh govt seal usage policy with founder (Tier 1 marks).
- [ ] OEKO-TEX has multiple sub-certifications (STANDARD 100, MADE IN GREEN,
      LEATHER STANDARD…) — decide whether sub-cert badges get separate
      asset slots or whether they share `oeko-tex.svg` with a text suffix.
- [ ] amfori rebrand: confirm whether to display "BSCI" alone or
      "amfori BSCI" wordmark (current registry uses display name
      `amfori BSCI` — keep consistent).
- [ ] When spec 09 lands, add tier4 brand rows to `public.sources` and
      populate the `BRAND_*` codes in §3.
- [ ] When ILAB TVPRA scraper lands, add `US_ILAB` row (tier5_regulatory).
