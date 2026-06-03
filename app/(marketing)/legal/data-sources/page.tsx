// Spec H7 — Data Source Policy. Public, indexable.
//
// Restates the source trust hierarchy from architecture.md hard rule
// #5 in buyer-facing language, and names the takedown / correction
// contact.

export const dynamic = "force-static";

const LAST_UPDATED = "2026-06-03";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://sourcebd.net";

export const metadata = {
  title: "Data Source Policy — SourceBD",
  description:
    "How SourceBD sources, ranks, and verifies the data shown on supplier profiles, and how to request a correction or takedown.",
  robots: { index: true, follow: true },
  alternates: { canonical: SITE_URL + "/legal/data-sources" },
};

export default function DataSourcesPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-8 text-center">
        <h1 className="font-display text-3xl font-light tracking-tight text-ink-primary md:text-4xl">
          <span className="proto-wordmark text-3xl md:text-4xl">
            Data Source Policy
          </span>
        </h1>
        <p className="affiliation-disclaimer mt-3">
          Last updated: {LAST_UPDATED}
        </p>
      </header>
      <div className="proto-card">

      <section className="space-y-4 text-ink-secondary leading-relaxed">
        <h2 className="font-display text-xl font-semibold text-ink-primary">
          1. Where the data comes from
        </h2>
        <p>
          Every fact shown on a supplier profile carries a source pill
          identifying the issuer, the URL, and the date we last saw
          it. We aggregate from publicly accessible registries,
          industry associations, certification bodies, brand
          disclosures, and regulatory filings.
        </p>

        <h2 className="font-display text-xl font-semibold text-ink-primary">
          2. Source trust hierarchy
        </h2>
        <p>
          We rank sources into six tiers and never let a lower-tier
          source overwrite a higher-tier fact:
        </p>
        <ol className="list-decimal space-y-1 pl-6">
          <li>
            <strong>Tier 1 — Government &amp; regulatory</strong>:
            RJSC company filings, fire-licence registries, tax-ID
            registries.
          </li>
          <li>
            <strong>Tier 2 — Industry associations</strong>: BGMEA,
            BKMEA, BTMA, BGAPMEA member directories.
          </li>
          <li>
            <strong>Tier 3 — Certification bodies</strong>: GOTS,
            OEKO-TEX, BSCI, WRAP, Higg FEM, ISO certificate databases.
          </li>
          <li>
            <strong>Tier 4 — Brand disclosures</strong>: H&amp;M, Inditex,
            Levi&apos;s, ASOS, Marks &amp; Spencer, and other brand
            factory-list disclosures.
          </li>
          <li>
            <strong>Tier 5 — US/UK/EU regulatory</strong>: UFLPA
            entity list, OFSI / OFAC sanctions, EU sanctions lists.
          </li>
          <li>
            <strong>Tier 6 — Cross-check sources</strong>: trade
            directories and third-party aggregators. Used only to
            corroborate Tier 1–3 records, never as the sole source.
          </li>
        </ol>

        <h2 className="font-display text-xl font-semibold text-ink-primary">
          3. Authenticity rule
        </h2>
        <p>
          No supplier record enters the platform on the strength of a
          Tier 6 source alone. Every published record is corroborated
          by at least one Tier 1–3 source.
        </p>

        <h2 className="font-display text-xl font-semibold text-ink-primary">
          4. Freshness
        </h2>
        <p>
          Each fact shows its last-seen date. Records that haven&apos;t
          been re-verified within the source&apos;s normal refresh
          cadence are flagged as stale on the supplier profile.
        </p>

        <h2 className="font-display text-xl font-semibold text-ink-primary">
          5. Trademarks
        </h2>
        <p>
          Third-party logos and marks shown on supplier profiles
          identify the source of publicly available data. See{" "}
          <a
            href="/legal/trademarks"
            className="text-accent-indigo hover:underline"
          >
            Trademarks
          </a>{" "}
          for the full notice.
        </p>

        <h2 className="font-display text-xl font-semibold text-ink-primary">
          6. Corrections and takedowns
        </h2>
        <p>
          Supplier owners can claim a profile and edit owner-controlled
          fields directly. For factual corrections to sourced records,
          or for takedown requests, write to{" "}
          <strong>data@sourcebd.net</strong> with the supplier slug,
          the field, the corrected value, and a link to the
          higher-tier source supporting the correction. We respond
          within 10 working days.
        </p>

        <h2 className="font-display text-xl font-semibold text-ink-primary">
          7. Scraping etiquette
        </h2>
        <p>
          Our crawlers identify themselves with a descriptive
          user-agent and honour <code>robots.txt</code> and rate
          limits. We do not bypass authentication, paywalls, or
          terms-of-use restrictions.
        </p>
      </section>
      </div>
    </main>
  );
}
