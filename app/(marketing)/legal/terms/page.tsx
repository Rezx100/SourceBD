// Spec H7 — Terms of Service. Public, indexable.
//
// Pattern mirrors `app/(marketing)/legal/trademarks/page.tsx`:
// server component, `force-static`, per-page metadata + canonical,
// inline copy with a `LAST_UPDATED` constant rendered in the footer.

import { LegalShell, legalDay } from "@/components/site/legal";

export const dynamic = "force-static";

const LAST_UPDATED = "2026-10-06";

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
    <LegalShell title="Terms of Service" updated={legalDay(LAST_UPDATED)} active="/legal/terms">
        <h2>
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

        <h2>
          2. Eligibility and accounts
        </h2>
        <p>
          You must be acting on behalf of a registered business and be
          at least 18 years old. You are responsible for maintaining
          the confidentiality of your account credentials and for all
          activity that occurs under your account.
        </p>

        <h2>
          3. Subscription and payment
        </h2>
        <p>
          Paid plans are billed in advance at the price
          and cadence shown at checkout. Subscriptions renew
          automatically until cancelled from your account settings.
          Statutory consumer cancellation rights do not apply to B2B
          subscriptions.
        </p>

        <h2>
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
        <p>
          In your dealings with other users you also agree not to
          (e) misrepresent who you are, which company you act for, or
          what you can supply or buy; (f) ask for or offer payment
          outside the dealings the platform records, or move a
          conversation off the platform to avoid its record;
          (g) harass, threaten or deceive another user; (h) send the
          same RFQ to many suppliers with no intention to buy; or
          (i) open or operate more than one account for the same
          person or company without telling us.
        </p>

        <h2>
          5. Supplier data and accuracy
        </h2>
        <p>
          We aggregate from publicly accessible sources and apply the
          source trust hierarchy described in our{" "}
          <a
            href="/legal/data-sources"
          >
            Data Source Policy
          </a>
          . We do not warrant that any individual supplier record is
          complete, current, or fit for your specific sourcing
          decision. You are responsible for your own due diligence
          before placing an order.
        </p>

        <h2>
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
        <p>
          From 5 November 2026, the platform&apos;s activity record (see
          the <a href="/legal/privacy">Privacy Notice</a>, section 3)
          is the agreed record of what was sent, offered, accepted,
          changed and done on the platform, and the time it happened.
          You agree that in any dispute between users, or between a
          user and us, that record may be relied on as evidence of
          those facts, and that we may provide a copy of the relevant
          part of it, with its seals, to the users involved or to a
          court or authority.
        </p>

        <h2>
          7. Moderation and enforcement
        </h2>
        <p>
          From 5 November 2026, we may act on a breach of these terms
          or a risk to other users in steps: a <strong>warning</strong>;
          a <strong>restriction</strong> (no new RFQs or messages for a
          stated period); a <strong>suspension</strong>; and, for a
          serious or repeated breach, a <strong>ban</strong>. We may
          also hide a single message, pause or remove a single RFQ, or
          hide a supplier profile. Every step is taken for a stated
          reason from a fixed list, and we tell you what was done and
          why by email. You may appeal any step once, by replying to
          that email, and we tell you the outcome. A report you make
          about another user is handled the same way, and you are
          told the outcome. Any user may report a message, an RFQ, a
          supplier profile or an order from within the platform, or
          block a company from contacting them.
        </p>

        <h2>
          8. Intellectual property
        </h2>
        <p>
          The SourceBD platform, its software, design system, and
          aggregated dataset are our intellectual property. Third-party
          marks shown on supplier profiles belong to their owners; see{" "}
          <a
            href="/legal/trademarks"
          >
            Trademarks
          </a>
          .
        </p>

        <h2>
          9. Liability
        </h2>
        <p>
          To the maximum extent permitted by law, our aggregate
          liability for any claim arising out of or relating to the
          service is capped at the fees you paid us in the twelve
          months preceding the claim. We are not liable for indirect
          or consequential loss, lost profits, or loss of business
          opportunity.
        </p>

        <h2>
          10. Termination
        </h2>
        <p>
          You may cancel at any time from your account settings. We
          may suspend or terminate your account for breach of these
          terms, for non-payment, or where required by law. On
          termination, your right to access the service ends; clauses
          intended to survive (IP, liability, governing law) survive.
          The record of your dealings is kept as the Privacy Notice
          describes (section 7); an account with dealings on record is
          closed, not deleted.
        </p>

        <h2>
          11. Governing law
        </h2>
        <p>
          These terms are governed by the laws of England and Wales.
          The courts of England and Wales have exclusive jurisdiction
          over any dispute, subject to your statutory rights.
        </p>

        <h2>
          12. Contact
        </h2>
        <p>
          Questions about these terms: <strong>legal@sourcebd.net</strong>.
        </p>
      </LegalShell>
  );
}
