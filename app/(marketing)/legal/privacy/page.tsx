// Spec H7 — Privacy Notice. Public, indexable.
//
// The ICO registration number and UK GDPR Representative contact are
// rendered from env vars (`NEXT_PUBLIC_ICO_REGISTRATION_NUMBER`,
// `NEXT_PUBLIC_UK_GDPR_REP_NAME`, `NEXT_PUBLIC_UK_GDPR_REP_ADDRESS`,
// `NEXT_PUBLIC_UK_GDPR_REP_EMAIL`). When unset they render explicit
// "Pending …" sentinels so the page is honest about its in-progress
// state — flipping the env vars on the VPS picks up real values
// without a code change.

export const dynamic = "force-static";

const LAST_UPDATED = "2026-06-03";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://sourcebd.net";

const ICO_REGISTRATION_NUMBER =
  process.env.NEXT_PUBLIC_ICO_REGISTRATION_NUMBER ?? "Pending registration";
const UK_GDPR_REP_NAME =
  process.env.NEXT_PUBLIC_UK_GDPR_REP_NAME ?? "Pending appointment";
const UK_GDPR_REP_ADDRESS =
  process.env.NEXT_PUBLIC_UK_GDPR_REP_ADDRESS ?? "Pending appointment";
const UK_GDPR_REP_EMAIL =
  process.env.NEXT_PUBLIC_UK_GDPR_REP_EMAIL ?? "Pending appointment";

export const metadata = {
  title: "Privacy Notice — SourceBD",
  description:
    "How SourceBD collects, uses, and protects personal data, including ICO registration and UK GDPR Representative contact.",
  robots: { index: true, follow: true },
  alternates: { canonical: SITE_URL + "/legal/privacy" },
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-8 text-center">
        <h1 className="font-display text-3xl font-light tracking-tight text-ink-primary md:text-4xl">
          <span className="proto-wordmark text-3xl md:text-4xl">
            Privacy Notice
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
          SourceBD is the data controller for personal data processed
          through this service. We are registered with the UK
          Information Commissioner&apos;s Office (ICO) under
          registration number{" "}
          <strong>{ICO_REGISTRATION_NUMBER}</strong>.
        </p>

        <h2 className="font-display text-xl font-semibold text-ink-primary">
          2. UK GDPR Representative
        </h2>
        <p>
          As required by Article 27 of the UK GDPR, we have appointed
          the following UK-based representative for data-protection
          enquiries from UK data subjects and the ICO:
        </p>
        <div className="rounded-lg border border-ink-200 bg-bg-l1 p-4 text-sm">
          <p>
            <strong>Name:</strong> {UK_GDPR_REP_NAME}
          </p>
          <p>
            <strong>Address:</strong> {UK_GDPR_REP_ADDRESS}
          </p>
          <p>
            <strong>Email:</strong> {UK_GDPR_REP_EMAIL}
          </p>
        </div>

        <h2 className="font-display text-xl font-semibold text-ink-primary">
          3. What we collect
        </h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong>Account data:</strong> name, business email, company
            name, role.
          </li>
          <li>
            <strong>Usage data:</strong> pages viewed, searches run,
            suppliers saved, RFQs sent — collected via PostHog for
            product analytics.
          </li>
          <li>
            <strong>Communications:</strong> messages sent through the
            in-platform messaging system and inbound support email.
          </li>
          <li>
            <strong>Billing data:</strong> handled by Stripe; we
            receive only the last four card digits and billing
            country, never full card numbers.
          </li>
        </ul>

        <h2 className="font-display text-xl font-semibold text-ink-primary">
          4. Lawful bases
        </h2>
        <p>
          We process account, usage, and billing data on the basis of{" "}
          <em>contract performance</em> (UK GDPR Art. 6(1)(b)) and{" "}
          <em>legitimate interests</em> (Art. 6(1)(f)) in operating
          and improving a B2B intelligence platform. We do not rely on
          consent for advertising cookies because we do not run them
          (see <a className="text-accent-indigo hover:underline" href="/legal/cookies">Cookies</a>).
        </p>

        <h2 className="font-display text-xl font-semibold text-ink-primary">
          5. Sharing
        </h2>
        <p>
          We share data only with sub-processors necessary to run the
          service: Supabase (hosting + database), Stripe (payments),
          Resend (transactional email), Sentry (error monitoring),
          PostHog (product analytics), and our hosting providers. We
          do not sell personal data and do not share it with
          advertisers.
        </p>

        <h2 className="font-display text-xl font-semibold text-ink-primary">
          6. International transfers
        </h2>
        <p>
          Some sub-processors are located outside the UK and EEA.
          Transfers are protected by the UK International Data
          Transfer Agreement (IDTA) or Standard Contractual Clauses
          with the UK Addendum, as applicable.
        </p>

        <h2 className="font-display text-xl font-semibold text-ink-primary">
          7. Retention
        </h2>
        <p>
          Account data is retained for the life of your account and
          for 12 months after closure to handle billing disputes and
          legal obligations. Aggregated usage data may be retained
          longer in non-identifying form.
        </p>

        <h2 className="font-display text-xl font-semibold text-ink-primary">
          8. Your rights
        </h2>
        <p>
          You have the right to access, rectify, erase, restrict, and
          port your personal data, and to object to processing. Send
          requests to <strong>privacy@sourcebd.net</strong>. You also
          have the right to complain to the ICO
          (<a className="text-accent-indigo hover:underline" href="https://ico.org.uk/" rel="noopener noreferrer" target="_blank">ico.org.uk</a>).
        </p>

        <h2 className="font-display text-xl font-semibold text-ink-primary">
          9. Supplier records
        </h2>
        <p>
          Most supplier records on the platform are business records
          (company name, factory address, certifications) and do not
          identify natural persons. Where a supplier record contains
          publicly disclosed contact-person information, we apply the
          minimisation rules described in our{" "}
          <a className="text-accent-indigo hover:underline" href="/legal/data-sources">
            Data Source Policy
          </a>
          .
        </p>

        <h2 className="font-display text-xl font-semibold text-ink-primary">
          10. Changes
        </h2>
        <p>
          Material changes to this notice will be notified by email to
          active account holders at least 30 days before they take
          effect.
        </p>
      </section>
      </div>
    </main>
  );
}
