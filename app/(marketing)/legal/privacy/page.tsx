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
import { subprocessorSentence } from "@/components/site/subprocessors";

export const dynamic = "force-static";

const LAST_UPDATED = "2026-10-06";

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
            <strong>Activity record</strong> (from 5 November 2026):
            every action taken on the platform — sign-ins, searches,
            supplier profiles opened, RFQs, quotes, messages, files,
            orders, claims and settings changes — written down once, at
            the moment it happens, with the time, the account and its
            email, the session, the IP address and the browser or
            device it came from. The record cannot be edited or
            deleted, and it is sealed each hour so that any later
            change to it would show.
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
          service: {subprocessorSentence()}. We
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
          7. Retention and legal holds
        </h2>
        <p>
          Account data is retained for the life of your account. From
          5 November 2026, the record of your dealings on the platform
          (RFQs, quotes, messages, files, orders, claims and the
          activity record) is kept for <strong>7 years</strong> after
          your account closes, because those records may be needed in
          a dispute, a legal claim or a request from an authority.
          After that, personal details are removed from them. Where a
          dispute, an investigation or a legal request is open, we may
          place a <em>legal hold</em> on the records involved, which
          pauses that removal until the matter is closed. An account
          with dealings on record is closed, not deleted. Aggregated
          usage data may be retained longer in non-identifying form.
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
          9. Moderation, safety and legal requests
        </h2>
        <p>
          From 5 November 2026, SourceBD staff may open and read RFQs,
          quotes, messages and attached files sent through the
          platform where that is needed to keep the platform safe:
          to look into a report from another user, suspected fraud or
          scraping, a dispute between a buyer and a supplier, a breach
          of the Terms of Service, or a request from a court, the
          police or a regulator. Every such access is made for a
          stated reason, is written to the same activity record, and
          can be seen by the people whose content was opened on
          request. Staff do not read private content for any other
          purpose. Where we act on what we find — a warning, a
          restriction, a suspension, a ban, a hidden message or a
          paused RFQ — we tell the account holder what was done and
          why, and how to appeal. We disclose records to courts and
          authorities only under a written procedure and where the law
          requires or permits it, and we tell the account holder unless
          the law forbids it.
        </p>

        <h2>
          10. Supplier records
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
          11. Changes
        </h2>
        <p>
          Material changes to this notice will be notified by email to
          active account holders at least 30 days before they take
          effect. The changes of 6 October 2026 — the activity record
          (section 3), the 7-year retention of dealings and legal holds
          (section 7), and moderation, safety and legal requests
          (section 9) — were notified on that day and take effect on
          <strong>5 November 2026</strong>.
        </p>
      </LegalShell>
  );
}
