# SourceBD — Phase 1 Design Brief (Figma prototype input)

> **Status:** Brief for the Figma prototype. Not authoritative. Companion to [frontend-design-spec.md](frontend-design-spec.md) — the spec stays the data + IA reference; this file is the *concept* layer that has to be resolved before Phase 1 code starts.
> **Audience:** Whoever drives the Figma prototype (you, or a designer, or a Figma AI plugin under your control).
> **Goal:** pick one of the three concept directions in §3, then mock the 9 frames in §6 at fidelity. After the prototype is approved we wire Dev Mode MCP and start the Phase 1 build.

---

## 1. Why the current spec isn't enough to design from

`frontend-design-spec.md` is an excellent **information spec** — it tells the designer *what* every page must contain, sourced to real columns with measured coverage %. It does **not** tell the designer:

- What this product is supposed to *feel like* sitting next to Foursource, Alibaba, Indiamart, Globalsources in a buyer's tab strip.
- Whether the Receipts Ring is a centrepiece or a marginal annotation — both readings are defensible from the spec text.
- What the visual language is for "we don't render opinions, only receipts" without looking austere or low-effort.
- What the supplier profile reads as on a 72%-of-universe supplier with only 1 Tier 1-3 source — the most common case, and the hardest to make feel valuable.
- How dense vs. airy the data display is. The pill+cert+brand+RSC combo can land as "credibility dashboard" or as "Christmas tree of stickers" depending entirely on visual restraint.

The prototype's job is to **answer those questions visually** so the spec can be locked.

---

## 2. The visual-design problem in one sentence

> SourceBD's moat is that it shows third-party receipts and refuses to publish its own opinion. Every B2B sourcing competitor publishes an opinion (Gold Supplier, Verified, ★★★★★, 95% positive feedback). Design must make "we show you the receipts; you decide" feel *more* trustworthy than "we rate them 4.6/5", not less.

If the prototype ends up looking like a generic admin dashboard, we've lost. If it ends up looking like a cert-collecting sticker album, we've lost. The brief is: **make institutional restraint feel premium**.

---

## 3. Three concept directions — pick one before mocking

Each is a complete worldview. Don't blend two; pick one, mock all 9 frames in it, then we can talk about which to ship or whether a fourth direction emerges.

### Direction A — **Editorial Trust** (FT.com · Bloomberg Terminal · PitchBook)

- **Mental model:** every supplier profile is a dossier in an institutional research database. Buyers are doing diligence, not shopping.
- **Type:** Bricolage Grotesque used aggressively for company names + section headings (28–48pt), Plus Jakarta Sans dense and small (13–14pt body, 11pt for metadata). Generous use of small-caps for column labels.
- **Palette:** near-monochrome (paper white, charcoal, two greys), with **one** restrained accent — e.g. a deep ink-blue used only for interactive elements + the Ring. Sanctions red is its own colour and only ever appears on sanctions.
- **Density:** high information density. Profile header is a dossier masthead — name, type, location, year est., a row of small chips, all in tight vertical rhythm.
- **Receipts Ring:** small (24–32px in the header), positioned like a publication's logo. Number is large, ring stroke is thin. It is *not* the visual centrepiece — the company name is.
- **Pill row:** mono-styled text chips, tight tracking, almost like a footnote line: `BGMEA·1234   BKMEA·567   RSC   EPB   GOTS   OEKO-TEX`.
- **Certs:** rendered as small filed entries with issuer · cert no · expiry in a table-like layout, not as decorative badges.
- **RSC progress bar:** a single horizontal line; the number is the hero, the bar is the substrate.
- **Wins:** appeals to compliance officers, ESG analysts, senior sourcing leads at M&S / Next / Inditex. Most defensibly "institutional". Closest to feeling like a tool the legal/CSR team would also use.
- **Risks:** can feel cold for a merchandiser used to Foursource. Suppliers with 1 source look thin. Needs strong typography craft to not read as a Wikipedia article.

### Direction B — **Compliance Console** (Stripe Dashboard · Linear · Vercel · Plaid · Mercury · Modern Treasury)

- **Mental model:** developer-grade SaaS rigour applied to sourcing. Buyers are operators triaging a long supplier list every Monday.
- **Type:** Plus Jakarta Sans dominates; Bricolage Grotesque only for the largest page titles. Monospace (JetBrains Mono or IBM Plex Mono) for cert IDs, registry numbers, source refs — quietly signals "this is real data, not marketing copy".
- **Palette:** clean cool greys + a single brand accent (consider a desaturated bottle-green or a deep teal — distinct from competitors' gold/orange/red). Generous neutral surfaces; semantic colours strictly for state (red = sanctions, amber = expiring, green = valid).
- **Density:** medium-high but airy. Card-based, generous padding. Pills sit on cards, cards sit on a quiet background.
- **Receipts Ring:** THE hero glyph. Large in the profile header (56–64px), prominent on every card (32px). Renders as a circular meter with the count centred. Tooltip: "Verified by 3 independent registries".
- **Pill row:** rounded soft chips with subtle borders. Each pill has an icon prefix (Phosphor `IdentificationCard` for registries, `Certificate` for certs, `Storefront` for brand attribution). Inherited pills get dashed border + `↳` prefix glyph (resolves §20 open question 1).
- **Certs:** glass-card badges with icon + cert no + expiry chip + "View" link. Clear visual taxonomy.
- **RSC progress:** circular dial or segmented bar; the design language matches Linear's "issue progress" widgets.
- **Wins:** feels modern and tool-grade; developers and ops people respond. Closest to current "best-in-class SaaS" defaults; lowest execution risk. Strong on mobile.
- **Risks:** looks like every other Y-Combinator B2B SaaS; doesn't visually differentiate against Foursource if Foursource hires a good designer next year. The "we're just a tool" framing undersells the domain expertise.

### Direction C — **Bangladesh Industrial** (a brand that visibly belongs to RMG)

- **Mental model:** SourceBD is the trade-press-of-record for Bangladesh RMG. The brand visibly references the country, the industry, the craft — not as folk-art ornament, but as quiet material cues.
- **Type:** Bricolage Grotesque used confidently (Bricolage *is* a contemporary display face with industrial grit, this is the direction it was designed for). Plus Jakarta Sans for body. Numerals in Bricolage's tabular figures where they appear at scale (progress %, capacity numbers).
- **Palette:** an earthy primary — think deep indigo (denim heritage), warm off-white (cotton), a brick / terracotta accent (Dhaka industrial estates), graphite for body text. Sanctions red is a distinct fire-engine red, not the brick. The palette refers to materials without being literal.
- **Density:** generous. Profile pages have a clear masthead with the company name as the headline of a published article. Sections feel like printed dossier pages with breathing room.
- **Receipts Ring:** rendered as a *seal* or *stamp* metaphor — circular, with the count inside. Could carry a subtle hatched/engraved texture at large sizes. Visually evokes "certificate authority", not "video-game XP bar".
- **Pill row:** restrained — pills feel like rubber-stamped marks on paper. Inherited pills have a different stamp variant (e.g. lighter ink, "via" prefix).
- **Certs:** treated like filed certificates — small visual hierarchy with the issuer's mark, cert no, dates. Considered, not decorative.
- **RSC progress:** a printed gauge or a single quiet bar; doesn't try to be a video-game UI.
- **Wins:** *nobody else looks like this*. Hardest to copy. Visibly signals "we are the Bangladesh authority"; supports a future trade-press/blog play (Spec 15 monthly digest); strongest landing-page hero potential. Best on the marketing surfaces (`/`, `/buyers`, `/blog`).
- **Risks:** highest execution risk — easy to over-do and tip into "ethnic-themed" novelty. Requires a designer with restraint and a strong sense of contemporary editorial design. Risk of palette aging poorly if executed naively.

### My recommendation for which to mock first

**Mock Direction B (Compliance Console) as the baseline because it's the lowest-risk shippable language**, then mock Direction A as a divergent exploration of one screen (profile header + Compliance tab) to see whether the editorial register adds enough to justify it. Direction C is the most distinctive but should be a third pass — and probably belongs to the marketing surfaces (`/`, `/buyers`, `/about`) regardless of which language wins for the app surfaces.

If you have any visual reference brands or competitor screenshots that you've reacted strongly to (positive or negative), drop them with the brief — they shift this recommendation more than any abstract argument.

---

## 4. Non-negotiables that survive every direction

These are inherited from [frontend-design-spec.md](frontend-design-spec.md) §0 and AGENTS.md, restated so the designer can't accidentally drop them:

1. **No SBI numeric, no letter grade, no proprietary score, anywhere outside `/admin/scoring`.** The strings "SBI", "Score", "Rating", "A/B/C/D" are forbidden in buyer/supplier UI copy. The Receipts Ring centre label is a count noun, never a grade.
2. **Receipts Ring tooltip** must say something like *"Verified by N independent registries"* — never *"Score: N/5"*. Resolve final copy in the prototype.
3. **Contact PII is server-gated.** The prototype must show two contact-tab states: *unlocked* (real values) and *gated* (CTA → `/pricing`). Both states must be designed.
4. **Sanctions banner must exist in the prototype** even though 0 hits today. Mock one supplier with a synthetic UFLPA hit so the red top-of-profile banner is in the artefact.
5. **Inherited pill is visually distinct** from a direct pill, always, at every size. Tooltip/click reveals the parent factory name.
6. **Source-pill provenance:** every pill must be clickable to its `source_url`. The prototype must show what the hover/active state of a pill looks like.
7. **No maps.** Don't draw a map widget anywhere — `lat/lng` is 0% populated. Use a text address + optional "+N other addresses on file" disclosure.
8. **No product photos, no supplier hero shots.** SourceBD ingests registry data, not catalog content. Avoid composing screens that imply we have either. If imagery is needed for a hero, use abstract / typographic / industrial-photography stock — never specific supplier photos we haven't licensed.
9. **No fake testimonials, no fake supplier names in mocks.** Use the real supplier names listed in §7 below; they're verified factories that actually exist in our DB. (Buyer testimonials in marketing screens may use placeholder names labelled "placeholder".)

---

## 5. Components to design as a library before the screens

Build these as reusable Figma components first (auto-layout, variants), then compose the 9 frames. This is what we'll later wire to shadcn/ui primitives.

| Component | Variants to design |
| --- | --- |
| **Receipts Ring** | sizes 12 / 24 / 32 / 48 / 64 px; states `1 / 2 / 3 / 4 / 5+ sources`; reduced-motion variant (no fill animation). |
| **Registry pill** | direct vs. inherited; with-reg-number vs. without; hover/active; long-label truncation; mobile variant. |
| **Cert badge** | one per kind (GOTS / OEKO-TEX / WRAP / SA8000); expiry states `valid / expiring / expired / n/a`; with-doc-link vs. without. |
| **Brand-attribution pill** | one per brand (H&M / Next / M&S / ASOS); hover reveals "Disclosed on {brand}'s published factory list (date)". |
| **Completeness badge** | one component, semantic colour from value (< 40 red, 40–69 amber, 70–89 green, ≥ 90 emerald). |
| **RSC progress** | bar + number + industry-median tick; circular variant for header use. |
| **Sanctions banner** | top-of-profile; one variant per list (UFLPA / OFAC SDN / UK OFSI / EU SANC / WRO / ILAB) — colour can stay red across all, but copy varies. |
| **Supplier result card** | the Discover card, with all the above components composed in. Must work at 1-col (mobile) / 2-col (lg) / 3-col (xl). |
| **Supplier profile header** | composes Ring + name + entity chip + location + completeness + pill row + (optional) parent-group line + (optional) sanctions banner. |
| **Provenance footer row** | one row of the "show your work" `<details>` list: source code · ref · last-seen · tier badge · external link. |
| **Sidebar** | buyer variant (8 slots, §2.1 of spec); collapsed-icon vs. expanded; mobile bottom-nav variant (4 slots). |
| **Top bar** | logo · global search · notifications · avatar. |
| **Skeleton states** | for Ring, pill row, profile header, result card. |

---

## 6. Frames to mock at fidelity (in this order)

Nine frames. If you only get the first five done in the first pass, that's enough to lock the concept.

1. **Discover** (`/app/discover`) — the canonical list page. 1,420 results, filter rail expanded, 8 result cards visible, search input populated with "knit factory in Gazipur with GOTS", sort = "Most receipts". Include the "Saved (12)" affordance.
2. **Supplier profile — Compliance tab** (`/app/suppliers/abc-apparels-ltd`) — a flagship multi-source factory (use **Naafco Group** or **Standard Group** or **DBL Group**-member-equivalent from §7; pick one with all 6 compliance cards populated: pills · 2 certs · RSC remediation · brand attribution · sanctions slot OMITTED · provenance footer expanded).
3. **Supplier profile — same supplier, Overview tab** — to show how an inactive tab styles and what the Overview block layout feels like.
4. **Supplier profile — a thin supplier** (1 Tier 1-3 source only — 72% of the universe). This is the hardest design problem. The profile cannot feel empty or apologetic. It should feel like a single-source dossier — short, honest, complete.
5. **Supplier profile — with sanctions banner** (synthesise one factory carrying a UFLPA hit; banner red, full-width, top of profile, all other content pushed down. The banner does NOT prevent profile rendering — the buyer needs to see the receipts to do diligence on the hit).
6. **Discover — mobile** (single column, bottom-nav, filter drawer closed; one card open at "filter active" state).
7. **Supplier profile — mobile** (header collapsed to ring + name + completeness; tab bar horizontal-scroll; first tab content visible).
8. **Buyer dashboard `/app`** (signed-in home: 3 stat tiles · Saved grid · Recently viewed · Newly verified strip).
9. **Marketing home `/`** (anonymous landing — hero with one real headline number ("Receipts for 10,121 Bangladesh garment factories"), one screenshot of the Discover or Profile view, three short value-prop blocks, no testimonials yet). This is where Direction C might justifiably override A/B even if A/B wins the app.

For each frame, also mock the dark-mode variant if the chosen direction supports one — Direction B should; Directions A and C may stay light-only.

---

## 7. Real data to seed the mocks (don't use Lorem ipsum)

Pull these straight into the Figma mock. Every name below exists in our live DB and represents a real shape we ship; using fake names creates the wrong visual rhythm because the real names are longer/uglier than designers tend to draft.

**Flagship multi-source factories (use for the "rich" profile frame):**

- `Naafco Group` — typically carries BGMEA + RSC + EPB + WRAP + OEKO-TEX
- `Standard Group` — BGMEA + RSC + EPB + GOTS + brand attribution
- `Robintex (Bangladesh) Ltd` — BGMEA + RSC + EPB + multiple brand attributions (Next, M&S, ASOS)
- `Echo Sourcing` — buying house (use for the BH profile variant)

**Thin single-source factories (use for the "thin" profile frame):**

- `Bismillah Garments` (or any single-source row from BGMEA-only cohort, 7,329 such suppliers exist — pick one with a short name and a long name to test wrapping)

**Inherited-pill / sibling-extension factory (use for the dashed-pill demo):**

- Any supplier whose name ends in `(Extension)` / `(New Building)` / `Unit-2` — 207 such satellites exist. Example shape: `XYZ Knitwears (Extension)` inherits from `XYZ Knitwears`.

**Synthetic sanctions hit (for frame 5):**

- Take a real supplier name, append "(MOCK SANCTIONS HIT — DO NOT SHIP)" in a comment layer. The banner copy: *"Listed on the UFLPA Entity List by U.S. Customs and Border Protection on 2025-09-12. Importing goods produced by this entity into the United States is prohibited."*

**Real location / capacity / workforce numbers to seed Overview + Capacity tabs:**

- District: Dhaka / Gazipur / Narayanganj / Chattogram (top 4)
- Established: range 1995–2018
- Employees total: range 80–6,500
- Production capacity: in dozen/year for BGMEA suppliers (e.g. `1,250,000 dozen / year`)
- Factory types: `Knit Composite`, `Woven`, `Sweater`, `Denim Wash`, `Accessories & Trims`

**Real cert metadata:**

- OEKO-TEX cert no format: `BAN 1234 / 5 OEKO-TEX®` — issuer `Hohenstein Institute` / `TESTEX` / `MODINTEX` — expiry `n/a (evergreen)`
- GOTS cert no format: `GOTS-23594` — issuer `Control Union Certifications` — expiry `2026-12-31`
- WRAP cert no format: `WRAP-12345` — issuer `WRAP` — expiry `2026-08-15`

---

## 8. Interactions to make explicit in the prototype

Don't just draw screens. The prototype must answer these interaction questions, because each one materially changes the look:

1. **Pill hover & click.** Does a pill open a popover with the source detail, or does it navigate straight to the source URL? Recommend: hover shows tooltip + tier badge; click navigates to the source URL in a new tab.
2. **Inherited pill click.** Navigates to parent supplier profile in the same tab.
3. **Ring tooltip on hover.** Copy: *"Verified by 3 independent Tier 1–3 registries"*. Resolve the exact wording in the prototype.
4. **Cert "View" click.** Always opens the mirror URL (CDN-hosted) in a new tab; never inlines a PDF. If no mirror, opens the original source URL with a small "external" glyph.
5. **Filter rail behaviour on Discover.** Sticky on desktop; drawer on mobile. Selected filters render as removable chip row above the results. URL updates on every filter change (deep-linkable).
6. **Save star.** Optimistic flip with rollback toast on error.
7. **Contact tab gating.** Two complete designs — unlocked with real values, and gated empty-state with CTA. The gated state is NOT "hide the section"; it's "the section exists, the values are nulled, the CTA explains why".
8. **Sanctions banner.** Persistent for the session (no dismiss); the banner does not block scrolling to the rest of the profile.
9. **Provenance footer** (`<details>` collapsed by default). Show the closed state in the main mock and the open state in a side variant — to prove "show your work" is one click away.
10. **Empty profile tab.** Spec says "omit the tab entirely". Verify in the mock: a thin supplier should have FEWER tabs visible than a rich supplier, not a tab full of "n/a".

---

## 9. Out-of-scope for this prototype (intentionally)

Don't draw these. Drawing them invents UI for tables that don't exist, and ties future Phase 2 specs to mocks we'll regret.

- Map / geo views (0% lat/lng coverage).
- Side-by-side compare.
- Reviews / ratings.
- BH ↔ Factory relationship graphs (`bh_factory_relationships` doesn't exist).
- Smart Match brief form (Phase 2 spec).
- Messaging / RFQ / Orders (Phase 2 specs).
- Supplier portal (Phase 3 spec) — except a single "Claim this company" CTA stub on the profile header.
- Admin console (Phase 4 spec).
- Mobile dashboard (only Discover + Profile mobile in this prototype; everything else lives in spec).

---

## 10. Deliverables checklist

The Figma file should contain:

- [ ] A **components page** with every component from §5 as a published variant set.
- [ ] A **tokens page** with the chosen palette, type scale, spacing scale, radii — all as Figma styles so the dev handoff is mechanical.
- [ ] The **9 frames** from §6, each as a full-width artboard at 1440px desktop (with mobile variants for #6 and #7).
- [ ] A **divergent-direction page** (Direction A or C, whichever you didn't pick as primary) with at least frame #2 (Compliance tab profile) mocked, for comparison.
- [ ] A **README frame** with the chosen direction's principles in 5 bullets, the palette, type spec, and the Ring tooltip copy locked.
- [ ] A **synthetic-sanctions banner** mock with the "MOCK — DO NOT SHIP" annotation layer.

When the prototype is approved we'll:

1. Enable Figma Dev Mode MCP in VS Code (Figma desktop → Preferences → Enable local MCP server; add `figma-dev-mode` to `mcp.json`).
2. Promote this brief's chosen direction back into [frontend-design-spec.md](frontend-design-spec.md) as the canonical visual language section.
3. Write Phase 1 Spec F1 — base components — keyed to the Figma component IDs.
4. Start the Next.js 15 build off the locked components.

---

## 11. Open questions for you to answer before mocking begins

1. **Direction preference?** A (Editorial Trust), B (Compliance Console), C (Bangladesh Industrial), or "mock B + C and let me pick"?
2. **Any visual references** — competitor screenshots, brand examples, sites you've reacted strongly to (good or bad) — you want the designer to start from?
3. **Brand mark.** Do we have a SourceBD logo / wordmark locked, or is logotype design part of this exercise?
4. **Display name.** Is it `SourceBD` (one word, mixed case), `Source BD`, `source.bd`, or something else? Affects masthead design.
5. **Receipts Ring centre-label copy** — do you want `3` (just the number), `3/5`, `3 sources`, or something else? Affects sizing of the glyph.
6. **Locale.** English-only for Phase 1? Bengali later? Affects type-scale choices (Bengali script benefits from a slightly larger body size).

Answer these in the chat and the brief is locked.

---

## 12. Locked decisions (26 May 2026)

User-locked answers to §11. These override anything earlier in the brief that conflicts.

| # | Question | Answer | Implication |
| --- | --- | --- | --- |
| 1 | Direction | **A — Editorial Trust** as the *register*, but the Receipts Ring as drawn in §3-A is rejected ("looks outdated"). See §13 for Ring redesign + see §14 for how the firecrawl reference reshapes A. |
| 2 | Visual reference | **[firecrawl.dev](https://www.firecrawl.dev/)** — "animated, live-looking, fresh, doesn't look AI-made." | Pure-FT.com cold editorial is OUT. Direction A is evolved into **A′ — Live Editorial** (see §14). |
| 3 | Brand mark | None exists. Logotype is part of this exercise. | Designer drafts 2-3 wordmark options on the README frame. No icon-mark required Phase 1; wordmark only. |
| 4 | Display name | **SourceBD** (one word, mixed case). | Lock everywhere. Never `Source BD`, never `source.bd`. |
| 5 | Locale | **English-only**, indefinitely. | No Bengali type planning. Type scale stays Latin-optimised. Remove Bengali-readiness as a constraint anywhere it appears. |
| — | Ring centre-label copy | **Still open** — was §11 Q5 in the original brief but got displaced by the locale answer. Designer to propose 2 options on the prototype (`3` vs `3 sources`) and we lock at review. |

---

## 13. Receipts Ring — redesign

The §3-A "small thin-stroke ring with a number in the middle" is rejected. Replacement candidates — designer mocks all three at sizes 16 / 24 / 32 / 48 / 64 px and we pick one at prototype review.

**R1 — Receipt stack.** Three to five short horizontal lines stacked vertically (literal "receipts"), the topmost line slightly indented, count rendered as a small superscript number to the right (e.g. `≡ 3`). Reads as "filed evidence", not as a meter. Strong editorial fit. Animates by drawing the lines top-to-bottom on first view (200ms total, respects `prefers-reduced-motion`).

**R2 — Source bars.** A horizontal row of N vertical bars (one per source), each bar height-scaled by the tier (Tier 1 tallest, Tier 6 shortest), count rendered to the right (`||| 3`). Reads as "signal strength" without being a star rating. Works tiny on cards (the bars become a 12px sparkline) and large on profile (becomes a real chart).

**R3 — Index marks.** A row of small filled squares/dots — one per source — with the count to the right (`▪▪▪ 3`). Most restrained, closest to a publication's section-marker glyph. Could carry a subtle live pulse on the most-recently-verified mark.

All three: count is the hero; the glyph is the supporting mark; nothing about it reads as a circular meter or an XP ring. None of them are circular.

The frontend-design-spec's existing references to "Receipts Ring" stay as the *component name* for continuity (the symbol in the codebase). The visual no longer rings. We will rename internally if the designer's chosen mark stops being ring-shaped — likely yes — but that's a Phase 1 spec-F1 concern, not a brief concern.

---

## 14. Direction A′ — Live Editorial (the actual locked direction)

Reconciling "A — Editorial Trust" with the firecrawl.dev reference. They're not the same thing; firecrawl is a modern dev-tool aesthetic, FT.com is print-publication aesthetic. The user picked A's *register* (institutional, dossier, editorial) and firecrawl's *energy* (alive, fresh, modern, motion-aware). Direction **A′** is the synthesis.

### What stays from A
- **Dossier mental model.** Every supplier profile reads as a research-database entry, not a product page.
- **Type hierarchy.** Bricolage Grotesque for company names + section headings, Plus Jakarta Sans dense for body, small-caps for column labels, monospace (JetBrains Mono) for cert IDs and registry numbers.
- **Restrained palette.** A single accent. No competing colour systems.
- **Information density.** High. Cards are tight, rhythm is tight, padding is editorial (16-24px), not SaaS (32-48px).
- **Refusal to publish an opinion.** No grades, no stars, no proprietary number, anywhere outside `/admin/scoring`.

### What changes (from firecrawl reference)
- **Dark mode is the primary surface, not the afterthought.** Light mode is a switchable secondary. The prototype mocks dark first. Firecrawl-style near-black background (`#0A0A0B` or similar), very high contrast text.
- **One vivid accent gradient**, not a flat brand colour. Firecrawl uses orange→pink→violet; SourceBD should pick its own — candidate: **electric indigo → cyan** (cool, technical, not derivative of firecrawl, references Bangladesh denim heritage abstractly without being ethnic). Used SPARINGLY: accent text on the wordmark, the active state on the Receipts Ring glyph, the CTA button, the gradient hairline under the masthead. Never on whole panels.
- **Motion is a first-class language, not decoration.** Specifically:
  - Cards have a subtle on-scroll fade-in (60ms stagger, max 8 cards, then disabled).
  - The Receipts Ring/glyph (whichever §13 wins) draws itself on first paint (≤200ms).
  - Sanctions banner has a quiet pulse on the leading red bar (4s cycle, very low amplitude).
  - Pill hover has a 80ms ease; click has a tiny scale-down + scale-up.
  - Live "Newly verified in the last 24h" strip on `/app` autoscrolls horizontally (pause on hover, pause on `prefers-reduced-motion`).
  - **Every motion respects `prefers-reduced-motion`. Zero motion is shippable.**
- **Subtle "alive" surface elements.** Firecrawl uses an animated dotted/grid background on hero; SourceBD's marketing home (`/`) can use a low-opacity moving grid behind the hero, or a slow-drifting field of pixel dots representing 10,121 verified factories (one dot per factory, twinkle the recently-updated ones). This belongs to the marketing surface, not the app.
- **Glass / blur panels for overlays only.** Filter drawer on mobile, command-palette, tooltips — `backdrop-blur` + low-opacity surface. Not on profile content, not on cards. Used as a depth cue for transient UI.
- **Live demo widget on `/`.** Borrowed directly from firecrawl's pattern: a working, embedded "type a Bangladesh factory name and see its receipts" widget on the marketing home. Real query against a sandbox endpoint. This is the single strongest "doesn't look AI-made" signal you can give.
- **Code/data sample blocks on `/`.** Firecrawl shows real API responses as code blocks; SourceBD's equivalent is showing a real provenance footer — the raw `source_records` row in a monospace card — as proof of the "show your work" promise. This belongs on `/` and on `/buyers`.

### What A′ explicitly is NOT
- Not Stripe / Linear / Vercel (that was Direction B, and was rejected).
- Not folk-art / textile-pattern (that was Direction C's risk surface, and is out).
- Not a video-game UI (no XP rings, no progress meters with sparkle, no badges with glints).
- Not generic dark SaaS (the editorial type hierarchy + dossier IA prevent this — A′ should read as "Bloomberg Terminal if it were redesigned in 2026 by the firecrawl team", not "another developer dashboard with dark mode").

### Net effect
The buyer's gut-feel on first load should be: **"This is a serious institutional research tool, but it's clearly built by people who ship in 2026, not 2014."** That's the A′ brief in one sentence.

---

## 15. Updated deliverables (overrides §10 where they conflict)

The Figma file now needs:

- [ ] **Dark mode first** for every frame from §6. Light mode as a secondary variant on frames 1, 2, 9 only.
- [ ] **3 Ring/glyph candidates** (R1 / R2 / R3 from §13), each at 5 sizes, on the components page.
- [ ] **2-3 SourceBD wordmark drafts** on the README frame.
- [ ] **2 Ring centre-label copy options** (`3` vs `3 sources`) shown side-by-side on one profile frame.
- [ ] **Motion spec annotations** — for each animated element, a sticky note with duration / easing / `prefers-reduced-motion` fallback.
- [ ] **Live demo widget mock** on the marketing home (`/`) frame — a working visual of the firecrawl-style "type a factory name → see receipts" interaction.
- [ ] **Accent gradient swatch + stops** on the tokens page.
- [ ] Divergent direction page can drop to optional (we've locked A′; we don't need to mock B for comparison).

Everything else in §10 stands.

---

## 16. Refinements (26 May 2026 — post-reference-image)

User-locked refinements after reviewing a hub-and-spoke component-library reference image. These OVERRIDE §14 and §15 where they conflict.

### 16.1 Mode order: light first, dark second

Reverse the §14 / §15 decision. **Light mode is the primary surface.** Dark mode is the switchable secondary, mocked only on frames 1, 2, and 9 for variant proof. Rationale: enterprise buyers (compliance officers at M&S, Inditex, Next) live in light by default; dark-first reads as developer-tool, not institutional-tool. Firecrawl's energy can be achieved in light — see §16.4.

Token-wise: design the full token system with light + dark pairs, but the prototype's hero frames render light.

### 16.2 Motion budget — strictly rationed

§14 listed seven animated surfaces. That's too many. **The prototype animates exactly three things, nothing else:**

1. **The hero connector animation** on the marketing home (`/`) — see §16.5. The signature motion of the product.
2. **The Receipts glyph draw-in** on first paint of any profile card (≤200ms, once per element per session).
3. **Sanctions banner pulse** — very low amplitude, on the leading red bar only, 4s cycle. The single "this matters, look here" motion in the entire app.

**Explicitly REMOVED from §14:**
- ~~Card stagger fade-in on scroll~~ — feels AI-templated.
- ~~Pill hover micro-bounce~~ — feels juvenile on enterprise surfaces.
- ~~"Newly verified in the last 24h" autoscroll strip~~ — keep the strip, kill the motion. Static card row with a timestamp is more credible.
- ~~On-scroll fades anywhere~~ — content appears, doesn't perform.
- ~~Animated dot-grid background on hero~~ — replaced by §16.5.

Hover states use 80ms colour/opacity transitions only. That's it. The product feels alive because the **hero animation does the work**, not because every element wiggles.

`prefers-reduced-motion` disables items 1 and 3 entirely. Item 2 (glyph draw) becomes a static render. Zero-motion mode is a fully shippable, complete experience.

### 16.3 Visual depth — layered, not flat

The reference image's strongest cue is that the cards have **real shadow depth and float over a soft background**, not flat fills on a flat canvas. Adopt:

- **Surface layering** with 4 elevation tiers:
  - **L0** — page background (`#FAFAF7` warm off-white, or `#F7F7F5` cool — designer picks at review). Not pure white.
  - **L1** — primary card surface (`#FFFFFF`, subtle 1px hairline border `rgba(15,15,20,0.06)`, soft shadow `0 1px 2px rgba(15,15,20,0.04), 0 8px 24px rgba(15,15,20,0.04)`).
  - **L2** — elevated card (hovered cards, sanctions banner card, the hero connector cards): shadow doubles, hairline darkens slightly. Subtle, not dramatic.
  - **L3** — popovers, tooltips, command palette: backdrop-blur 12px + L1 shadow stacked twice.
- **Hairline borders** everywhere a card meets background. The reference's cards use a thin warm-grey hairline; copy that exactly. No borderless cards.
- **Card corner radius:** 12px on cards, 8px on pills, 6px on inputs, 20px on the hero connector cards (matches reference). Consistent radius family, not random.
- **No drop-shadows on icons or text.** Depth lives on the card layer only.
- **No glassmorphism on content.** Glass/blur only on L3 transient overlays (§14 already said this — keep).

Surfaces should feel like **letterpressed cards on a softly textured surface**, not like flat Material rectangles and not like glass panels stacked on glass panels.

### 16.4 Gradient — much narrower scope

§14 said "one vivid accent gradient." Re-scope to **one gradient, used in at most three places, never on content surfaces.** AI-made designs are recognisable by gradient over-use; we avoid that by starvation.

- **Permitted uses (max 3 total across the whole product):**
  1. The SourceBD wordmark on the marketing home hero only. Subtle. Two stops, not three. Cool palette: deep indigo `#1E2A6B` → muted teal `#0E7C82`. No pink, no orange, no violet, no rainbow. Test at review.
  2. The hero connector animation lines (§16.5) — same gradient, used as the line stroke direction-of-travel cue.
  3. The primary CTA button background — same gradient, very subtle (10% opacity overlay on a solid indigo base, not a full-bleed gradient).
- **Forbidden:**
  - Gradients on page backgrounds, card backgrounds, modal backgrounds.
  - Gradients on text inside the app (only the marketing wordmark — once).
  - Three-stop / rainbow / neon gradients anywhere.
  - Animated gradient shifts (gives the AI-slop tell).
  - "Aurora" / "mesh gradient" hero backgrounds — strongly associated with template-generators.

Default state for any surface is **flat solid colour from the L0–L3 system**. Gradient is the exception, not the rule.

### 16.5 Hero connector animation — the signature motion

This is the centrepiece. Replaces the §14 "live demo widget" as the marketing home's hero element (the demo widget can move down the page or drop entirely).

**Concept:** SourceBD as a hub; certifying / registry authorities as spokes; live data flowing inward as moving dots along the connecting lines. Reads in 2 seconds as: *"This product receives verified data from these named authorities, continuously."*

**Layout (desktop hero):**

- Centre: a single elevated card (L2) carrying the **SourceBD wordmark** + a one-line tagline. Card size roughly 280×120px. Soft shadow, hairline border.
- Around it, **6 spoke cards** at roughly 10/2/4/8/10/12 o'clock positions — each a small L1 card (160×56px), carrying:
  1. **BGMEA** (logo or wordmark + "Bangladesh Garment Manufacturers & Exporters Assn.")
  2. **BKMEA** (knitwear assn)
  3. **EPB** (Export Promotion Bureau — gov, Tier 1)
  4. **OEKO-TEX®**
  5. **GOTS**
  6. **WRAP**
- **Connecting lines:** thin (1px) soft-grey hairlines from each spoke card to the centre card. Curved (gentle Bezier), not straight. Slightly transparent so they don't dominate.
- **Moving dots:** along each line, a small 4px dot travels from the spoke inward to the SourceBD centre. Dot stagger across the 6 lines (each line has its own 3-5s loop, offset, so they never all arrive together — feels organic, not synchronised).
- **Arrival pulse:** when a dot reaches the centre card, the centre card's hairline border glows for 200ms in the accent gradient stroke, then fades. This is the **only place** the accent gradient appears in motion. Subtle.
- **Direction:** always inward (spokes → SourceBD). Outward direction would mis-represent the product (we ingest, we don't push).
- **Density:** at any given moment, 2-3 dots in flight across the 6 lines, never more. Empty lines are fine — feels real.

**Mobile hero:** the connector becomes a vertical layout — centre card on top, 3 spoke cards below (BGMEA / OEKO-TEX / WRAP), 3 dots animating upward into centre. Same logic, compressed.

**Reduced motion:** lines stay, dots disappear, centre card gets a static "Live data from 6 partner registries" caption. The visual metaphor still reads.

**Authenticity caveats (non-negotiable):**
- The logos used on the spoke cards must be the **real logos** of those authorities, used factually (we *do* source data from these — that's accurate, not endorsed). Add a small footnote under the hero: *"Logos shown identify the data sources we aggregate from. SourceBD is not affiliated with or endorsed by these organisations."*
- Do not invent partner logos. Do not show brand logos (H&M / Next / M&S) in the hero — they belong on supplier profiles as attribution, not on the marketing hero (would over-claim affiliation).
- The animation must be implementable in pure CSS + SVG or a tiny canvas — no Lottie file, no heavy webGL. Performance budget: < 50KB, 60fps on mid-tier hardware, < 2% CPU when running.

### 16.6 Enterprise-grade visual checklist (review gate)

Before the prototype is approved, the designer must self-check against these. Any "no" answer blocks approval:

- Does every screen render perfectly readable + complete with `prefers-reduced-motion` and JavaScript disabled?
- Are there exactly 3 animated elements in the product? (Hero connector, glyph draw, sanctions pulse.)
- Is the gradient absent from every card background, page background, and in-app text?
- Does every card have a hairline border + soft shadow (not borderless, not heavy shadow)?
- Is the colour system entirely from the L0-L3 + accent + semantic (red/amber/green) palette, with no one-off colours anywhere?
- Are corner radii from the 6/8/12/20 family only?
- Are all icons from Phosphor at a single stroke weight?
- Does the dark mode variant exist at token level even though it's mocked on only 3 frames?
- Does the hero animation read in ≤ 2 seconds without a caption?
- Is there zero gratuitous motion outside the 3 sanctioned animations?

### 16.7 Net effect (revised from §14)

The buyer's gut-feel on first load should be: **"This is the institutional research tool for Bangladesh garments. It's clearly receiving live signals from the registries it cites. It is unambiguously a 2026 enterprise product — not a 2014 portal, not a 2024 AI template."**

---

## 17. Continuous-sync feed component (marketing-only)

Added 26 May 2026 after a second reference image: firecrawl.dev's "GitHub integrations" surface — a sparse dotted background grid on the left with circular logo tokens drifting upward, a small chain glyph between halves, and a real-looking activity feed on the right with stacked-avatar contributor strip at the bottom.

For SourceBD this becomes the **"Continuously in sync with the source of truth"** section on the marketing home. It is a **separate surface from §16.5**, placed lower on the page (post-hero). Together they tell the full story: §16.5 = *"here are the registries we ingest from"* (topology); §17 = *"here is data arriving from them right now"* (liveness).

### 17.1 Layout

Two-column section, full-width, generous vertical padding, on a subtly tinted band (L0 darkened by ~2%) so it visually separates from the surrounding L0 page surface.

**Left column (~55% width):** the ambient drift surface.

- **Background:** sparse light dotted grid (4px dots, 32px spacing, `rgba(15,15,20,0.06)`). Same dot system as the reference image. Static.
- **Foreground:** 8–12 **circular logo tokens** (60–72px diameter, white card surface, L1 shadow, 1px hairline), each carrying a real Phase-0 source logo: BGMEA, BKMEA, BTMA, BGAPMEA, EPB, RSC, OEKO-TEX, GOTS, WRAP, SA8000, Hohenstein, TESTEX, Control Union. Positioned in a loose vertical-bias scatter, not a grid.
- **Drift:** tokens drift slowly upward at varying speeds (60–120s per full cycle, off-screen top → respawn below). Opacity varies (40%–100%) so the field has depth — closer tokens brighter, farther tokens faded. Each token rotates 0°, no spin.
- **Chain glyph:** a small Phosphor `LinkSimple` icon (24px) floating roughly centre-right of the left column, hairline border, white background. Marks the seam between the two halves — same as the reference. Static.

**Right column (~45% width):** the live activity feed.

- **Heading row:** small caps `LATEST RECEIPTS` + a live dot (4px green, very subtle 2s pulse — this counts as **one of the in-app sanctioned pulses already in §16.2 motion budget — see §17.4 for budget reconciliation**).
- **Feed rows** (4–6 visible, each 56–72px tall, hairline divider between):
  - Row layout: small source icon (left) · headline ("BGMEA membership verified — Naafco Group") · meta (`#NAAFCO-1234 · 2h ago`) · tier badge (right).
  - Real headline templates pulled from actual ETL event types: `BGMEA membership verified`, `OEKO-TEX cert renewed`, `GOTS cert added`, `RSC remediation milestone`, `EPB export-record updated`, `WRAP audit logged`, `Brand attribution: H&M disclosed factory`.
  - Use real supplier names from §7 (Naafco Group, Standard Group, Robintex (Bangladesh) Ltd, Echo Sourcing).
  - Cert numbers in monospace (JetBrains Mono), real format.
- **Behaviour:** every 10–15 seconds a **new row slides in at the top**, the bottom row slides off. Slide duration 400ms, easing `cubic-bezier(0.4, 0, 0.2, 1)`. Five rows visible at steady state. No autoscroll — only the insert/dismiss transition.
- **Bottom strip** (matches reference's `+91` avatars): a stacked-pill row showing **circular avatars of 4–5 named authorities** (BGMEA / OEKO-TEX / GOTS / WRAP / RSC), with overlap and a `+8 data sources` count chip on the right. Hairline border, soft shadow, sits inside the column near the bottom-right corner of the feed card.

### 17.2 What this is NOT

- Not a chart. No graphs, no sparklines, no count-up numbers.
- Not a Twitter-style infinite stream. The feed shows max 5 rows; one in / one out every 10–15 sec.
- Not the hero. The hero remains §16.5's hub-and-spoke. This section sits *below* the hero, after the value-prop blocks, above the marketing-home pricing teaser.
- Not interactive in v1. The feed rows are display-only. (Future: clicking a row could link to that supplier profile. Out of scope for the prototype.)
- Not a global component. It does NOT appear in `/app`, on `/app/discover`, on any profile, or in the buyer dashboard. Marketing surfaces only — strictly `/`, possibly `/buyers`.

### 17.3 Authenticity / honesty rules

- The feed entries shown in the prototype must be **plausible real entries**, not invented marketing copy. Use shapes that match actual `source_records.event_type` values in the database. If the row says "OEKO-TEX cert renewed — BAN 1234/5 — Naafco Group · 2h ago", that exact shape must be reproducible from a real DB query.
- For the prototype, the feed can be a hardcoded array of 12 plausible rows that rotate. **For Phase 1 ship**, the feed should be powered by an actual `GET /api/marketing/latest-receipts` endpoint that returns the last N high-signal `source_records` events. This is a Phase 1 spec line item, not just a Figma effect.
- Logos used on tokens + bottom-strip avatars must be the **real authority logos**, used factually. Same disclaimer footer as §16.5 applies: *"Logos identify the data sources we aggregate from. SourceBD is not affiliated with or endorsed by these organisations."*
- Never invent a brand logo. Never invent a supplier logo. Never show a competitor logo (Foursource, Alibaba, etc.) — even as "vs" reference.

### 17.4 Motion budget reconciliation

§16.2 capped product motion at 3 surfaces. That cap was implicitly about the **app surfaces** (`/app/*`). Marketing surfaces (`/`, `/buyers`) get a separate, slightly larger budget because they're sales tools, not work tools. Formalising:

**App-surface motion budget (`/app/*`):** **3 motions, max.**
1. Receipts glyph draw-in (200ms, once per element per session).
2. Sanctions banner pulse (4s cycle, low amplitude).
3. *Reserved slot* — kept empty for a future essential interaction (e.g. save-confirmation flicker). Do not spend.

**Marketing-surface motion budget (`/`, `/buyers`):** **4 motions, max.**
1. Hero hub-and-spoke connector dots (§16.5) — inward, staggered, max 3 in flight.
2. §17 ambient logo-token drift on the left column (slow, varying opacity, no synchronised cycle).
3. §17 activity feed row insert/dismiss (one row swap every 10–15s, 400ms transition).
4. §17 `LATEST RECEIPTS` live-dot pulse (4s cycle, 4px green, very subtle).

That's it across the entire product. Seven total animated elements, four of which exist only on the marketing home. **Anything not in these two lists is forbidden.** Hover transitions (80ms colour/opacity) don't count against the budget — they're table stakes, not motion.

`prefers-reduced-motion`:
- App surfaces: glyph draw becomes static, sanctions pulse stops. Both still fully functional.
- Marketing surfaces: hero dots vanish (hairlines stay), token drift stops (tokens hold last position), feed insert becomes instant swap (no slide), live dot becomes static. The narrative still reads at first glance — *"these are the sources, here are recent receipts"* — without any motion.

### 17.5 Visual depth on this section specifically

This is the section in the entire product where visual depth matters most, because the metaphor depends on it:

- **3 z-layers** on the left column: background dot grid (z0), faded-back tokens at 40–60% opacity (z1), foreground tokens at 80–100% opacity with full shadow (z2). The eye reads "ecosystem with near and far elements" — not "12 logos on a flat sheet".
- **The chain glyph sits in its own z-layer** between the columns. White card, hairline border, soft shadow doubled. Reads as a stitch holding the two halves together.
- **The feed card on the right** is a single L2 card (slightly elevated above L1), with internal hairline dividers between rows. The bottom-strip avatars sit in a small L2 pill *on top of* the L2 feed card — creating a third layer locally on the right.

### 17.6 Implementation budget

- Left column drift: pure CSS animations on absolutely-positioned divs OR a single 60fps `requestAnimationFrame` loop in <2KB JS. No canvas, no WebGL, no library.
- Right column feed: React state-driven row swap with CSS transition. The endpoint can be plain `fetch` polled every 30s (or `EventSource` if Phase 1 spec wants live). No socket library in v1.
- Total marginal cost of §17 on the marketing page: < 80KB JS + < 30KB image assets (the authority logos are SVG, cacheable, ~2KB each).
- 60fps on mid-tier hardware. < 3% CPU when running. Pauses when tab is backgrounded (`document.visibilityState`).

### 17.7 Layout decision — both, locked

**Locked 26 May 2026 by user:** keep §16.5 AND §17. Both ship.

Rationale recap: §16.5 = ingest **topology** ("here is the architecture — 6 named authorities feed us"); §17 = ingest **liveness** ("here is data arriving from them right now"). They answer different questions; reading them in sequence is the whole pitch in 5 seconds.

**Marketing home (`/`) vertical order, locked:**

1. **Top nav** (logo · Discover · Buyers · Pricing · Sign in).
2. **§16.5 hub-and-spoke hero** — wordmark + one-line tagline at centre, 6 authority spokes, inward dot animation, primary CTA below. Full viewport height on desktop.
3. **Value-prop band** — 3 short blocks (e.g. *"Receipts, not opinions"* · *"Built for diligence"* · *"Aggregated from Tier 1–3 sources"*). Static, editorial type.
4. **§17 continuously-in-sync section** — left ambient logo drift + right live feed. Slightly tinted band so it separates visually from #3.
5. **One real screenshot** of the Discover or Profile view, with a caption pulled from real data ("Showing 1 of 10,121 verified factories"). Static, no motion.
6. **Pricing teaser** (3-tier cards, link out to `/pricing`).
7. **Footer** with affiliation disclaimer (the same line both §16.5 and §17 require — appears once, in the footer, covering both surfaces).

The visual rhythm: motion (hero) → rest (value props) → motion (sync) → rest (screenshot) → rest (pricing). Two animated bands, separated by static bands. That cadence prevents crowding without losing either metaphor.

**No further design-direction decisions outstanding.** Brief is fully locked.

---

## 18. In-app motion + floating-card extension (26 May 2026)

User locked: floating-card aesthetic and motion language must extend into the app surfaces (`/app/*`), not just the marketing home. This OVERRIDES §16.2 and §17.4's "3-motion app cap." Replacing with a more nuanced split.

### 18.1 The honest tension this resolves

Continuous ambient motion (drifting logos, autoscrolling rows) inside a work surface erodes the enterprise-grade feel — compliance officers triage 200 suppliers in a session and don't want their cursor distracted. **But** the app shouldn't feel static next to a hero that just animated; the visual language must read continuous from marketing → app. The split below preserves both.

**Two kinds of motion exist:**

- **Ambient motion** — runs on its own, independent of user action. Drifting logos, autoscroll, breathing pulses, hero connector dots.
- **Reactive motion** — only fires in response to a user event (hover, click, scroll-trigger, route change, data arrival). Hover lifts, card press, tab transitions, skeleton shimmer, filter chip insert/remove, route-fade between profile tabs.

**Rule:** ambient motion stays mostly out of `/app/*`. Reactive motion is welcome everywhere as long as it's purposeful and short.

### 18.2 Revised motion budget (replaces §16.2 + §17.4)

**Marketing surfaces (`/`, `/buyers`, `/pricing`, `/about`):** ambient and reactive both allowed.

| # | Motion | Type | Trigger |
|---|---|---|---|
| M1 | §16.5 hero hub-and-spoke connector dots | Ambient | Page load |
| M2 | §17 ambient logo-token drift | Ambient | Page load |
| M3 | §17 activity feed row swap | Ambient | 10–15s interval |
| M4 | §17 `LATEST RECEIPTS` live-dot pulse | Ambient | Continuous, 2s |

**App surfaces (`/app/*`):** ambient is rationed; reactive is open.

| # | Motion | Type | Trigger | Notes |
|---|---|---|---|---|
| A1 | Receipts glyph draw-in | Reactive | First paint of element per session | 200ms |
| A2 | Sanctions banner pulse | Ambient | Continuous | Sole continuous motion in-app. 4s, low amp, leading bar only. |
| A3 | **Card hover lift** | Reactive | Hover | Translates 1–2px up, shadow deepens from L1 → L2, 120ms ease-out |
| A4 | **Card press** | Reactive | Mousedown | Scale 0.99 + shadow softens, 80ms |
| A5 | **Route / tab transition** | Reactive | Profile tab change, page route change | Crossfade 160ms, no slide |
| A6 | **Skeleton shimmer** | Reactive | While data loading | Single shimmer sweep, 1.2s cycle, stops on data arrival |
| A7 | **Filter chip enter / exit** | Reactive | Filter add/remove on Discover | Scale 0.9 → 1.0 + opacity 0 → 1, 150ms |
| A8 | **Toast slide-in** | Reactive | Save / error / saved-confirmation | From top-right, 200ms, auto-dismiss 4s |
| A9 | **Popover / tooltip fade+rise** | Reactive | Hover on pill, ring, cert | 4px rise + opacity, 100ms |
| A10 | **Dashboard "Newly verified today" mini-strip** | Ambient | Continuous on `/app` home only | ONE compressed §17-style ambient in-app, see §18.4 |

That's **10 motions in-app, 9 of which are reactive** (only fire when the user does something). Plus 4 ambient motions on marketing. **Total = 14 across the entire product.** Anything not listed is forbidden.

### 18.3 Floating-card aesthetic — explicit everywhere

§16.3 introduced layered surfaces. Making it explicit that this applies to **every card-shaped element in the app**, not just marketing:

- **Supplier result cards on Discover** — L1 surface, hairline `rgba(15,15,20,0.06)`, soft shadow `0 1px 2px rgba(15,15,20,0.04), 0 8px 24px rgba(15,15,20,0.04)`, 12px radius. On hover → A3 lift to L2.
- **Compliance / Overview / Capacity / Contact tab content cards** on supplier profile — same L1 spec. Each section (Registries / Certs / Brand attribution / RSC) is its own floating card, not a flat band.
- **Profile header** — L2 elevated card with hairline + double shadow. Sits on the L0 page background, not flush.
- **Buyer dashboard tiles** (stat cards, saved suppliers, recently viewed, newly-verified strip) — all L1 floating cards, all support A3 hover lift if interactive.
- **Filter rail items** on Discover — L1 card with inner padding; selected filter chips are L2 pills.
- **Cert badges** — small L1 cards inside the Certs section card (nested elevation: L1 inside L1 with inner shadow inverted to read as "inset"). At review, designer decides if nesting reads or feels heavy.
- **Sidebar nav items** — flat by default, L1 surface on hover, L2 with inner accent stroke on active route.
- **Sanctions banner** — L2 card with red leading bar; not a flat strip.
- **Pills / chips** — NOT cards. Stay flat with hairline border only, no shadow. Otherwise the visual rhythm collapses.
- **Tables** (if any — currently none in Phase 1) — stay flat; cards do not nest tables.

Background L0 must be a warm off-white (`#FAFAF7`-ish) — flat white kills the float effect because there's no contrast for the shadow to read against.

### 18.4 The one ambient motion permitted in-app: A10

The buyer dashboard `/app` home gets a single ambient surface — the **"Newly verified today" mini-strip**. This is the compressed §17 pattern, adapted for in-app:

- Horizontal strip of 3–5 visible cards near the top of the dashboard (below the stat tiles, above the "Saved" grid).
- Each card: tier-badge dot · short event headline ("OEKO-TEX cert renewed — Naafco Group") · 12-char monospace cert ref · relative timestamp.
- **One new card slides in from the right every 20–30 seconds**; oldest slides off the left. 400ms slide.
- No autoscroll between insertions — strip is static between events.
- Pauses when tab backgrounded (`document.visibilityState`).
- Pauses if user hovers the strip (so they can read).
- Reduced-motion: insertions become instant swaps, no slide.

**Why this one is allowed in-app:** the buyer dashboard is the post-login "what changed since I last looked?" surface. A live feed of newly-verified events directly answers that question. It's the only `/app` surface where ambient motion is *informational*, not decorative.

**Where A10 is NOT allowed:** anywhere else in `/app`. Specifically not on Discover, not on profiles, not on Saved, not on Settings.

### 18.5 Motion behaviour rules (apply to every motion above)

- **Every motion has a `prefers-reduced-motion` fallback that fully degrades to zero-motion.** Lifts become static elevation changes. Slides become instant. Pulses stop. Shimmer becomes a flat skeleton.
- **No motion blocks user input.** A user clicking through a hover lift mid-animation must immediately register the click; the lift cancels.
- **No motion exceeds 400ms** except the sanctions pulse (4s loop) and the A10 inter-event idle gap (20–30s).
- **Stagger limits.** When multiple cards enter (e.g. Discover results loading), stagger maxes at 8 cards × 30ms = 240ms total. Beyond 8, all later cards render in unison. Never an infinite stagger.
- **No motion on first scroll into view.** Cards do not fade in as you scroll down a profile. They're already there. Scroll-triggered fades are the strongest AI-template tell and they're banned.
- **No parallax.** Cards do not move at different speeds than the page on scroll. Parallax inside a work tool is amateur hour.
- **No motion on text.** Headings don't slide in. Paragraph copy doesn't fade. Numbers don't count up.

### 18.6 Floating depth ≠ floating motion

Floating-card aesthetic is visual (shadows + hairlines + L0–L3 elevation). It does NOT mean cards bob up and down. They are static at rest. The "float" is in the shadow language, not in animation. The Receipts glyph draw-in (A1) is the only first-paint motion on a card; the card itself does not animate in.

### 18.7 Performance budget (cumulative)

With the new motion list, performance budget tightens:

- **App surfaces:** total animation cost ≤ 3% CPU steady-state. The only steady-state motion in-app is A2 (sanctions pulse, ~0.1% CPU) and A10 on `/app` home only. Everything else is one-shot reactive — cost is per-interaction, not continuous.
- **Marketing surfaces:** total animation cost ≤ 6% CPU steady-state. The hub-and-spoke dots + token drift + feed swap together stay under this on mid-tier hardware.
- **Pause when tab backgrounded** is mandatory for ALL ambient motion (M1–M4, A2, A10).
- **No motion library beyond CSS transitions and `framer-motion`** (already in the architecture stack). Lottie, GSAP, Three.js, anime.js — all forbidden.

### 18.8 Net effect

The buyer's gut on first load of `/app`: **"This is responsive and modern — every interaction feels considered — but nothing is performing for me. It's a work surface."**

Marketing read in §17.7 stays the same. The product now has one coherent motion language from `/` through `/app` — but the *dosage* differs by surface, which is the only way both "enterprise-grade" and "feels alive" can be true at the same time.

---

## 19. Final restraint pass — design authority decisions (26 May 2026)

User explicitly handed design authority back: *"keep it enterprise-grade but add liveliness to it."* Re-reading §14 → §18 as one document, three things were over-spec'd by accumulation (each addition was reasonable in isolation; the stack is too busy for an enterprise B2B tool). Tightening below. **This section overrides any conflict with §14–§18.**

### 19.1 Motion philosophy — locked

**Motion in SourceBD signals system health and data freshness. It is not decoration.** This single principle decides every animation question that comes up later.

Corollaries:
1. **Calm by default.** Continuous motion is the exception, not the rule. Most of the time, most surfaces are still.
2. **Motion earns its place by being informational.** A dot arriving at the hub means "data flowed." A row sliding in means "something new was verified." A pulse on a sanctions banner means "this is high-priority." Decorative motion (drifting logos forever, scroll fades, hover bounces) is removed.
3. **Initial reveal > continuous loops.** Where a metaphor only needs to be read once, it animates ONCE on load and then settles. The product feels alive because things *happen at meaningful moments*, not because everything wiggles forever.
4. **Periodic life-signs over constant motion.** Where continuous liveliness IS needed (e.g. "the data is current"), it manifests as occasional purposeful pulses (every 20–45s, single element), not continuous animation.
5. **Enterprise buyers measure trust by restraint.** Every additional animation costs trust. The motion budget is a credibility budget.

### 19.2 Final motion list — replaces §18.2 entirely

**Marketing surfaces (`/`, `/buyers`, `/pricing`, `/about`) — 3 motions total** (down from 4 in §18.2):

| # | Motion | Behaviour | Trigger |
|---|---|---|---|
| M1 | **§16.5 hub-and-spoke initial reveal** | On page load: 1 dot from each of 6 spokes arrives at centre in sequence over ~6s, each arrival pulses the centre hairline (200ms each). After the reveal completes, motion **stops**. Then: occasional single-dot burst from a random spoke every 20–30s — keeps it "alive" without being busy. | Page load + idle interval |
| M2 | **§17 token reveal + periodic life-sign** | On page load: 12 logo tokens fade in with a 60ms stagger in scattered positions. They DO NOT drift continuously after that — they settle in place. Then: every 30–45s, ONE random token gently scales 100% → 104% → 100% over 1.2s (a quiet "still receiving from this source" signal). | Page load + idle interval |
| M3 | **§17 activity feed row swap** | One row slides in at top, one slides off at bottom. **Every 30–45 seconds** (was 10–15s — too busy). 400ms slide. Pauses on hover, pauses when tab backgrounded. | Idle interval |

**Killed from earlier sections:** the M4 always-on `LATEST RECEIPTS` live-dot pulse (replaced — see §19.3). Continuous logo drift inside §17. The hub-and-spoke "dots in flight at all times" pattern.

**App surfaces (`/app/*`) — 9 motions total** (down from 10):

| # | Motion | Behaviour | Trigger |
|---|---|---|---|
| A1 | Receipts glyph draw-in | 200ms, once per element per session | First paint of element |
| A2 | Sanctions banner pulse | 4s cycle, low amplitude, leading bar only | Continuous |
| A3 | Card hover lift | 1–2px translate + shadow L1 → L2, 120ms | Hover |
| A4 | Card press | scale 0.99, 80ms | Mousedown |
| A5 | Route / tab transition | 160ms crossfade | Route or tab change |
| A6 | Skeleton shimmer | 1.2s sweep, stops on data | Loading state |
| A7 | Filter chip enter / exit | scale + opacity, 150ms | Filter add/remove |
| A8 | Toast slide-in | 200ms from top-right, auto-dismiss 4s | System event |
| A9 | Popover / tooltip fade+rise | 4px + opacity, 100ms | Hover on pill/ring/cert |

**Killed from §18.2:** A10 "Newly verified today" mini-strip ambient row swap. Replaced — see §19.5.

**Grand total: 12 motions across the entire product** (down from 14). All ambient motion outside `/app` is either initial-reveal-once or periodic-life-sign-every-20s+. Inside `/app`, the only continuous motion is the sanctions pulse — and only when a sanctions hit is present.

### 19.3 The `LATEST RECEIPTS` live-dot — reworked

§17.1 had a 4px green dot pulsing continuously next to the section heading. Continuous pulse = decoration. Reworked:

- Dot is static at rest (filled green, no pulse).
- When a new feed row arrives (§19.2 M3), the dot does ONE 200ms scale-pulse + radial fade. Then static again.
- The pulse becomes a **signal that data arrived**, not ambient decoration.

This is the pattern to copy for any future "live" indicator: pulse on event, static at rest.

### 19.4 §17 ambient logo drift — replaced

§17.1 "drifts slowly upward at varying speeds (60–120s per full cycle)" is killed.

Replacement: **logo tokens reveal once on page load, then settle in place.** They occupy a static loose-scatter composition. Every 30–45s, a single random token does a quiet scale-pulse (100% → 104% → 100%, 1.2s ease-in-out) — the "still receiving from this source" life-sign. Opacity layering for depth stays.

This reads as a *constellation of sources* rather than a *lava lamp of logos*. Constellation reads enterprise; lava lamp reads consumer.

### 19.5 A10 "Newly verified today" — replaced

§18.4 had a continuous in-app row-swap strip. Replaced with a **static `<NewlyVerifiedToday>` widget**:

- 3–5 cards horizontal, static at rest.
- Timestamp displayed in each card (e.g. "2h ago" / "today, 09:42").
- On **explicit page refresh** or **focus return after >5 min away**, the widget refetches and any new cards animate in (one-shot stagger, 240ms total). After that, static until the next refresh.
- A small "Refresh" affordance (Phosphor `ArrowsClockwise`) in the widget header for manual refetch.
- Timestamps update in place every 60s (text only — no motion).

This delivers the same "what changed since I last looked?" answer without continuous motion. Compliance officers refresh their work tools deliberately; we honour that.

### 19.6 Gradient — narrowed further

§16.4 allowed gradient in 3 places. Reduce to **2**:

1. SourceBD wordmark on the marketing home hero only. Subtle two-stop (indigo → teal).
2. The §16.5 centre-card hairline glow on dot arrival. ONE accent gradient appearance per arrival event, 200ms fade. This is the only animated gradient in the entire product.

**Killed:** the gradient on the primary CTA button (§16.4 item 3). The CTA reverts to a solid deep indigo with the standard hover state. Gradient on a CTA reads as marketing-template; solid reads as enterprise.

### 19.7 Dark mode — demoted to v2

§14 / §16.1 went back and forth on dark mode. Final answer: **dark mode is out of Phase 1 scope.**

- Phase 1 ships light only. No dark variant in the prototype.
- Tokens are designed in a way that *permits* dark later (semantic naming: `surface-base` not `gray-50`; `text-primary` not `gray-900`).
- Dark mode is a Phase 2 backlog item, not Phase 1 scope.

Rationale: enterprise B2B buyers default to light. Shipping two modes doubles QA + visual-bug surface area for a buyer cohort that won't use dark for compliance work. Ship light well first; add dark when usage data justifies it.

### 19.8 Visual depth — kept, made the primary "lively" device

With motion narrowed, **visual depth carries more of the "alive" feel.** Doubling down on §16.3 and §18.3:

- Hover lift (A3) is the **primary in-app liveliness signal**. Every interactive card lifts 1–2px on hover with shadow deepening L1 → L2. This is what makes the surface feel responsive — not motion that runs on its own.
- Active-state inner accent stroke on sidebar items and selected filter chips. Tiny 1px indigo stroke inset, no glow.
- Focus rings are 2px solid accent indigo (no animation, no offset glow). Visible keyboard navigation, no flair.
- Skeleton states feel like the page is *coming together*, not loading — single shimmer sweep then content.

If motion is restraint, depth and craft do the talking.

### 19.9 What the buyer sees — revised final

**On `/` first load:** A serious institutional surface. Wordmark + tagline + 6 named authority cards arrange themselves around a central hub, dots flow inward once over 6 seconds, the hub pulses gently each time, then it all settles. Below: a still constellation of source logos and a feed of real recent receipts that updates every half-minute. Static between events. Reads in 5 seconds as: *"this product aggregates verified receipts from these named registries, and the data is current."*

**On `/app/discover` first load:** Cards in a clean grid, soft shadows, hairlines, warm-white background. Hovering a card lifts it; clicking it crossfades to the profile. Filter chips animate in when added. Nothing is moving on its own. The work feels light.

**On a supplier profile:** Floating section cards with measured shadow. The Receipts glyph draws in once. If a sanctions hit exists, a single banner pulses — and that is the only ambient motion the user sees on the entire profile. The page is a still document with responsive surfaces.

**On `/app` dashboard:** Stat tiles, saved suppliers, recently viewed, the `<NewlyVerifiedToday>` widget showing what's new since last visit — static, with a refresh affordance. No autoscroll. No live ticker. Just a clean post-login summary that updates when the user asks it to.

This is what "enterprise-grade with liveliness" looks like when the two words are weighted equally.

### 19.10 If we deviate from this later

The motion list in §19.2 is the gate. Adding any animation requires:
1. Naming the surface (app or marketing).
2. Naming whether it's reactive or ambient.
3. Showing it earns its slot by being informational, not decorative.
4. Confirming the total count (12) doesn't grow by accumulation again.

If we hit 14+, something must be removed before something new is added. Motion is a budget.

---

## 20. Brand assets — cert issuer logos + RMG product icon set (26 May 2026)

User dropped a reference folder of authority logos at [inapp-logos/](inapp-logos/) and asked for: (a) the real cert issuer logos used in-app, normalised for fit; (b) a custom RMG product icon set for principal-product / product-category display. Locking both systems below.

### 20.1 The two asset families are governed by different rules

| Family | Source | What we can/can't do |
|---|---|---|
| **Authority / cert issuer logos** (BGMEA, BKMEA, BTMA, BGAPMEA, EPB, RSC, OEKO-TEX, GOTS, WRAP, SA8000, Hohenstein, TESTEX, Control Union, amfori, Textile Exchange family — GRS / OCS / OBCS / RCS) | The actual trademark owner. Original artwork only. | **Nominative use only** — used to factually identify the source of a verified receipt. May be resized, may be rendered in mono for in-app use **only where the trademark owner permits mono rendering** (most do for editorial use). MAY NOT be redrawn, restyled, recoloured to brand palette, animated with effects, combined with other marks, used in a way that implies endorsement or partnership. The affiliation disclaimer from §16.5 is the standing protection. |
| **RMG product icons** (T-Shirt, Polo, Trouser, Jacket, Sweater, Hoodie, Knit Top, Woven Shirt, Denim, Outerwear, Activewear, Lingerie, Socks, Accessories & Trims, Home Textile/Towel, Sweater Knit, Workwear, etc.) | **Custom-designed by SourceBD.** | Our own IP. Fully part of our design system. Any style, any colour, any animation we want. |

The four "icon-style" images in the reference folder (towel, t-shirt, zipper, fabric-roll-ish) are *direction references* for the RMG set, NOT something we ship as-is. Their provenance is unclear (likely scraped) and they're inconsistent in stroke weight / corner radius — they would not pass a coherent set test. We draw our own.

### 20.2 Authority logo system — spec

**Inventory (Phase 1 — covers every Tier 1-3 source in the ETL):**

| # | Logo | Tier | Treatment |
|---|---|---|---|
| 1 | EPB (Export Promotion Bureau) | 1 (gov) | Original colour + mono variant |
| 2 | BGMEA | 2 | Original colour + mono variant |
| 3 | BKMEA | 2 | Original colour + mono variant |
| 4 | BTMA | 2 | Original colour + mono variant |
| 5 | BGAPMEA | 2 | Original colour + mono variant |
| 6 | RSC (RMG Sustainability Council) | 3 | Original colour + mono variant |
| 7 | OEKO-TEX® STANDARD 100 | 3 | Official mono permitted; use mono in-app, colour on marketing |
| 8 | GOTS (Global Organic Textile Standard) | 3 | Original colour + mono variant |
| 9 | WRAP | 3 | Original colour + mono variant |
| 10 | SA8000 (Social Accountability Intl) | 3 | Original colour + mono variant |
| 11 | Hohenstein (issuer) | 3 | Original colour + mono variant |
| 12 | TESTEX (issuer) | 3 | Original colour + mono variant |
| 13 | Control Union (issuer) | 3 | Original colour + mono variant |
| 14 | amfori (BSCI) | 3 | Original colour + mono variant |
| 15 | Textile Exchange — GRS / OCS / OBCS / RCS | 3 | Original colour + mono variant — these are sub-marks under one umbrella |

**Acquisition rules:**

1. Source files: the **trademark owner's published press / brand kit only**, in this priority order — official brand-kit SVG > official press-kit PNG > a vector traced from the highest-resolution official PNG (mark the file as `-traced.svg` and re-source when an official SVG appears). **No screenshots, no third-party logo aggregators, no AI re-generation.** Document the source URL + retrieval date in `inapp-logos/SOURCES.md`.
2. The current files in [inapp-logos/](inapp-logos/) are **provisional**. Before Phase 1 ship, every one is replaced with an officially-sourced version, and the `SOURCES.md` audit trail is filed.
3. For any logo where the trademark owner publishes a usage policy that conflicts with our in-app rendering (e.g. forbids mono, requires minimum size we can't meet at 16px), we either comply or use a text fallback (§20.4) — we do not "modify slightly to comply." Modification ≠ permission.

**Rendering spec:**

- **File format:** SVG, optimised via SVGO (paths only, no embedded fonts, no embedded raster). Per-logo file size budget: < 8KB. Stored at [public/logos/authorities/{slug}.svg](public/logos/authorities/) (light) and `{slug}-mono.svg` (mono).
- **Optical sizes:** every logo prepared at 4 optical sizes — **16px** (pill icon), **24px** (feed row, card metadata), **40px** (cert badge, hub spoke), **64px** (marketing hero token). Optical means hand-tuned (strokes/letterspacing/proportions adjusted per size), not algorithmically scaled — the WRAP wreath at 16px will not be the WRAP wreath at 64px scaled down, it's a separately-optimised SVG.
- **Mono variant** uses a **single design-token colour** (`--logo-ink`, resolves to `text-primary` from the token system). Never absolute black — must match the page text colour so the logo reads as part of the type layer, not as a separate visual element.
- **Bounding box:** all logos sit inside a normalised square viewbox with **uniform optical padding** (~12% on all sides). Logos visually balance at the same display size — a square BGMEA mark and a wide-aspect BKMEA mark appear equally "weighty" in a feed row.
- **Colour variants** are kept verbatim from the official kit, NOT recoloured to SourceBD's palette. The whole point of showing real authority logos is that they look like themselves.

**Usage matrix:**

| Surface | Variant used |
|---|---|
| Marketing hero spokes (§16.5) — 64px | Original colour |
| §17 ambient logo tokens — 60–72px | Original colour |
| §17 feed row source icon — 24px | Mono |
| Discover result card pill row — 16px | Mono |
| Profile registry pill — 16–24px | Mono |
| Profile cert badge — 40px | Original colour |
| Source-records provenance footer row — 16px | Mono |
| Buyer dashboard newly-verified strip — 24px | Mono |

Rule of thumb: **colour where the logo is the subject of a card (cert badge, hub spoke, hero token), mono where the logo is metadata next to text** (pill, feed row, footer). Prevents the page from looking like a sponsor-logo wall.

### 20.3 RMG product icon set — spec

This is wholly custom IP. Used to represent a supplier's principal product, product category, factory type, and (later) RFQ product type.

**Inventory (Phase 1 — 24 icons):**

Apparel — knit:
1. T-Shirt
2. Polo Shirt
3. Hoodie
4. Sweatshirt
5. Sweater (cardigan / pullover composite)
6. Knit Top (women's)
7. Activewear

Apparel — woven:
8. Woven Shirt (formal)
9. Trouser
10. Jacket
11. Outerwear (heavy coat)
12. Suit
13. Workwear (boilersuit)

Denim & specialty:
14. Denim Jeans
15. Denim Wash (process indicator — washing-machine-with-jeans glyph)

Lingerie / intimate / hosiery:
16. Lingerie
17. Socks / Hosiery
18. Underwear

Children & accessories:
19. Children's Wear
20. Accessories & Trims (zipper / button composite)
21. Headwear (cap)

Home textile:
22. Towel
23. Bedlinen / Home Textile
24. Bag / Sewn Accessory

**Style spec (must match Phosphor — Phase 1 icon family already locked):**

- Single-stroke line icons, **1.5px stroke at 24px base size**, scales to 1.0px at 16px and 2.0px at 32px.
- **Stroke weight:** matches Phosphor's `regular` weight exactly. SourceBD icons must visually sit next to Phosphor icons in a row without one appearing heavier than the other.
- **Corner radius:** 1.5px on internal corners, butt or round line caps consistent with Phosphor regular (round caps).
- **Grid:** 24×24 design grid, 2px keyline padding inside, 20×20 live area.
- **Stylistic vocabulary:** geometric silhouettes, minimum visual flourish, **no cuffs / seams / pockets unless silhouette-defining** (a Polo gets a collar because the collar IS the Polo signifier; a T-Shirt does not get a hemline because it doesn't need one). Each icon must be unambiguous at 16px — silhouette-only legibility is the bar.
- **Mono only.** No colour variants. Coloured via CSS `currentColor` like Phosphor.
- **No animation.** These are utility marks; they participate in §19 motion rules as static icons (hover changes colour at 80ms, that's it).

**File spec:**

- SVG, per-icon < 1.5KB, viewBox `0 0 24 24`, no fills (all strokes), `stroke="currentColor"` `stroke-width="1.5"`.
- Stored at [public/icons/rmg/{slug}.svg](public/icons/rmg/) — slugs are kebab-case singular: `t-shirt.svg`, `polo-shirt.svg`, `denim-jeans.svg`.
- Built into a React component set [components/icons/rmg/](components/icons/rmg/) — one `.tsx` per icon, named `IconRmgTShirt`, `IconRmgPoloShirt`, etc. Each exports a typed component matching Phosphor's icon API: `{ size, weight, color, mirrored, ...svgProps }`. (Only `size` and `color` actually do anything in Phase 1 — `weight` and `mirrored` are no-ops kept for API parity so we can swap with Phosphor seamlessly.)
- A barrel export at [components/icons/rmg/index.ts](components/icons/rmg/index.ts).
- A README frame in the Figma file with all 24 icons at 16 / 24 / 40 px so the designer can audit consistency.

**Where used in-app:**

- **Supplier result card on Discover** — small mono icon next to the "Principal product" line.
- **Profile header** — slightly larger (24px) next to the supplier name + entity-type chip when a principal product is on file.
- **Profile Overview tab — Products section** — a list of icon + label pairs for each product the supplier makes (from `suppliers.products[]` once that column lands; for Phase 1 use the inferred principal-product field).
- **Filter rail on Discover** — Phase 1 if "Product type" filter is in spec; otherwise Phase 2.
- **Newly-verified widget on `/app`** — icon on cards where the event is product-relevant.
- **NOT on marketing surfaces.** RMG product icons stay in `/app`. Marketing uses authority logos, not product icons — keeps the marketing signal "we aggregate verified receipts," not "we sell t-shirts."

### 20.4 Text fallbacks (mandatory for every logo + icon)

For every logo and every RMG icon, design a text-only fallback that renders if the asset fails to load (CSP block, slow network, browser SVG strip, screen reader):

- **Authority logo** → the authority's abbreviation in monospace (`BGMEA`, `OEKO-TEX`, `GOTS`) in the same colour as the mono variant. Same bounding box.
- **RMG icon** → a single emoji-free unicode glyph mapping (e.g. T-Shirt → `T`, Polo → `P`) OR the product name in tiny caps. Designer picks at review.
- Every `<img>` / `<svg>` has a meaningful `alt` and `aria-label`. Screen readers hear "OEKO-TEX certificate" not "image."

### 20.5 Brand-usage compliance — single source of truth

Create [context/brand-asset-policy.md](context/brand-asset-policy.md) as a separate file (NOT inside this brief, because legal / ops referenced separately). Contents:

1. The inventory table from §20.2 + the source URL + retrieval date for every authority logo.
2. The trademark owner's published usage guidelines link, summarised.
3. The standing affiliation disclaimer text (one canonical version, used wherever logos appear).
4. The procedure if a trademark owner sends a takedown / requests modification — who's responsible, response SLA, escalation path.
5. The "we do not modify authority trademarks" rule, stated in plain English.

This file is part of repo docs, kept up to date by whoever ships a new authority logo. It's the file we hand to a lawyer if asked.

### 20.6 Figma deliverable for §20

Add to the Figma file:

- [ ] **Authority logos page** — all 15 logos at 4 optical sizes × 2 variants (colour + mono), one frame per logo, with the source URL noted in a sticky.
- [ ] **RMG icon set page** — all 24 icons at 16 / 24 / 40 px, on a 24×24 grid, alongside the equivalent Phosphor icons for stroke-weight comparison.
- [ ] **In-context examples** — at least 3 frames showing logos+icons in real card contexts (Discover result card, Profile header, Feed row).

### 20.7 What does NOT go into Phase 1

- Brand logos of Western buyers (H&M / Next / M&S / Inditex / ASOS / Primark). These appear on supplier profiles as attribution; same nominative-use rules as authority logos but governed separately. **Backlog as a v2 asset workstream** — Phase 1 ships brand attribution as text-only pills (`Disclosed by H&M`) with no logo. Adding 30+ retailer logos has its own legal review and we don't gate Phase 1 on it.
- Country flags. Not needed — every supplier is in Bangladesh.
- Currency symbols. Not needed in Phase 1.
- Industry-association logos beyond §20.2 inventory. If a new Tier 2 source is added to the ETL, the logo is added to §20.2 + sourced + filed in `brand-asset-policy.md` before the source goes live in-app.

### 20.8 Implementation order (post-design-approval, pre-Phase-1-code)

1. Designer locks the RMG icon set in Figma (own IP — simplest, no legal dependency).
2. Ops / user files official authority logos into `inapp-logos/` with `SOURCES.md` audit trail.
3. Designer normalises authority logos to the §20.2 rendering spec.
4. `brand-asset-policy.md` filed.
5. Phase 1 Spec F1 (base components) bakes the icon + logo systems into the React component layer.

None of this is a Phase 0 deliverable. The brand-asset workstream sits between "design approved" and "Phase 1 spec written."

---

## 21. Prototype outcomes — locked design decisions from `prototypes/` (26 May 2026)

Three coded HTML prototypes were built and iterated against this brief: [prototypes/profile-naafco-group.html](../prototypes/profile-naafco-group.html) (flagship, frame #2/#3), [prototypes/profile-thin-supplier.html](../prototypes/profile-thin-supplier.html) (frame #4), [prototypes/profile-with-sanctions.html](../prototypes/profile-with-sanctions.html) (frame #5). Shared design tokens in [prototypes/_tokens.css](../prototypes/_tokens.css). The iteration loop with the user produced a set of refinements that **override prior sections where they conflict**. Locking them here so Figma + Phase 1 code inherit the same choices.

### 21.1 Brand colour — forest green is the brand surface accent

Prior brief allowed only indigo→teal gradient (§16.4, §19.6), originally on the wordmark only. Real prototypes consistently read as "any-other-B2B-SaaS" with that palette — no brand identity sat on any surface. **User decision: forest green is the brand colour and must be visible across focal surfaces.**

Locked tokens (in [prototypes/_tokens.css](../prototypes/_tokens.css)):

```
--brand-forest:      #1F4D3A   /* deep forest */
--brand-forest-mid:  #2D6A4F
--brand-forest-soft: #ECF3EE
--brand-forest-tint: rgba(31,77,58,0.06)
--accent-grad:       linear-gradient(135deg, #1F4D3A 0%, #2D6A4F 100%)
```

**Rules of use (override §16.4 and §19.6):**

- `--accent-grad` (forest gradient) is the brand surface gradient. Permitted on: SourceBD wordmark, sidebar workspace mark, sidebar active-nav rail, the "Data Moat" freshness card top accent, marketing centre-card hairline glow on §16.5 dot arrival, RFQ "submit" success state. Maximum 6 surfaces — any addition must remove one.
- `--brand-forest` (solid) is permitted for: the "DATA MOAT" mono section label, the §21.4 freshness pulse dot, the active-nav icon, active-item count badge text. Distinct from `--sem-green` (which stays reserved for success / valid / clear semantic states — e.g. the sanctions clear summary banner, cert status pill).
- Forest is **never** used for sanctions red, expiring amber, or any state semantics — those keep their existing semantic tokens.
- `--accent-indigo` is retained for **interactive primitives only**: buttons (`.btn.primary`), text links inside content, focus rings, tab underline, tier-badge text (T1/T2). It is no longer a brand identity colour — only an action colour. This keeps clarity intact on dense data surfaces without confusing brand and interaction.

The "two-place gradient" rule from §19.6 is replaced with the 6-surface ceiling above, and the gradient itself is forest-not-indigo.

### 21.2 Typographic breathing room — base rhythm loosened

The first iteration of the prototype read as visually tight even though every data point was needed. User asked for "breathing space without reducing data." Resolved by loosening the rhythm, not the density:

| Token | Before | After |
|---|---|---|
| `body` line-height | 1.5 | **1.6** |
| `body` letter-spacing | 0 | **-0.005em** |
| `body` text-rendering | (default) | **optimizeLegibility** |
| Section label letter-spacing | 0.08–0.12em | **0.14–0.16em** |
| Nav item padding | 8/12 | **10/14** |
| Nav item font-size | 13 | **13.5** |
| Sidebar gap between items | 2 | **3** |
| Workspace mark | 32px | **36px** |
| Sidebar width | 240px | **272px** |

These values are the new baseline for Phase 1 components. Wherever a card / list / nav uses 13px body text, use line-height 1.5+ and at least 10/14 padding; section labels use mono at 0.14em+ letter-spacing.

### 21.3 Sidebar — locked architecture

Replaces the implicit sidebar layout assumed in §2.1 of `frontend-design-spec.md`. Buyer sidebar is **three rails of structure** wrapped in a recessed warm-cream surface:

1. **Workspace switcher** (top, sticky):
   - 36px gradient brand mark (initials) + workspace name (13.5px semibold) + mono plan badge (`PRO · 14 SEATS`) + chevron.
   - Tappable; opens workspace-switcher menu in Phase 2. Phase 1: opens account menu.

2. **Nav body**, grouped under mono section labels (`SOURCING`, `ENGAGE`, `GOVERNANCE`, `ACCOUNT`):
   - 3-column grid per row (icon · label · badge) so counts right-align consistently.
   - Badges support three variants: `default` (neutral count chip), `dot` (red unread indicator), `alert` (red-soft urgency chip).
   - Active item: white→cream gradient surface, forest gradient left rail (3px), forest-tinted ambient shadow, icon and badge re-tint to forest.
   - Hover: translucent white wash + hairline + 1px lift.
   - Slot list (Phase 1, in order):
     - Sourcing → Discover (with `10,121` data-moat count) · Smart Match (`3 new` alert) · Saved (`12`)
     - Engage → Messages (red unread dot) · RFQ Manager (`7`) · Orders (`2`)
     - Governance → Compliance Hub (`2` alert) · Lists (`5`)
     - Account → Settings

3. **Bottom block** (sticky, `margin-top:auto`), separated by a fading hairline:
   - **"Data Moat" freshness card** — forest gradient top accent, forest pulse dot with brand-tinted halo, verified-suppliers count + last-refresh timestamp. Lives in the sidebar specifically because §1 and §2 of this brief frame the moat as the product's primary trust signal — the rail surface advertises it on every screen.
   - **User pill** — 32px warm-stone avatar + name + role + chevron, opens user menu.

The rail itself uses a vertical gradient `#F3F1E8 → #ECEDE3` (recessed relative to the white main canvas) with a forest-tinted radial bloom in the top-left and bottom-right corners. Right edge: 1px hairline + inner white highlight + 1px outer shadow — produces 3 readable depth layers: recessed rail · standard nav · raised cards.

Supplier and Admin sidebars (§2.2, §2.3 of frontend-design-spec) inherit the same chrome — workspace switcher reflects the supplier company name; bottom freshness card is replaced with role-specific context (Supplier: "Profile completeness 78%"; Admin: "Queue · 17 pending").

### 21.4 Sanctions watchlist — locked layout pattern

Three patterns were tried in the prototype iteration; the locked pattern is the third — **compact 3×2 tile grid** (not a horizontal list of long sentences, not a per-row bordered table).

- 3 columns × 2 rows, gap 10px. Falls to 2 columns under 900px.
- Each tile shows, top to bottom:
  - Top row: jurisdiction mono pill (`US` / `UK` / `EU`) on the left + green circular check badge (18px, sem-green) on the right.
  - Big mono acronym (15px, 700) — `UFLPA`, `OFAC SDN`, `OFSI`, `EU FSF`, `CBP WRO`, `DOL ILAB`.
  - One short authority line (11px, ink-tertiary) — `CBP Entity List`, `U.S. Treasury`, `HM Treasury`, `European Commission`, `U.S. Customs`, `U.S. Labor Dept.`.
- **No dates on individual tiles.** The card meta already says "re-screened weekly" — per-tile dates are redundant noise.
- The grid sits below a single `sanctions-clear` summary banner (sem-green soft surface, "No matches across any watchlist" headline, `Clear` mono status chip).

This is the canonical pattern for any future "N of N status badges" surface (cert summary, registry confirmation, multi-source verification). **Treat the watchlist names as data, the authority strings as metadata, and never run them together as sentences.**

### 21.5 Registries list — locked layout pattern

Replaces the chip-row treatment originally implied for "registry pills." Now a vertical list of rich rows:

- One row per registry membership: 40px square authority mark (mono) · registry name + member-number line · status mono pill (`ACTIVE 2026`) · `View source` link.
- Hairline divider between rows; no card backgrounds on individual rows.
- Pattern reused by: registries (BGMEA, BKMEA, BTMA, BGAPMEA, EPB), accredited cert bodies on a profile, RSC participation rows.

### 21.6 Brand attribution — locked layout pattern

Replaces the generic `docs-list` grid for brand-disclosed factory rows:

- One row per brand, hairline divider between rows. Grid: 240px brand block · description · since-date · actions.
- Brand block = 48px coloured brand mark (H&M red, Inditex navy, Next indigo, etc. — brand's own visual identity, not SourceBD's palette) + brand name (17px display weight 600) + small "since 20XX" caption.
- Description column: short factual line ("Listed in H&M supplier list since 2022 · Tier 1 · Sewing").
- Actions: "View disclosure" link → Bunny CDN doc URL per scheme `brand-disclosures/brand_<brand>/<date>.<ext>`.
- This is the only place brand colours appear on the platform. Brand marks are nominative-use under §20.1 rules; mono fallback per §20.4.

### 21.7 Document links — Bunny CDN scheme is canonical

The two prototypes both use the production Bunny CDN URL scheme for every document link. Locking it as Phase 1 canonical:

- RSC + compliance docs: `https://sourcebd-docs.b-cdn.net/rsc-docs/<slug>/<doc_type>-<YYYY-MM-DD>.<ext>`
- Brand disclosures: `https://sourcebd-docs.b-cdn.net/brand-disclosures/brand_<brand>/<YYYY-MM-DD>.<ext>`

Every "View source" / "View disclosure" / "Download report" link in the app resolves to one of these two patterns. Phase 1 component F1 (`<DocLink>`) takes (`slug`, `doc_type`, `date`, `ext`) or (`brand`, `date`, `ext`) and never accepts a raw URL — keeps the scheme enforced.

### 21.8 What this section does NOT change

To avoid scope creep:

- §19.2 motion list is unchanged. Forest gradient is a colour decision, not a motion decision. Hover lift remains the only ambient liveliness inside `/app`; the rail's forest accents are static.
- §20 authority logo + RMG icon systems are unchanged.
- §2.1 buyer sidebar slot list (frontend-design-spec) is unchanged in *which* slots exist — §21.3 only locks the *visual layout* of those slots.
- Tier badges keep indigo (§19.x, §20.x), not forest. Forest is brand surface only, not data category.

### 21.9 Open items returned to Figma

Mock these patterns at fidelity before Phase 1 code starts:

- [ ] Sidebar at 272px in collapsed + expanded states, including workspace-switcher open menu.
- [ ] Sanctions tile grid in clear (all green) AND hit (one or more red) states — the red-state tile is currently unspecified; design it.
- [ ] Brand attribution row with a brand whose colour mark conflicts with sem-red (Coca-Cola, Target) — confirm fallback rule.
- [ ] Data Moat freshness card variants: fresh (< 24h, green dot), stale (24–72h, amber dot), failed (> 72h or scrape error, red dot + "Last successful refresh 4d ago").

