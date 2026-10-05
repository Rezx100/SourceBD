// Spec H7 — Cookie Notice. Public, indexable.

import { LegalShell, legalDay } from "@/components/site/legal";

export const dynamic = "force-static";

const LAST_UPDATED = "2026-06-03";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://sourcebd.net";

export const metadata = {
  title: "Cookie Notice — SourceBD",
  description:
    "The cookies and similar technologies SourceBD uses, and how to control them.",
  robots: { index: true, follow: true },
  alternates: { canonical: SITE_URL + "/legal/cookies" },
};

export default function CookiesPage() {
  return (
    <LegalShell title="Cookie Notice" updated={legalDay(LAST_UPDATED)} active="/legal/cookies">
        <h2>
          1. Our posture
        </h2>
        <p>
          We do not run advertising cookies, retargeting pixels, or
          cross-site trackers on this service. We do not sell or share
          personal data with advertisers. The cookies we set are
          either strictly necessary to run the platform or used for
          first-party product analytics with session-recording
          disabled.
        </p>

        <h2>
          2. What we set
        </h2>
        <table>
          <thead>
            <tr>
              <th>Cookie</th>
              <th>Purpose</th>
              <th>Lifetime</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>sb-*-auth-token</code></td>
              <td>Supabase Auth session (strictly necessary).</td>
              <td>Session / refresh window</td>
            </tr>
            <tr>
              <td><code>ph_*</code></td>
              <td>PostHog product analytics (first-party). Session recording is disabled.</td>
              <td>Up to 1 year</td>
            </tr>
            <tr>
              <td><code>__next_*</code></td>
              <td>Next.js routing &amp; preview preferences (strictly necessary).</td>
              <td>Session</td>
            </tr>
          </tbody>
        </table>

        <h2>
          3. Controlling cookies
        </h2>
        <p>
          You can clear or block cookies in your browser settings. The
          authentication cookies are strictly necessary; blocking them
          will sign you out and prevent access to the application.
          PostHog analytics can be disabled at the browser level using
          a Do-Not-Track signal or a tracker-blocking extension; the
          service will continue to function without it.
        </p>

        <h2>
          4. Changes
        </h2>
        <p>
          If we introduce a new cookie class (for example, a session
          replay tool or an advertising pixel), we will update this
          notice and present a consent banner before the cookie is
          set, as required by PECR.
        </p>

        <h2>
          5. Contact
        </h2>
        <p>
          Questions: <strong>privacy@sourcebd.net</strong>.
        </p>
      </LegalShell>
  );
}
