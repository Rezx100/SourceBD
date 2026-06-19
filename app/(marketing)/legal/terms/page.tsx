// Spec H7 — Terms of Service. Public, indexable.
//
// Pattern mirrors `app/(marketing)/legal/trademarks/page.tsx`:
// server component, `force-static`, per-page metadata + canonical,
// inline copy with a `LAST_UPDATED` constant rendered in the footer.

export const dynamic = "force-static";

const LAST_UPDATED = "2026-06-03";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://sourcebd.net";

export const metadata = {
  title: "Terms of Service — SourceBD",
  description:
    "The contractual terms governing use of SourceBD's B2B intelligence platform for the Bangladesh RMG supply chain.",
  robots: { index: true, follow: true },
  alternates: { canonical: SITE_URL + "/legal/terms" },
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-8 text-center">
        <h1 className="font-display text-3xl font-light tracking-tight text-ink-primary md:text-4xl">
          <span className="text-[#1f4d3a] text-3xl md:text-4xl">
            Terms of Service
          </span>
        </h1>
        <p className="affiliation-disclaimer mt-3">
          Last updated: {LAST_UPDATED}
        </p>
      </header>
      <div className="proto-card">

      <section className="space-y-4 text-ink-secondary leading-relaxed">
        <h2 className="font-display text-xl font-semibold text-ink-primary">
          1. Who we are
        </h2>
        <p>
          SourceBD (&ldquo;we&rdquo;, &ldquo;us&rdquo;) operates a B2B
          intelligence service for buyers of Bangladesh ready-made
          garment (RMG) supply. We do not manufacture goods and we are
          not a broker or buying agent. The service surfaces verified
          information about factories and buying houses sourced from
          government registries, industry associations, certification
          bodies, and brand disclosures.
        </p>

        <h2 className="font-display text-xl font-semibold text-ink-primary">
          2. Eligibility and accounts
        </h2>
        <p>
          You must be acting on behalf of a registered business and be
          at least 18 years old. You are responsible for maintaining
          the confidentiality of your account credentials and for all
          activity that occurs under your account.
        </p>

        <h2 className="font-display text-xl font-semibold text-ink-primary">
          3. Subscription and payment
        </h2>
        <p>
          Paid plans are billed in advance through Stripe at the price
          and cadence shown at checkout. Subscriptions renew
          automatically until cancelled from your account settings.
          Statutory consumer cancellation rights do not apply to B2B
          subscriptions.
        </p>

        <h2 className="font-display text-xl font-semibold text-ink-primary">
          4. Acceptable use
        </h2>
        <p>
          You agree not to (a) scrape, mirror, or republish the
          platform&apos;s data outside your own internal sourcing
          workflows; (b) attempt to identify natural persons beyond the
          business-role information we publish; (c) interfere with the
          service&apos;s security or rate limits; or (d) use the
          platform to send unsolicited commercial messages to
          suppliers outside the structured RFQ flow.
        </p>

        <h2 className="font-display text-xl font-semibold text-ink-primary">
          5. Supplier data and accuracy
        </h2>
        <p>
          We aggregate from publicly accessible sources and apply the
          source trust hierarchy described in our{" "}
          <a
            href="/legal/data-sources"
            className="text-accent-indigo hover:underline"
          >
            Data Source Policy
          </a>
          . We do not warrant that any individual supplier record is
          complete, current, or fit for your specific sourcing
          decision. You are responsible for your own due diligence
          before placing an order.
        </p>

        <h2 className="font-display text-xl font-semibold text-ink-primary">
          6. Messages, RFQs, and orders
        </h2>
        <p>
          Messages between buyers and suppliers are transmitted
          through the platform for record-keeping. Quotes and orders
          form a contract directly between you and the supplier;
          SourceBD is not a party to that contract and is not liable
          for performance, quality, delivery, or payment between the
          parties.
        </p>

        <h2 className="font-display text-xl font-semibold text-ink-primary">
          7. Intellectual property
        </h2>
        <p>
          The SourceBD platform, its software, design system, and
          aggregated dataset are our intellectual property. Third-party
          marks shown on supplier profiles belong to their owners; see{" "}
          <a
            href="/legal/trademarks"
            className="text-accent-indigo hover:underline"
          >
            Trademarks
          </a>
          .
        </p>

        <h2 className="font-display text-xl font-semibold text-ink-primary">
          8. Liability
        </h2>
        <p>
          To the maximum extent permitted by law, our aggregate
          liability for any claim arising out of or relating to the
          service is capped at the fees you paid us in the twelve
          months preceding the claim. We are not liable for indirect
          or consequential loss, lost profits, or loss of business
          opportunity.
        </p>

        <h2 className="font-display text-xl font-semibold text-ink-primary">
          9. Termination
        </h2>
        <p>
          You may cancel at any time from your account settings. We
          may suspend or terminate your account for breach of these
          terms, for non-payment, or where required by law. On
          termination, your right to access the service ends; clauses
          intended to survive (IP, liability, governing law) survive.
        </p>

        <h2 className="font-display text-xl font-semibold text-ink-primary">
          10. Governing law
        </h2>
        <p>
          These terms are governed by the laws of England and Wales.
          The courts of England and Wales have exclusive jurisdiction
          over any dispute, subject to your statutory rights.
        </p>

        <h2 className="font-display text-xl font-semibold text-ink-primary">
          11. Contact
        </h2>
        <p>
          Questions about these terms: <strong>legal@sourcebd.net</strong>.
        </p>
      </section>
      </div>
    </main>
  );
}
