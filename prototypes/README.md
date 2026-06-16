# SourceBD — design prototypes

Static HTML artefacts for comparing against Figma Make output during the Phase 1 design lock-in (per `context/design-brief-phase1.md` §6).

> **Sandboxed.** These files are not Phase 1 production code. They will not be imported by the Next.js app. Per `AGENTS.md` rule 1, no application code ships until the F1 spec is written.

## Files

| File | Brief reference | Frame |
| --- | --- | --- |
| [profile-naafco-group.html](profile-naafco-group.html) | §6 frame #2 + #3 | **Flagship multi-source supplier** — Naafco Group. All 6 tabs populated. Default tab = Compliance. Demonstrates layered surfaces (§16.3), R1 receipts glyph at 5 lines, gold tier badge, parent/sibling group line, claimed-and-verified chip, cert states (valid · expiring · evergreen), RSC sub-scores, sanctions-clear card, brand attribution with Bunny CDN-mirrored brand disclosures, Compliance documents card with 5 RSC mirror URLs, Contact tab in **two states** (gated vs unlocked), 11-row provenance timeline. |
| [profile-thin-supplier.html](profile-thin-supplier.html) | §6 frame #4 | **Single-source dossier** — Bismillah Garments & Textiles. BGMEA-only. R1 thin variant (1 line). Bronze tier. 32% completeness amber. Only 3 tabs visible (Capacity / Brands / Contact **omitted entirely** per §8.10, not "n/a"). Empty states are honest, not apologetic. "Claim profile" is the primary CTA. |
| [profile-with-sanctions.html](profile-with-sanctions.html) | §6 frame #5 | **UFLPA hit (synthetic)** — "Northstar Knitwear Ltd". Full-width red sanctions banner above profile. Banner does NOT block scrolling — buyer needs the receipts to do diligence on the hit. Dedicated Sanctions detail card pinned at top of body. Contact disabled. Tier reflects evidence breadth (silver), independent of sanctions status. **Synthetic prototype data — no real factory is being accused.** |
| [_tokens.css](_tokens.css) | §16 + §19 + §20 | Shared design system. Tokens (warm off-white L0, layered surfaces L1/L2, indigo→teal gradient confined to wordmark, semantic red/amber/green, tier bronze/silver/gold/platinum, radii 6/8/12/20). Components: topnav, sidebar, header card, R1 glyph (with `.thin` variant), tabs, pills (clickable / inherited / text-only), certs (4 states), RSC bar with industry-median tick + sub-scores, sanctions banner + clear card, docs list (Bunny mirror + original), provenance rows, contact states, metrics, watermark. `prefers-reduced-motion` respected. |

## How to view

Double-click any `.html` file. They run from `file://` — no server needed. Open all three in adjacent browser tabs to compare side-by-side against Figma Make exports.

The three HTML files **share `_tokens.css`** by relative `<link>`, so visual consistency between frames is enforced in one place. Inline `<style>` in each file is intentionally minimal.

## Bunny CDN compliance documents

Each "Open mirror" link uses the real path scheme shipped by Spec 13 and Spec 09:

- RSC inspection docs: `https://sourcebd-docs.b-cdn.net/rsc-docs/<supplier-slug>/<doc_type>-<fetched_date>.<ext>` — 7,049 docs across 1,571 factories. doc_type ∈ {fire, structural, electrical, boiler, cap}.
- Brand disclosure mirrors: `https://sourcebd-docs.b-cdn.net/brand-disclosures/brand_<brand>/<date>.<ext>` — H&M, Inditex, Next, ASOS live with per-factory data.

Per `context/frontend-design-spec.md` L237, every compliance-doc row shows **Open mirror** (preferred, our CDN) + **Open original** (fallback to issuing authority). We never inline a PDF we don't host.

## What's intentionally not in scope

Map / geo views, side-by-side compare, reviews/ratings, mobile frames, dark mode, the Discover list page, the marketing home — all deferred to the next prototype pass per design brief §9.

## Assets

Authority logos live at `../inapp-logos/`. Color PNGs are used directly per §20.2; mono SVGs will replace them in Phase 1 production. EPB, SA8000, BGAPMEA have no logo on file and use the §20.4 text-fallback pattern (mono uppercase abbreviation).
