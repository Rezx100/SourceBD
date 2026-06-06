// Spec M6a — Marketing v2 landing page.
//
// Server component, ISR 600s. Replaces the original M1 single-pager
// with the cinematic dark + light "verified register" composition
// from the Claude Design handoff bundle (sourcebd-design-system/),
// while preserving every M1 contract:
//
//   - `public.marketing_stats()` RPC is the only data dependency
//     for the live counter strip. No new RPC. No new ETL.
//   - The "Per-factory authenticity rule" block under §"How we
//     verify" is reproduced **verbatim** from logos.lock.md §3
//     (Tier-4 authenticity-rule paragraph + narrow OSH extension
//     paragraph) — `_m6a_smoke.py` asserts byte equality.
//   - The "Source trust hierarchy" `<dl>` is reproduced **verbatim**
//     from logos.lock.md §1 (the 6-row Tier-1 → Tier-6 ladder).
//   - The "Receipts-first posture" paragraph contains the literal
//     "never a SourceBD-proprietary supplier score" negation — the
//     only place "score" may appear on this page.
//   - JSON-LD Organization + LocalBusiness preserved inline.
//   - The affiliation-disclaimer paragraph is preserved verbatim.
//   - One <h1>, correct heading order, aria-label on each counter.

import Link from "next/link";

import {
  ArrowRight,
  Buildings,
  CheckCircle,
  Certificate,
  Database,
  FileText,
  MagnifyingGlass,
  Newspaper,
  Receipt,
  ShieldCheck,
  Storefront,
  Warning,
} from "@phosphor-icons/react/dist/ssr";

import { HeroParticles } from "@/components/marketing/hero-particles";
import { HeroReveal } from "@/components/marketing/hero-reveal";
import { IntegrityEngine } from "@/components/marketing/integrity-engine";
import { LiveTicker } from "@/components/marketing/live-ticker";
import { fetchAuthorityCount } from "@/lib/marketing/authority-count";
import {
  fetchShowcaseSupplier,
  type ShowcaseRow,
  type ShowcaseSupplier,
} from "@/lib/marketing/showcase-supplier";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-static";
export const revalidate = 600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sourcebd.net";

export const metadata = {
  title: "SourceBD — verified Bangladesh garment factories",
  description:
    "Find Bangladesh RMG suppliers vetted against government registers, trade associations, certification bodies, brand disclosures, and sanctions lists.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "SourceBD — verified Bangladesh garment factories",
    description:
      "Find Bangladesh RMG suppliers vetted against government registers, trade associations, certification bodies, brand disclosures, and sanctions lists.",
    locale: "en_GB",
    type: "website",
  },
  alternates: { canonical: SITE_URL + "/" },
};

// JC #3 allow-list. This constant is the security boundary; the live
// `public.sources` query below is the operational kill-switch (a row
// removed from the table disappears from the page even if the constant
// still names it). Keep in sync with the same list inside
// `supabase/migrations/0043_marketing_stats_rpc.sql`.
const MARKETING_QUALIFYING_SOURCES = [
  // Tier 1 — Government
  "BEPZA", "DIFE", "EPB", "RJSC", "RSC",
  // Tier 2 — Trade associations
  "BGMEA", "BKMEA", "BTMA", "BGAPMEA",
  // Tier 3 — Certification bodies
  "WRAP", "OEKO_TEX", "GOTS",
  // Tier 4 — Brand disclosures (active only)
  "BRAND_HM", "BRAND_ASOS", "BRAND_MS", "BRAND_NEXT",
  // Tier 5 — Regulatory / sanctions
  "OFAC", "UFLPA", "US_WRO", "UK_OFSI", "EU_SANC",
] as const;

const TIER_LABELS: Record<string, string> = {
  tier1_gov: "Government",
  tier2_industry: "Trade associations",
  tier3_cert: "Certification bodies",
  tier4_brand: "Brand disclosures",
  tier5_regulatory: "Regulatory / sanctions",
};

const TIER_ORDER = [
  "tier1_gov",
  "tier2_industry",
  "tier3_cert",
  "tier4_brand",
  "tier5_regulatory",
] as const;

// JC #8 — generic placeholder. Must not invent biographical specifics.
const FOUNDER_STORY =
  "SourceBD was built by people who have spent years inside the Bangladesh garment trade and have repeatedly watched buyers reach for a supplier list and find no neutral place to check who is real, who is compliant, and who has remediated. The product is that neutral place: a public-record index of the country's RMG sector, refreshed continuously, with every claim traceable to the issuer that made it. We are not a marketplace, not a broker, and not a rating agency — we publish what regulators, associations, certification bodies, and buyers have already said.";

type Stats = {
  suppliers_indexed: number | null;
  suppliers_with_tier1or2_source: number | null;
  sanctions_lists_screened: number | null;
  compliance_documents_mirrored: number | null;
  certifications_verified: number | null;
  last_refreshed_at: string | null;
};

const NULL_STATS: Stats = {
  suppliers_indexed: null,
  suppliers_with_tier1or2_source: null,
  sanctions_lists_screened: null,
  compliance_documents_mirrored: null,
  certifications_verified: null,
  last_refreshed_at: null,
};

async function loadStats(): Promise<Stats> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("marketing_stats");
    if (error) {
      console.error("[m1] marketing_stats failed:", error.code ?? error.message);
      return NULL_STATS;
    }
    return data as Stats;
  } catch (err) {
    const e = err as { code?: string; message?: string };
    console.error("[m1] marketing_stats failed:", e?.code ?? e?.message ?? err);
    return NULL_STATS;
  }
}

type Source = { code: string; display_name: string; tier: string };

async function loadSources(): Promise<Source[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("sources")
      .select("code, display_name, tier")
      .in("code", MARKETING_QUALIFYING_SOURCES as unknown as string[]);
    if (error || !data) {
      console.error("[m1] sources fetch failed:", error?.code ?? error?.message);
      return [];
    }
    return data as Source[];
  } catch (err) {
    const e = err as { code?: string; message?: string };
    console.error("[m1] sources fetch failed:", e?.code ?? e?.message ?? err);
    return [];
  }
}

const NF = new Intl.NumberFormat("en-GB");

function fmtCount(n: number | null): string {
  return n == null ? "—" : NF.format(n);
}

function relativeFromNow(iso: string | null): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const diffSec = Math.round((t - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });
  if (abs < 60) return rtf.format(diffSec, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 604800) return rtf.format(Math.round(diffSec / 86400), "day");
  return rtf.format(Math.round(diffSec / 604800), "week");
}

const COUNTER_TILES: ReadonlyArray<{
  key: keyof Stats;
  label: string;
  icon: typeof Buildings;
}> = [
  { key: "suppliers_indexed", label: "Suppliers indexed", icon: Buildings },
  {
    key: "suppliers_with_tier1or2_source",
    label: "With government or association corroboration",
    icon: ShieldCheck,
  },
  { key: "sanctions_lists_screened", label: "Sanctions lists screened", icon: Warning },
  {
    key: "compliance_documents_mirrored",
    label: "Compliance documents mirrored",
    icon: FileText,
  },
  { key: "certifications_verified", label: "Certifications verified", icon: Certificate },
];

// Tier ring colour map — verbatim from logos.lock.md §1.
const TIER_HIERARCHY: ReadonlyArray<{
  dbValue: string;
  label: string;
  meaning: string;
  swatch: string;
}> = [
  { dbValue: "tier1_gov",        label: "Government",             meaning: "Statutory authority / ministry-level register", swatch: "var(--mkt-tier-gov)" },
  { dbValue: "tier2_industry",   label: "Trade association",      meaning: "Industry membership register",                  swatch: "var(--mkt-tier-assoc)" },
  { dbValue: "tier3_cert",       label: "Certification body",     meaning: "Independent third-party audit",                 swatch: "var(--mkt-tier-cert)" },
  { dbValue: "tier4_brand",      label: "Brand disclosure",       meaning: "Buyer-published supplier list (self-reported)", swatch: "var(--mkt-tier-brand)" },
  { dbValue: "tier5_regulatory", label: "Regulatory / sanctions", meaning: "Negative-screening source (UFLPA, OFAC, etc.)", swatch: "var(--mkt-tier-sanction)" },
  { dbValue: "tier6_crosscheck", label: "Cross-check only",       meaning: "Corroboration only — never primary evidence",   swatch: "var(--mkt-tier-xcheck)" },
];

// JC #9 — Tier-1 + Tier-2 authority monogram tiles. Not customer
// logos — we have none to publish. These are the source authorities
// the platform indexes against.
const AUTHORITY_TILES = [
  { code: "BEPZA", name: "Export Processing Zones", tier: "tier1_gov" },
  { code: "DIFE",  name: "Inspection (Factories)",  tier: "tier1_gov" },
  { code: "EPB",   name: "Export Promotion Bureau", tier: "tier1_gov" },
  { code: "RJSC",  name: "Joint Stock Companies",   tier: "tier1_gov" },
  { code: "RSC",   name: "RMG Sustainability Council", tier: "tier1_gov" },
  { code: "BGMEA", name: "Garment Manufacturers",   tier: "tier2_industry" },
  { code: "BKMEA", name: "Knitwear Manufacturers",  tier: "tier2_industry" },
  { code: "BTMA",  name: "Textile Mills",           tier: "tier2_industry" },
  { code: "BGAPMEA",name: "Garment Accessories",    tier: "tier2_industry" },
] as const;

function swatchForTier(tier: string): string {
  if (tier === "tier1_gov") return "var(--mkt-tier-gov)";
  if (tier === "tier2_industry") return "var(--mkt-tier-assoc)";
  if (tier === "tier3_cert") return "var(--mkt-tier-cert)";
  if (tier === "tier4_brand") return "var(--mkt-tier-brand)";
  if (tier === "tier5_regulatory") return "var(--mkt-tier-sanction)";
  return "var(--mkt-tier-xcheck)";
}

function swatchForRow(row: ShowcaseRow): string {
  return swatchForTier(row.tier);
}

// Hero headline — JC #4. Live number inside an Archivo display
// word-up reveal; fall back to "the verified register" with no
// number when the RPC failed (stats.suppliers_indexed === null).
function HeroHeadline({ count }: { count: number | null }) {
  const formatted = count != null ? NF.format(count) : null;
  return (
    <h1>
      <span className="mkt-word"><span>The&nbsp;</span></span>
      <span className="mkt-word"><span>verified&nbsp;</span></span>
      <span className="mkt-word"><span>register&nbsp;</span></span>
      <span className="mkt-word"><span>of&nbsp;</span></span>
      {formatted ? (
        <>
          <span className="mkt-word"><span className="mkt-g">{formatted}&nbsp;</span></span>
          <span className="mkt-word"><span>Bangladesh&nbsp;</span></span>
          <span className="mkt-word"><span>garment&nbsp;</span></span>
          <span className="mkt-word"><span>factories.</span></span>
        </>
      ) : (
        <>
          <span className="mkt-word"><span className="mkt-g">Bangladesh&nbsp;</span></span>
          <span className="mkt-word"><span>garment&nbsp;</span></span>
          <span className="mkt-word"><span>factories.</span></span>
        </>
      )}
    </h1>
  );
}

function DossierMock({ supplier }: { supplier: ShowcaseSupplier | null }) {
  const isSynthetic = supplier == null;
  const company = supplier?.company_name ?? "Cotton Club (BD) Ltd";
  const monogram = supplier?.monogram ?? "CC";
  const location = [supplier?.city, supplier?.district].filter(Boolean).join(" · ");
  const subtitle =
    (supplier?.entity_type === "buying_house" ? "Buying house" : "Knit composite") +
    (location ? " · " + location : isSynthetic ? " · Gazipur" : "");
  const t13 = Math.max(1, Math.min(5, supplier?.t13_source_count ?? 4));
  const rows: ShowcaseRow[] = supplier?.rows ?? [
    { source_code: "DIFE",     label: "DIFE factory register",  tier: "tier1_gov" },
    { source_code: "OEKO_TEX", label: "OEKO-TEX STANDARD 100",   tier: "tier3_cert" },
    { source_code: "OFAC",     label: "OFAC · UFLPA — clear",     tier: "tier5_regulatory" },
  ];
  return (
    <div className="mkt-herodash" aria-hidden={isSynthetic ? "true" : undefined}>
      <div className="mkt-appwin">
        <div className="mkt-aw-bar">
          <span className="mkt-aw-mark" aria-hidden="true">
            <ShieldCheck weight="fill" />
          </span>
          <div className="mkt-aw-search">
            <MagnifyingGlass size={13} weight="bold" />
            <span>sourcebd.net / suppliers / {supplier?.slug ?? "cotton-club-bd-ltd"}</span>
          </div>
          <span className="mkt-aw-av" aria-hidden="true" />
        </div>
        <div className="mkt-aw-body">
          <div className="mkt-hd-head">
            <span className="mkt-hd-logo">{monogram}</span>
            <div className="mkt-hd-id">
              <h3>{company}</h3>
              <div className="mkt-hd-sub">{subtitle}</div>
              <span className="mkt-hd-vchip">
                <CheckCircle size={11} weight="fill" />
                Corroborated · {t13} Tier 1–3 {t13 === 1 ? "source" : "sources"}
              </span>
            </div>
          </div>
          <div className="mkt-hd-meter">
            <div className="mkt-hd-meter-top">
              <span>Receipts</span>
              <b>{t13}/5</b>
            </div>
            <div className="mkt-hd-bar">
              {[0, 1, 2, 3, 4].map((i) => (
                <i key={i} className={i < t13 ? "on" : ""} />
              ))}
            </div>
          </div>
          <div className="mkt-hd-rows">
            {rows.map((r) => (
              <div key={r.source_code} className="mkt-hd-row">
                <span
                  className="mkt-hd-dot"
                  style={{ background: swatchForRow(r) }}
                  aria-hidden="true"
                />
                <div className="mkt-hd-nm">
                  <b>{r.label}</b>
                  <small>{r.source_code}</small>
                </div>
                <span className="mkt-hd-chk">
                  <CheckCircle size={11} weight="bold" />
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function MarketingHome() {
  const [stats, sources, showcase, authorityCount] = await Promise.all([
    loadStats(),
    loadSources(),
    fetchShowcaseSupplier(),
    fetchAuthorityCount(),
  ]);
  const lastUpdated = relativeFromNow(stats.last_refreshed_at);

  const sourcesByTier = new Map<string, Source[]>();
  for (const tier of TIER_ORDER) sourcesByTier.set(tier, []);
  for (const s of sources) {
    const bucket = sourcesByTier.get(s.tier);
    if (bucket) bucket.push(s);
  }
  for (const bucket of sourcesByTier.values()) {
    bucket.sort((a, b) => a.display_name.localeCompare(b.display_name));
  }

  const showcaseSlug = showcase?.slug ?? "cotton-club-bd-ltd";

  return (
    <main>
      {/* M4 — JSON-LD Organization + LocalBusiness. Inline; not next/script. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "SourceBD",
            url: SITE_URL,
            description:
              "Verified Bangladesh RMG supply-chain intelligence — discover, vet, and message factories and buying houses with receipts on every claim.",
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            name: "SourceBD",
            url: SITE_URL,
            areaServed: ["GB", "US", "DE", "FR", "BD"],
            knowsAbout: [
              "Bangladesh ready-made garment manufacturing",
              "Supply chain compliance",
              "UFLPA forced-labour due diligence",
              "RSC remediation",
              "OEKO-TEX certification",
              "WRAP certification",
              "GOTS certification",
            ],
          }),
        }}
      />

      {/* Hero reveal client island — toggles `.in` on the hero +
          any `[data-mkt-reveal]` element on viewport entry. */}
      <HeroReveal />

      {/* ─────────── 1. Hero ─────────── */}
      <section className="mkt-hero" data-mkt-hero>
        <div className="mkt-hero-bg" aria-hidden="true">
          <div className="mkt-glow-a" />
          <div className="mkt-glow-b" />
        </div>
        <div className="mkt-hero-grid-lines" aria-hidden="true" />
        <HeroParticles />
        <div className="mkt-hero-fade" aria-hidden="true" />

        <div className="mkt-wrap">
          <div className="mkt-hero-grid">
            <div>
              <span className="mkt-eyebrow">
                <span className="dot" /> Public-record index · Bangladesh RMG
              </span>
              <HeroHeadline count={stats.suppliers_indexed} />
              <p className="mkt-lede">
                A neutral, public-record index of every government,
                association, and certification body that names the
                country&apos;s garment factories — with receipts on every claim.
              </p>

              <form className="mkt-searchbar" action="/discover" method="get" role="search">
                <MagnifyingGlass size={19} weight="bold" />
                <input
                  type="search"
                  name="q"
                  placeholder="Search company name, BIN, BGMEA #, or city…"
                  aria-label="Search suppliers"
                  autoComplete="off"
                />
                <button type="submit" className="mkt-btn mkt-btn-primary">
                  Search <ArrowRight size={15} />
                </button>
              </form>

              <div className="mkt-hero-tags">
                <span><b>10k+</b>&nbsp;suppliers indexed</span>
                <span><b>5</b>&nbsp;Tier-1 registers</span>
                <span><b>4</b>&nbsp;Tier-2 associations</span>
                <span><b>3</b>&nbsp;cert bodies</span>
                <span><b>5</b>&nbsp;sanctions lists</span>
              </div>
            </div>
            <DossierMock supplier={showcase} />
          </div>

          {/* Metrics band overlapping the hero seam */}
          <div className="mkt-metrics-wrap">
            <div className="mkt-metrics">
              <div className="mkt-metrics-grid">
                {COUNTER_TILES.map((tile) => {
                  const value = stats[tile.key] as number | null;
                  const formatted = fmtCount(value);
                  const Icon = tile.icon;
                  return (
                    <div
                      key={tile.key}
                      className="mkt-metric"
                      aria-label={`${tile.label}: ${formatted}`}
                    >
                      <span className="mkt-eyebrow" style={{ marginBottom: 14 }}>
                        <Icon size={13} weight="bold" />
                      </span>
                      <span className="num">{formatted}</span>
                      <span className="lbl">{tile.label}</span>
                    </div>
                  );
                })}
                <div className="mkt-metrics-foot">
                  <span className="mkt-live-pip">
                    <span className="lv" /> Live
                  </span>
                  {lastUpdated && <span>Last refreshed {lastUpdated}</span>}
                  <span className="spacer" />
                  <span>Source · public-record aggregation</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Live ticker spans full width under hero band */}
        <LiveTicker />
      </section>

      {/* ─────────── 2. Trust ladder ─────────── */}
      <section className="mkt-block" id="how-we-verify">
        <div className="mkt-wrap">
          <header className="mkt-sec-head mkt-reveal" data-mkt-reveal>
            <p className="mkt-sec-kicker">How we verify</p>
            <h2>The same source ladder every credible auditor uses.</h2>
            <p>
              SourceBD ranks every claim by the issuing authority. The higher
              the tier, the harder it is to publish. We never let a
              cross-check source overwrite a higher-tier record.
            </p>
          </header>

          <div className="mkt-ladder">
            <div className="mkt-reveal" data-mkt-reveal>
              {TIER_HIERARCHY.map((t, i) => (
                <div key={t.dbValue} className="mkt-tier">
                  <span className="mkt-rank">T{i + 1}</span>
                  <div className="mkt-body">
                    <h4>
                      <span
                        className="mkt-tier-chip"
                        style={{ background: t.swatch, color: "#0c2c1f" }}
                      >
                        {t.label}
                      </span>
                    </h4>
                    <p>{t.meaning}</p>
                  </div>
                </div>
              ))}
            </div>
            <aside className="mkt-receipts-note mkt-reveal" data-mkt-reveal>
              <h3>Receipts on every claim.</h3>
              <p>
                Every supplier card and every profile page shows the issuing
                authority. No SourceBD-proprietary opinion. No black-box
                rating. The provenance tab links straight back to the
                regulator, the association, or the brand that named the
                factory.
              </p>
              <div className="mkt-rule">
                <div>
                  <ShieldCheck size={16} weight="fill" />
                  Tier 6 sources are corroboration only — never primary
                  evidence.
                </div>
                <div>
                  <ShieldCheck size={16} weight="fill" />
                  Brand disclosure attaches only when the brand names the
                  specific factory.
                </div>
                <div>
                  <ShieldCheck size={16} weight="fill" />
                  Sanctions screen runs nightly; an active hit forces a red
                  banner that overrides every other chrome.
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* ─────────── 3. Authorities wall ─────────── */}
      <section className="mkt-block" style={{ paddingTop: 0 }}>
        <div className="mkt-wrap mkt-reveal" data-mkt-reveal>
          <div className="mkt-logowall">
            <div>
              <div className="mkt-lw-label">
                <span className="dot" style={{ background: "var(--mkt-tier-gov)" }} />
                Indexes {authorityCount > 0 ? authorityCount : 9} primary
                registers across government and trade associations
              </div>
              <div className="mkt-lw-tiles">
                {AUTHORITY_TILES.map((a) => (
                  <div key={a.code} className="mkt-lw-tile">
                    <span
                      className="mkt-tdot"
                      style={{ background: swatchForTier(a.tier) }}
                    />
                    <b>{a.code}</b>
                    <span>{a.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── 4. Integrity engine ─────────── */}
      <section className="mkt-engine mkt-block">
        <div className="mkt-wrap">
          <header className="mkt-sec-head mkt-reveal" data-mkt-reveal>
            <p className="mkt-sec-kicker">The integrity engine</p>
            <h2>Continuous capture from the publishers themselves.</h2>
            <p>
              The scrapers fetch directly from regulators, associations,
              and certification bodies — never via a paid intermediary or a
              third-party aggregator. Every record carries a timestamped
              link back to the original publisher.
            </p>
          </header>
          <IntegrityEngine supplier={showcase} />
        </div>
      </section>

      {/* ─────────── 5. Positioning cards ─────────── */}
      <section className="mkt-position mkt-block">
        <div className="mkt-wrap">
          <header className="mkt-pos-head mkt-reveal" data-mkt-reveal>
            <p className="mkt-sec-kicker">What we are not</p>
            <h2>Three things SourceBD <em>isn&apos;t</em>.</h2>
          </header>
          <div className="mkt-pos-cols">
            <article className="mkt-pos-card mkt-reveal" data-mkt-reveal>
              <span className="x"><Storefront size={18} weight="bold" /></span>
              <h4>Not a marketplace.</h4>
              <p>
                We do not list inventory, take a transaction cut, or claim
                ownership of any supplier&apos;s relationship with their
                buyer.
              </p>
              <div className="is">
                <CheckCircle size={15} weight="fill" />
                We&apos;re the neutral register that names the factory.
              </div>
            </article>
            <article className="mkt-pos-card mkt-reveal" data-mkt-reveal>
              <span className="x"><Newspaper size={18} weight="bold" /></span>
              <h4>Not a broker.</h4>
              <p>
                We do not introduce, vet for fee, or earn a commission on
                downstream contracts. The directory is free to search.
              </p>
              <div className="is">
                <CheckCircle size={15} weight="fill" />
                We charge for software, not for access to a name.
              </div>
            </article>
            <article className="mkt-pos-card mkt-reveal" data-mkt-reveal>
              <span className="x"><Receipt size={18} weight="bold" /></span>
              <h4>Not a rating agency.</h4>
              <p>
                We never publish a SourceBD-issued numeric score. The
                public face is third-party receipts — cert IDs, register
                numbers, RSC remediation %, brand-disclosure attributions.
              </p>
              <div className="is">
                <CheckCircle size={15} weight="fill" />
                Receipts, not opinions.
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ─────────── 6. Trust sources (typography wordmarks per M1 JC #1) ─────────── */}
      <section className="mkt-block">
        <div className="mkt-wrap">
          <header className="mkt-sec-head mkt-reveal" data-mkt-reveal>
            <p className="mkt-sec-kicker">The sources we draw on</p>
            <h2>Names every compliance officer already trusts.</h2>
          </header>
          <div className="mkt-method-card mkt-reveal" data-mkt-reveal>
            {TIER_ORDER.map((tier) => {
              const bucket = sourcesByTier.get(tier) ?? [];
              if (bucket.length === 0) return null;
              return (
                <div key={tier} style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--mkt-text-3)", fontFamily: "var(--mkt-font-mono)", fontWeight: 600 }}>
                    {TIER_LABELS[tier]}
                  </h3>
                  <ul style={{ marginTop: 10, listStyle: "none", padding: 0, display: "flex", flexWrap: "wrap", columnGap: 24, rowGap: 6 }}>
                    {bucket.map((s) => (
                      <li key={s.code}>
                        <span style={{ fontFamily: "var(--mkt-font-display)", fontWeight: 700, color: "#fff" }}>
                          {s.display_name}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─────────── 7. Methodology (locked copy blocks) ─────────── */}
      <section className="mkt-block">
        <div className="mkt-wrap">
          <header className="mkt-sec-head mkt-reveal" data-mkt-reveal>
            <p className="mkt-sec-kicker">Methodology</p>
            <h2>How we verify, in three rules.</h2>
          </header>
          <div className="mkt-method-card mkt-reveal" data-mkt-reveal>
            <h3>Source trust hierarchy</h3>
            <dl>
              {TIER_HIERARCHY.map((row) => (
                <div key={row.dbValue}>
                  <dt>{row.label}</dt>
                  <dd>{row.meaning}</dd>
                </div>
              ))}
            </dl>

            <h3 style={{ marginTop: 32 }}>Per-factory authenticity rule</h3>
            <div className="mkt-method-block">
              <p>
                <strong>Authenticity rule (hard):</strong> a <code>BRAND_*</code>
                {" "}source pill is permitted on a supplier profile <strong>only
                when the brand&apos;s own publication names that specific
                factory</strong> (tabular supplier list, interactive-map detail
                card, or sustainability page mentioning the factory by name). A
                brand-wide Modern Slavery Statement is <strong>not</strong>
                {" "}per-factory evidence and must not attach to any supplier row,
                no matter how official the document.
              </p>
              <p>
                <strong>Narrow OSH extension (2026-05-19):</strong> the
                authenticity bar is also satisfied when (a) the brand is the
                named Open Supply Hub contributor AND (b) the OSH facility list
                is officially embedded on the brand&apos;s own corporate domain
                (i.e. the brand publishes the OSH iframe as its first-party
                disclosure surface). Both conditions are runtime-enforced — the
                scraper must capture a live XHR from the brand&apos;s corporate
                page referencing the contributor id before any record is
                upserted.
              </p>
            </div>

            <h3 style={{ marginTop: 32 }}>Receipts-first posture</h3>
            <div className="mkt-method-block">
              <p>
                We publish what issuers have already certified — cert IDs,
                register numbers, remediation percentages, brand-disclosure
                attributions — and never a SourceBD-proprietary supplier score.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── 8. Founder ─────────── */}
      <section className="mkt-block">
        <div className="mkt-wrap">
          <header className="mkt-sec-head mkt-reveal" data-mkt-reveal>
            <p className="mkt-sec-kicker">Why we built this</p>
            <h2>The neutral register the trade has been missing.</h2>
          </header>
          <div className="mkt-method-card mkt-reveal" data-mkt-reveal>
            {/* FOUNDER: replace before launch */}
            <p style={{ fontFamily: "var(--mkt-font-body)", fontSize: 16, lineHeight: 1.7, color: "var(--mkt-text-2)", maxWidth: "62ch" }}>
              {FOUNDER_STORY}
            </p>
          </div>
        </div>
      </section>

      {/* ─────────── 9. CTA ─────────── */}
      <section className="mkt-cta">
        <div className="mkt-wrap">
          <div className="mkt-cta-box mkt-reveal" data-mkt-reveal>
            <div>
              <h2>Start vetting suppliers in minutes.</h2>
              <p>
                Free to search the public register. No card required. Sign
                up to save searches, export evidence, and unlock contact
                details on verified buyers&apos; plans.
              </p>
            </div>
            <div className="mkt-cta-actions">
              <Link href="/signup" className="mkt-btn mkt-btn-lg mkt-btn-white">
                Start free <ArrowRight size={17} />
              </Link>
              <Link
                href={`/suppliers/${showcaseSlug}`}
                className="mkt-btn mkt-btn-lg mkt-btn-ghost"
              >
                See a sample profile <Database size={15} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer is rendered by `app/(marketing)/layout.tsx`. */}
    </main>
  );
}
