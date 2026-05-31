// Spec M1 — Marketing landing page.
//
// Server component, ISR 600s. Single anon-callable RPC drives the live
// counter strip. No PII / no SBI / no per-supplier rows crosses this
// boundary. Methodology copy is verbatim transcription of
// `context/logos.lock.md` §1 (tier ring colour map) and §3 (Tier 4
// authenticity rule + narrow OSH extension) — do not paraphrase, the
// M1 smoke harness asserts text equality against `logos.lock.md`.

import Link from "next/link";
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

const COUNTER_TILES: ReadonlyArray<{ key: keyof Stats; label: string }> = [
  { key: "suppliers_indexed", label: "Suppliers indexed" },
  {
    key: "suppliers_with_tier1or2_source",
    label: "Suppliers with government or association corroboration",
  },
  { key: "sanctions_lists_screened", label: "Sanctions lists screened" },
  { key: "compliance_documents_mirrored", label: "Compliance documents mirrored" },
  { key: "certifications_verified", label: "Certifications verified" },
];

// Tier ring colour map — verbatim from logos.lock.md §1.
const TIER_HIERARCHY: ReadonlyArray<{
  dbValue: string;
  label: string;
  meaning: string;
}> = [
  { dbValue: "tier1_gov",        label: "Government",             meaning: "Statutory authority / ministry-level register" },
  { dbValue: "tier2_industry",   label: "Trade association",      meaning: "Industry membership register" },
  { dbValue: "tier3_cert",       label: "Certification body",     meaning: "Independent third-party audit" },
  { dbValue: "tier4_brand",      label: "Brand disclosure",       meaning: "Buyer-published supplier list (self-reported)" },
  { dbValue: "tier5_regulatory", label: "Regulatory / sanctions", meaning: "Negative-screening source (UFLPA, OFAC, etc.)" },
  { dbValue: "tier6_crosscheck", label: "Cross-check only",       meaning: "Corroboration only — never primary evidence" },
];

export default async function MarketingHome() {
  const [stats, sources] = await Promise.all([loadStats(), loadSources()]);
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

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      {/* ─────────── 1. Hero ─────────── */}
      <section className="text-center">
        <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tightish">
          Verified Bangladesh garment factories
        </h1>
        <p className="mt-4 max-w-2xl mx-auto text-ink-secondary text-lg leading-relaxed">
          A neutral, public-record index of the country&apos;s RMG sector — each
          supplier traceable to the regulator, association, certifier, or
          brand that named them.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center rounded-md bg-ink-primary px-5 py-2.5 text-sm font-medium text-bg-l0 hover:bg-ink-900"
          >
            Start free
          </Link>
          <Link
            href="/discover"
            className="inline-flex items-center rounded-md border border-ink-200 px-5 py-2.5 text-sm font-medium text-ink-primary hover:bg-bg-l1"
          >
            Browse the directory
          </Link>
        </div>
      </section>

      {/* ─────────── 2. Live counter strip ─────────── */}
      <section className="mt-16">
        <h2 className="sr-only">Live metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {COUNTER_TILES.map((tile) => {
            const value = stats[tile.key] as number | null;
            const formatted = fmtCount(value);
            return (
              <div
                key={tile.key}
                aria-label={`${tile.label}: ${formatted}`}
                className="rounded-lg border border-ink-200 bg-bg-l0 px-4 py-5"
              >
                <div className="font-display text-3xl font-semibold tracking-tightish text-ink-primary">
                  {formatted}
                </div>
                <div className="mt-2 text-xs text-ink-secondary leading-snug">
                  {tile.label}
                </div>
              </div>
            );
          })}
        </div>
        {lastUpdated && (
          <p className="mt-3 text-xs text-ink-secondary">
            Last updated {lastUpdated}
          </p>
        )}
      </section>

      {/* ─────────── 3. How we verify ─────────── */}
      <section className="mt-20">
        <h2 className="font-display text-2xl font-semibold tracking-tightish">
          How we verify
        </h2>

        <h3 className="mt-8 font-display text-lg font-semibold tracking-tightish">
          Source trust hierarchy
        </h3>
        <dl className="mt-4 divide-y divide-ink-200 border-y border-ink-200">
          {TIER_HIERARCHY.map((row) => (
            <div
              key={row.dbValue}
              className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-2 py-3"
            >
              <dt className="text-sm font-medium text-ink-primary">
                {row.label}
              </dt>
              <dd className="text-sm text-ink-secondary">{row.meaning}</dd>
            </div>
          ))}
        </dl>

        <h3 className="mt-10 font-display text-lg font-semibold tracking-tightish">
          Per-factory authenticity rule
        </h3>
        <blockquote className="mt-4 border-l-2 border-ink-200 pl-4 text-ink-secondary leading-relaxed space-y-4">
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
        </blockquote>

        <h3 className="mt-10 font-display text-lg font-semibold tracking-tightish">
          Receipts-first posture
        </h3>
        <p className="mt-4 text-ink-secondary leading-relaxed">
          We publish what issuers have already certified — cert IDs,
          register numbers, remediation percentages, brand-disclosure
          attributions — and never a SourceBD-proprietary supplier score.
        </p>
      </section>

      {/* ─────────── 4. Trust sources (typography only) ─────────── */}
      <section className="mt-20">
        <h2 className="font-display text-2xl font-semibold tracking-tightish">
          The sources we draw on
        </h2>
        <div className="mt-8 space-y-8">
          {TIER_ORDER.map((tier) => {
            const bucket = sourcesByTier.get(tier) ?? [];
            if (bucket.length === 0) return null;
            return (
              <div key={tier}>
                <h3 className="text-sm font-medium uppercase tracking-wide text-ink-secondary">
                  {TIER_LABELS[tier]}
                </h3>
                <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                  {bucket.map((s) => (
                    <li key={s.code}>
                      <span className="font-display text-base text-ink-primary">
                        {s.display_name}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─────────── 5. Founder story ─────────── */}
      <section className="mt-20">
        <h2 className="font-display text-2xl font-semibold tracking-tightish">
          Why we built this
        </h2>
        {/* FOUNDER: replace before launch */}
        <p className="mt-4 max-w-3xl text-ink-secondary leading-relaxed">
          {FOUNDER_STORY}
        </p>
      </section>

      {/* Footer rendered by `app/(marketing)/layout.tsx` (M2). */}
    </main>
  );
}
