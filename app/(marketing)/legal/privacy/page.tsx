// Spec H7 — Privacy Notice. Public, indexable.
//
// The ICO registration number and UK GDPR Representative contact are
// rendered from env vars (`NEXT_PUBLIC_ICO_REGISTRATION_NUMBER`,
// `NEXT_PUBLIC_UK_GDPR_REP_NAME`, `NEXT_PUBLIC_UK_GDPR_REP_ADDRESS`,
// `NEXT_PUBLIC_UK_GDPR_REP_EMAIL`). When unset they render explicit
// "Pending …" sentinels so the page is honest about its in-progress
// state — flipping the env vars on the VPS picks up real values
// without a code change.

import { LegalShell, legalDay } from "@/components/site/legal";

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
    <LegalShell title="Privacy Notice" updated={legalDay(LAST_UPDATED)} active="/legal/privacy">
        <h2>
          1. Who we are
        </h2>
        <p>
          SourceBD is the data controller for personal data processed
          through this service. We are registered with the UK
          Information Commissioner&apos;s Office (ICO) under
          registration number{" "}
          <strong>{ICO_REGISTRATION_NUMBER}</strong>.
        </p>

        <h2>
          2. UK GDPR Representative
        </h2>
        <p>
          As required by Article 27 of the UK GDPR, we have appointed
          the following UK-based representative for data-protection
          enquiries from UK data subjects and the ICO:
        </p>
        <div className="note">
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

        <h2>
          3. What we collect
        </h2>
        <ul>
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

        <h2>
          4. Lawful bases
        </h2>
        <p>
          We process account, usage, and billing data on the basis of{" "}
          <em>contract performance</em> (UK GDPR Art. 6(1)(b)) and{" "}
          <em>legitimate interests</em> (Art. 6(1)(f)) in operating
          and improving a B2B intelligence platform. We do not rely on
          consent for advertising cookies because we do not run them
          (see <a href="/legal/cookies">Cookies</a>).
        </p>

        <h2>
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

        <h2>
          6. International transfers
        </h2>
        <p>
          Some sub-processors are located outside the UK and EEA.
          Transfers are protected by the UK International Data
          Transfer Agreement (IDTA) or Standard Contractual Clauses
          with the UK Addendum, as applicable.
        </p>

        <h2>
          7. Retention
        </h2>
        <p>
          Account data is retained for the life of your account and
          for 12 months after closure to handle billing disputes and
          legal obligations. Aggregated usage data may be retained
          longer in non-identifying form.
        </p>

        <h2>
          8. Your rights
        </h2>
        <p>
          You have the right to access, rectify, erase, restrict, and
          port your personal data, and to object to processing. Send
          requests to <strong>privacy@sourcebd.net</strong>. You also
          have the right to complain to the ICO
          (<a href="https://ico.org.uk/" rel="noopener noreferrer" target="_blank">ico.org.uk</a>).
        </p>

        <h2>
          9. Supplier records
        </h2>
        <p>
          Most supplier records on the platform are business records
          (company name, factory address, certifications) and do not
          identify natural persons. Where a supplier record contains
          publicly disclosed contact-person information, we apply the
          minimisation rules described in our{" "}
          <a href="/legal/data-sources">
            Data Source Policy
          </a>
          .
        </p>

        <h2>
          10. Changes
        </h2>
        <p>
          Material changes to this notice will be notified by email to
          active account holders at least 30 days before they take
          effect.
        </p>
      </LegalShell>
  );
}
