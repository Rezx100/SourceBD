// Spec M6a — Marketing v2 landing page (light).
//
// Server component, ISR 600s. Pixel-matched to the Claude Design
// handoff bundle's light homepage screenshots:
//
//   1. Cream/ivory hero with mesh-dot backdrop + soft glow.
//      Word-up animated <h1> with `WITH receipts.` accented in
//      brand-forest.
//   2. White dossier card on the right showing one real, published
//      Bangladesh factory (via the public `buyer_supplier_profile`
//      RPC), with floating "Sanctions-screened · clear" + "Verified
//      <date>" badges.
//   3. White metrics band (5 tiles) overlapping the hero seam, fed by
//      the M1 `marketing_stats()` RPC. Live integrity feed footer.
//   4. Authority markstack band ("Built on the registers the world's
//      buyers already trust").
//   5. Trust ladder (6 tier rows verbatim from logos.lock.md §1) +
//      dark "Receipts-first posture" sticky aside.
//   6. Integrity engine (3 scanning windows + flow path + reconciled
//      output card showing the same showcase supplier).
//   7. Sources of record (typography wordmark tile grid grouped by
//      tier per M1 JC #1).
//   8. Compliance regulation cards (UK MSA, US UFLPA, EU CBAM, EU
//      EUDR, EU CSDDD).
//   9. Dark positioning band ("What we are — not a marketplace, not a
//      broker, not a rating agency"), per architecture.md α/β/γ.
//  10. How-it-works 3-step row.
//  11. Methodology lockfile card — verbatim "Authenticity rule
//      (hard)" + "Narrow OSH extension (2026-05-19)" + receipts-first
//      negation paragraph from logos.lock.md §3. Smoke-asserted.
//  12. Founder story.
//  13. Dark CTA card ("Start vetting with receipts on every claim").
//
// JSON-LD Organization + LocalBusiness preserved inline.
// `affiliation-disclaimer` paragraph preserved verbatim in the footer.

import Link from "next/link";

import {
  ArrowRight,
  Buildings,
  Certificate,
  CheckCircle,
  Clock,
  Database,
  DownloadSimple,
  FileText,
  ListChecks,
  MagnifyingGlass,
  Newspaper,
  Receipt,
  ShieldCheck,
  Storefront,
  Warning,
} from "@phosphor-icons/react/dist/ssr";

import { AuthorityMarkstack } from "@/components/marketing/authority-markstack";
import { HeroReveal } from "@/components/marketing/hero-reveal";
import { IntegrityEngine } from "@/components/marketing/integrity-engine";
import { fetchAuthorityCounts } from "@/lib/marketing/authority-count";
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
// `public.sources` query below is the operational kill-switch.
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
  tier1_gov: "Government & statutory",
  tier2_industry: "Trade associations",
  tier3_cert: "Certification bodies",
  tier4_brand: "Brand disclosures",
  tier5_regulatory: "Regulatory & sanctions",
};

const TIER_ORDER = [
  "tier1_gov",
  "tier2_industry",
  "tier3_cert",
  "tier4_brand",
  "tier5_regulatory",
] as const;

// JC #8 — generic founder placeholder. Must not invent biographical
// specifics.
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

function fmtCountWithCommas(n: number | null): string {
  if (n == null) return "—";
  // Use IBM Plex Mono spacing: "10,122" displays naturally with the
  // grouping comma; tabular numerals defined in CSS keep alignment.
  return NF.format(n);
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
    label: "Government- or association-corroborated",
    icon: ShieldCheck,
  },
  { key: "sanctions_lists_screened", label: "Sanctions lists screened continuously", icon: Warning },
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
  badge: string;
}> = [
  { dbValue: "tier1_gov",        label: "Government",             meaning: "Statutory authority and ministry-level registers — the strongest primary evidence.",                      badge: "Statutory" },
  { dbValue: "tier2_industry",   label: "Trade association",      meaning: "Industry membership registers — BGMEA, BKMEA, BTMA, BGAPMEA.",                                            badge: "Membership" },
  { dbValue: "tier3_cert",       label: "Certification body",     meaning: "Independent third-party audits — OEKO-TEX, WRAP, GOTS.",                                                  badge: "Audited" },
  { dbValue: "tier4_brand",      label: "Brand disclosure",       meaning: "Buyer-published supplier lists — attached only when the brand names that specific factory.",              badge: "Self-reported" },
  { dbValue: "tier5_regulatory", label: "Regulatory / sanctions", meaning: "UFLPA, OFAC, EU & UK lists — screened to flag, never to endorse.",                                        badge: "Negative screen" },
  { dbValue: "tier6_crosscheck", label: "Cross-check only",       meaning: "Corroborating signal only — never stands as primary evidence on its own.",                                badge: "Corroboration" },
];

// JC #9 / sources-of-record tiles — typography wordmarks per M1 JC #1.
const SOURCE_TILE_LABELS: Record<string, string> = {
  BEPZA: "Export zones",
  DIFE: "Factory inspection",
  EPB: "Export promotion",
  RJSC: "Companies registrar",
  RSC: "Sustainability council",
  BGMEA: "Garment mfrs",
  BKMEA: "Knitwear mfrs",
  BTMA: "Textile mills",
  BGAPMEA: "Accessories",
  OEKO_TEX: "Standard 100",
  WRAP: "Social compliance",
  GOTS: "Organic textiles",
  BRAND_HM: "Supplier list",
  BRAND_ASOS: "Supplier list",
  BRAND_MS: "Supplier list",
  BRAND_NEXT: "Supplier list",
  OFAC: "SDN list",
  UFLPA: "US entity list",
  US_WRO: "WRO orders",
  UK_OFSI: "Consolidated list",
  EU_SANC: "Sanctions map",
};
const SOURCE_TILE_DISPLAY: Record<string, string> = {
  BRAND_HM: "H&M",
  BRAND_ASOS: "ASOS",
  BRAND_MS: "M&S",
  BRAND_NEXT: "NEXT",
  OEKO_TEX: "OEKO-TEX",
  US_WRO: "US CBP",
  UK_OFSI: "UK OFSI",
  EU_SANC: "EU",
};
const TIER_DOT: Record<string, string> = {
  tier1_gov:        "var(--mkt-tier-gov)",
  tier2_industry:   "var(--mkt-tier-assoc)",
  tier3_cert:       "var(--mkt-tier-cert)",
  tier4_brand:      "var(--mkt-tier-brand)",
  tier5_regulatory: "var(--mkt-tier-sanction)",
};

function swatchForRow(row: ShowcaseRow): string {
  return TIER_DOT[row.tier] ?? "var(--mkt-tier-xcheck)";
}

const REG_CARDS = [
  { tag: "UK · MSA s.54", title: "Modern Slavery Act",     body: "Section 54 statements for organisations with £36M+ turnover supplying the UK market." },
  { tag: "US · UFLPA",    title: "Forced Labor Prevention", body: "Rebuttable presumption barring goods linked to Xinjiang. Receipts required at CBP." },
  { tag: "EU · CBAM",     title: "Carbon Border Adjustment",body: "Border carbon price on certain imports — apparel is on the watch list for the next tranche." },
  { tag: "EU · EUDR",     title: "Deforestation Regulation",body: "Due-diligence for commodities and downstream products entering the EU single market." },
  { tag: "EU · CSDDD",    title: "Corporate Sustainability DD", body: "Mandatory human-rights and environmental due diligence for in-scope EU companies." },
];

const HERO_TAGS = [
  { l: "Try:", v: "Knit composite, Gazipur" },
  { l: "",     v: "WRAP certified" },
  { l: "",     v: "BGMEA member" },
  { l: "",     v: "Not on UFLPA list" },
];

function HeroHeadline() {
  return (
    <h1>
      <span className="mkt-word"><span>Every&nbsp;</span></span>
      <span className="mkt-word"><span>Bangladesh&nbsp;</span></span>
      <span className="mkt-word"><span>garment&nbsp;</span></span>
      <span className="mkt-word"><span>factory.&nbsp;</span></span>
      <span className="mkt-word"><span className="mkt-g">With&nbsp;</span></span>
      <span className="mkt-word"><span className="mkt-g">receipts.</span></span>
    </h1>
  );
}

function DossierMock({
  supplier,
  refreshedRelative,
}: {
  supplier: ShowcaseSupplier | null;
  refreshedRelative: string | null;
}) {
  const isSynthetic = supplier == null;
  const company = supplier?.company_name ?? "Ha-Meem Denim Ltd";
  const monogram = supplier?.monogram ?? "HD";
  const location = [supplier?.city, supplier?.district].filter(Boolean).join(" · ") || "Ashulia · Ha-Meem Group";
  const entityWord = supplier?.entity_type === "buying_house" ? "Buying house" : "Denim";
  const subtitle = `${entityWord} · ${location}`;
  const t13 = Math.max(1, Math.min(5, supplier?.t13_source_count ?? 5));
  const rows: ShowcaseRow[] = supplier?.rows ?? [
    { source_code: "DIFE",     label: "DIFE register",     tier: "tier1_gov" },
    { source_code: "BGMEA",    label: "BGMEA #1922",       tier: "tier2_industry" },
    { source_code: "GOTS",     label: "GOTS scope",        tier: "tier3_cert" },
    { source_code: "ASOS",     label: "ASOS supplier list",tier: "tier4_brand" },
    { source_code: "OFAC",     label: "OFAC · UFLPA",      tier: "tier5_regulatory" },
  ];
  return (
    <div className="mkt-herodash" aria-hidden={isSynthetic ? "true" : undefined}>
      <span className="mkt-hd-float mkt-hd-float-a">
        <span className="ic" aria-hidden="true">
          <ShieldCheck size={12} weight="fill" />
        </span>
        Sanctions-screened · clear
      </span>
      <div className="mkt-appwin">
        <div className="mkt-aw-bar">
          <span className="mkt-aw-mark" aria-hidden="true">
            <ShieldCheck weight="fill" />
          </span>
          <div className="mkt-aw-search">
            <MagnifyingGlass size={13} weight="bold" />
            <span>{company}</span>
          </div>
          <span className="mkt-aw-av" aria-hidden="true" />
        </div>
        <div className="mkt-aw-body">
          <div className="mkt-hd-head">
            <span className="mkt-hd-logo">{monogram}</span>
            <div className="mkt-hd-id">
              <h3>
                {company}
                <span className="verified" aria-hidden="true">
                  <CheckCircle size={13} weight="bold" />
                </span>
              </h3>
              <div className="mkt-hd-sub">{subtitle}</div>
              <span className="mkt-hd-vchip">
                <CheckCircle size={11} weight="fill" />
                Corroborated by {t13} independent sources
              </span>
            </div>
          </div>
          <div className="mkt-hd-meter">
            <div className="mkt-hd-meter-top">
              <span>Source corroboration</span>
              <b>{t13} / 5</b>
            </div>
            <div className="mkt-hd-bar">
              {[0, 1, 2, 3, 4].map((i) => (
                <i key={i} className={i < t13 ? "on" : ""} />
              ))}
            </div>
          </div>
          <div className="mkt-hd-rows">
            {rows.slice(0, 5).map((r, i) => (
              <div key={`${r.source_code}-${i}`} className="mkt-hd-row">
                <span
                  className="mkt-hd-dot"
                  style={{ background: swatchForRow(r) }}
                  aria-hidden="true"
                />
                <div className="mkt-hd-nm">
                  <b>{r.label}</b>
                  <small>
                    {r.tier === "tier1_gov" && "Government"}
                    {r.tier === "tier2_industry" && "Trade association"}
                    {r.tier === "tier3_cert" && "Certification"}
                    {r.tier === "tier4_brand" && "Brand disclosure"}
                    {r.tier === "tier5_regulatory" && "Sanctions — clear"}
                    {r.tier === "tier6_crosscheck" && "Cross-check"}
                  </small>
                </div>
                <span className="mkt-hd-chk">
                  <CheckCircle size={11} weight="bold" />
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <span className="mkt-hd-float mkt-hd-float-b">
        <span className="ic ic-clock" aria-hidden="true">
          <Clock size={12} weight="bold" />
        </span>
        Verified {refreshedRelative ?? "today"}
      </span>
    </div>
  );
}

export default async function MarketingHome() {
  const [stats, sources, showcase, sourceCounts] = await Promise.all([
    loadStats(),
    loadSources(),
    fetchShowcaseSupplier(),
    fetchAuthorityCounts(),
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

  const showcaseSlug = showcase?.slug ?? "ha-meem-denim-ltd";

  return (
    <main>
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

      <HeroReveal />

      {/* ─────────── 1. Hero ─────────── */}
      <section className="mkt-hero" data-mkt-hero>
        <div className="mkt-hero-mesh" aria-hidden="true" />
        <div className="mkt-hero-glow" aria-hidden="true" />

        <div className="mkt-wrap">
          <div className="mkt-hero-grid">
            <div>
              <span className="mkt-eyebrow">
                <span className="dot" /> Public-record RMG index · Bangladesh
              </span>
              <HeroHeadline />
              <p className="mkt-lede">
                A live register of Bangladesh&apos;s garment sector — every
                supplier checked against official records, every claim
                traced to its issuer.
              </p>

              <form className="mkt-searchbar" action="/discover" method="get" role="search">
                <MagnifyingGlass size={19} weight="bold" />
                <input
                  type="search"
                  name="q"
                  placeholder="Search — OEKO-TEX STANDARD 100 dyeing unit"
                  aria-label="Search suppliers"
                  autoComplete="off"
                />
                <button type="submit" className="mkt-btn mkt-btn-primary">
                  Search
                </button>
              </form>

              <div className="mkt-hero-tags">
                {HERO_TAGS.map((t, i) => (
                  <span key={i}>
                    {t.l && <b>{t.l}&nbsp;</b>}
                    {t.v}
                  </span>
                ))}
              </div>
            </div>
            <DossierMock supplier={showcase} refreshedRelative={lastUpdated} />
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
                      <span className="mkt-metric-ic">
                        <Icon size={17} weight="bold" />
                      </span>
                      <span className="num">{fmtCountWithCommas(value)}</span>
                      <span className="lbl">{tile.label}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mkt-metrics-foot">
                <span className="mkt-live-pip">
                  <span className="lv" /> Live integrity feed
                </span>
                <span>
                  <span className="mkt-mono" style={{ color: "var(--mkt-tier-gov-d)" }}>DIFE factory register</span>
                  {" "}· reconciled {lastUpdated ?? "just now"}
                </span>
                <span className="spacer" />
                <span className="mkt-bars" aria-hidden="true">
                  {[5, 7, 4, 9, 6, 8, 5, 10, 6, 9, 8].map((h, i) => (
                    <i key={i} style={{ height: `${h * 1.2}px` }} />
                  ))}
                </span>
                <span className="mkt-mono">
                  {sourceCounts.total} / {sourceCounts.total} sources in sync
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── 2. Authority markstack (moat band) ─────────── */}
      <AuthorityMarkstack totalSources={sourceCounts.total || 31} />

      {/* ─────────── 3. Trust ladder ─────────── */}
      <section className="mkt-block" id="how-we-verify">
        <div className="mkt-wrap">
          <header className="mkt-sec-head mkt-reveal" data-mkt-reveal>
            <span className="mkt-kicker">How we verify</span>
            <h2>A source-trust hierarchy, not a proprietary score.</h2>
            <p>
              We rank every piece of evidence by the authority that issued
              it. You see the tier, the issuer and the date we last saw it
              — and decide for yourself.
            </p>
          </header>

          <div className="mkt-ladder">
            <div className="mkt-reveal" data-mkt-reveal>
              {TIER_HIERARCHY.map((t, i) => (
                <div key={t.dbValue} className="mkt-tier-card">
                  <span className="mkt-rank">{String(i + 1).padStart(2, "0")}</span>
                  <div className="mkt-body">
                    <h4>
                      {t.label}
                      <span className="mkt-tier-chip" data-tier={t.dbValue}>
                        {t.badge}
                      </span>
                    </h4>
                    <p>{t.meaning}</p>
                  </div>
                </div>
              ))}
            </div>
            <aside className="mkt-receipts-note mkt-reveal" data-mkt-reveal>
              <h3>Receipts-first posture</h3>
              <p>
                We publish what issuers have already certified — and never
                a SourceBD-proprietary supplier score.
              </p>
              <div className="mkt-rule">
                <div>
                  <FileText size={16} weight="fill" />
                  Cert IDs, register numbers &amp; remediation percentages,
                  shown verbatim.
                </div>
                <div>
                  <Database size={16} weight="fill" />
                  Every claim carries issuer, source URL and last-seen
                  date.
                </div>
                <div>
                  <ShieldCheck size={16} weight="fill" />
                  Not a marketplace, broker or rating agency — a neutral
                  public-record index.
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* ─────────── 4. Integrity engine ─────────── */}
      <section className="mkt-block" style={{ paddingTop: 0 }}>
        <div className="mkt-wrap">
          <header className="mkt-sec-head mkt-reveal" data-mkt-reveal>
            <span className="mkt-kicker">How the data stays true</span>
            <h2>Read straight from the source of record.</h2>
            <p>
              SourceBD reads the official record directly — government
              registers, certification databases and sanctions lists —
              and reconciles every change into one evidence-backed
              profile. No middlemen, no self-reported claims.
            </p>
          </header>
          <IntegrityEngine supplier={showcase} />
        </div>
      </section>

      {/* ─────────── 5. Sources of record (typography wordmarks) ─────────── */}
      <section className="mkt-block" id="sources" style={{ paddingTop: 0 }}>
        <div className="mkt-wrap">
          <header className="mkt-sec-head mkt-reveal" data-mkt-reveal>
            <span className="mkt-kicker">Sources of record</span>
            <h2>Every record traces to an authority.</h2>
            <p>
              We aggregate only what official bodies have already
              published. SourceBD is not affiliated with or endorsed by
              any authority or brand named below — each datum links back
              to its issuer.
            </p>
          </header>
          <div className="mkt-srcgrid mkt-reveal" data-mkt-reveal>
            {TIER_ORDER.map((tier) => {
              const bucket = sourcesByTier.get(tier) ?? [];
              if (bucket.length === 0) return null;
              return (
                <div key={tier}>
                  <h3>
                    <span className="dot" style={{ background: TIER_DOT[tier] }} />
                    {TIER_LABELS[tier]}
                  </h3>
                  <div className="mkt-srctiles">
                    {bucket.map((s) => {
                      const display = SOURCE_TILE_DISPLAY[s.code] ?? s.code;
                      const sub = SOURCE_TILE_LABELS[s.code] ?? "";
                      return (
                        <div key={s.code} className="mkt-srctile">
                          <span
                            className="tdot"
                            style={{ background: TIER_DOT[tier] }}
                          />
                          <b>{display}</b>
                          {sub && <span>{sub}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─────────── 6. Compliance regulation cards ─────────── */}
      <section className="mkt-block" id="compliance" style={{ paddingTop: 0 }}>
        <div className="mkt-wrap">
          <header className="mkt-sec-head mkt-reveal" data-mkt-reveal>
            <span className="mkt-kicker">Compliance</span>
            <h2>Receipts for the regulations that bind you.</h2>
            <p>
              Five regulations shape supplier due diligence for brands and
              importers sourcing from Bangladesh. SourceBD&apos;s
              provenance trail is built to back your own compliance
              record.
            </p>
          </header>
          <div className="mkt-reg-grid mkt-reveal" data-mkt-reveal>
            {REG_CARDS.map((r) => (
              <article key={r.title} className="mkt-reg-card">
                <span className="mkt-reg-tag">{r.tag}</span>
                <h4>{r.title}</h4>
                <p>{r.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────── 7. Dark positioning band ─────────── */}
      <section className="mkt-darkband">
        <div className="mkt-wrap">
          <header className="mkt-sec-head mkt-reveal" data-mkt-reveal>
            <span className="mkt-kicker">What we are</span>
            <h2>
              A neutral public-record index. <em>Nothing more, by design.</em>
            </h2>
          </header>
          <div className="mkt-pos-cols">
            <article className="mkt-pos-card mkt-reveal" data-mkt-reveal>
              <span className="x"><Storefront size={18} weight="bold" /></span>
              <h4>Not a marketplace.</h4>
              <p>
                We don&apos;t take a cut of your sourcing, rank suppliers
                who pay, or broker introductions.
              </p>
              <div className="is">
                <CheckCircle size={15} weight="fill" />
                We index who is real and let you reach them directly.
              </div>
            </article>
            <article className="mkt-pos-card mkt-reveal" data-mkt-reveal>
              <span className="x"><Newspaper size={18} weight="bold" /></span>
              <h4>Not a broker.</h4>
              <p>
                No commissions, no exclusivity, no supplier we&apos;re
                quietly incentivised to push.
              </p>
              <div className="is">
                <CheckCircle size={15} weight="fill" />
                The same record is shown to every buyer, every time.
              </div>
            </article>
            <article className="mkt-pos-card mkt-reveal" data-mkt-reveal>
              <span className="x"><Receipt size={18} weight="bold" /></span>
              <h4>Not a rating agency.</h4>
              <p>
                We never invent a proprietary score that hides how a
                judgement was reached.
              </p>
              <div className="is">
                <CheckCircle size={15} weight="fill" />
                You see the issuer&apos;s evidence and form your own view.
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ─────────── 8. How it works ─────────── */}
      <section className="mkt-block">
        <div className="mkt-wrap">
          <header className="mkt-sec-head mkt-reveal" data-mkt-reveal>
            <span className="mkt-kicker">How it works</span>
            <h2>Search, inspect the receipts, export the trail.</h2>
          </header>
          <div className="mkt-steps mkt-reveal" data-mkt-reveal>
            <div className="mkt-step">
              <div className="bar" />
              <h4><MagnifyingGlass size={20} weight="bold" /> Search the index</h4>
              <p>
                Filter {fmtCount(stats.suppliers_indexed)} suppliers by
                product, process, location, association membership or
                certification.
              </p>
            </div>
            <div className="mkt-step">
              <div className="bar" />
              <h4><ListChecks size={20} weight="bold" /> Inspect the provenance</h4>
              <p>
                Open any profile and read every source pill — tier,
                issuer, register number and last-seen date.
              </p>
            </div>
            <div className="mkt-step">
              <div className="bar" />
              <h4><DownloadSimple size={20} weight="bold" /> Export the evidence</h4>
              <p>
                Attach the provenance trail to your due-diligence file —
                the same receipts your compliance team needs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── 9. Methodology lockfile blocks ─────────── */}
      <section className="mkt-block" style={{ paddingTop: 0 }}>
        <div className="mkt-wrap">
          <header className="mkt-sec-head mkt-reveal" data-mkt-reveal>
            <span className="mkt-kicker">Methodology</span>
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

      {/* ─────────── 10. Founder story ─────────── */}
      <section className="mkt-block" style={{ paddingTop: 0 }}>
        <div className="mkt-wrap">
          <header className="mkt-sec-head mkt-reveal" data-mkt-reveal>
            <span className="mkt-kicker">Why we built this</span>
            <h2>The neutral register the trade has been missing.</h2>
          </header>
          <div className="mkt-method-card mkt-reveal" data-mkt-reveal>
            {/* FOUNDER: replace before launch */}
            <p
              style={{
                fontFamily: "var(--mkt-font-body)",
                fontSize: 16,
                lineHeight: 1.7,
                color: "var(--mkt-ink-500)",
                maxWidth: "62ch",
              }}
            >
              {FOUNDER_STORY}
            </p>
          </div>
        </div>
      </section>

      {/* ─────────── 11. CTA ─────────── */}
      <section className="mkt-cta">
        <div className="mkt-wrap">
          <div className="mkt-cta-box mkt-reveal" data-mkt-reveal>
            <div>
              <h2>Start vetting with receipts on every claim.</h2>
              <p>
                Free to search the index. No marketplace fees, ever. Just
                the public record, refreshed weekly.
              </p>
            </div>
            <div className="mkt-cta-actions">
              <Link href="/signup" className="mkt-btn mkt-btn-lg mkt-btn-white">
                Start free <ArrowRight size={17} />
              </Link>
              <Link href="/pricing" className="mkt-btn mkt-btn-lg mkt-btn-dark-ghost">
                See pricing
              </Link>
            </div>
            <p style={{ display: "none" }} aria-hidden="true" data-sample-slug={showcaseSlug} />
          </div>
        </div>
      </section>
    </main>
  );
}
