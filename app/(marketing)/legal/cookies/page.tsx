// Spec H7 — Cookie Notice. Public, indexable.

import { BlurFade } from "@/components/ui/blur-fade";

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
    <main className="mx-auto max-w-3xl px-6 py-16">
      <BlurFade delay={0.1}>
        <header className="mb-8 text-center">
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink-primary md:text-4xl">
            <span className="text-[#1f4d3a]">Cookie Notice</span>
          </h1>
          <p className="mt-3 text-[12px] text-ink-tertiary">
            Last updated: {LAST_UPDATED}
          </p>
        </header>
      </BlurFade>
      <BlurFade delay={0.15}>
      <div className="proto-card">

      <section className="space-y-4 text-ink-secondary leading-relaxed">
        <h2 className="font-display text-xl font-semibold text-ink-primary">
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

        <h2 className="font-display text-xl font-semibold text-ink-primary">
          2. What we set
        </h2>
        <table className="mt-2 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-ink-200 text-left text-ink-primary">
              <th className="py-2 pr-3 font-semibold">Cookie</th>
              <th className="py-2 pr-3 font-semibold">Purpose</th>
              <th className="py-2 font-semibold">Lifetime</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-ink-200">
              <td className="py-2 pr-3"><code>sb-*-auth-token</code></td>
              <td className="py-2 pr-3">Supabase Auth session (strictly necessary).</td>
              <td className="py-2">Session / refresh window</td>
            </tr>
            <tr className="border-b border-ink-200">
              <td className="py-2 pr-3"><code>ph_*</code></td>
              <td className="py-2 pr-3">PostHog product analytics (first-party). Session recording is disabled.</td>
              <td className="py-2">Up to 1 year</td>
            </tr>
            <tr>
              <td className="py-2 pr-3"><code>__next_*</code></td>
              <td className="py-2 pr-3">Next.js routing &amp; preview preferences (strictly necessary).</td>
              <td className="py-2">Session</td>
            </tr>
          </tbody>
        </table>

        <h2 className="font-display text-xl font-semibold text-ink-primary">
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

        <h2 className="font-display text-xl font-semibold text-ink-primary">
          4. Changes
        </h2>
        <p>
          If we introduce a new cookie class (for example, a session
          replay tool or an advertising pixel), we will update this
          notice and present a consent banner before the cookie is
          set, as required by PECR.
        </p>

        <h2 className="font-display text-xl font-semibold text-ink-primary">
          5. Contact
        </h2>
        <p>
          Questions: <strong>privacy@sourcebd.net</strong>.
        </p>
      </section>
      </div>
      </BlurFade>
    </main>
  );
}
