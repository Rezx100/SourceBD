// Spec M2 — Marketing pricing page. Public, indexable, static.
//
// JC #11 ack: no Stripe in v1 — Starter/Growth CTAs route to `/signup`
// with a plan hint; Enterprise routes to a mailto: link. JC #12 ack:
// every numeric placeholder figure is wrapped in
// `<!-- launch marker: price -->...<!-- /launch marker -->` HTML comments
// so the M2 smoke can assert the markers are still present (forces a
// deliberate pre-launch swap).
//
// Plan tier identifiers (`starter` / `growth` / `enterprise`) are the
// same ones the `profiles.plan_tier` CHECK constraint admits (migration
// 0031, B10). The single PLANS / COMPARISON_ROWS / PRICING_FAQS source
// lives in `lib/marketing/pricing-plans.ts` and is also imported by
// `app/(app)/app/settings/plan/page.tsx` so the matrix cannot drift.

import Link from "next/link";

import {
  COMPARISON_ROWS,
  PLANS,
  PRICING_FAQS,
  type CtaTarget,
} from "@/lib/marketing/pricing-plans";

export const dynamic = "force-static";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sourcebd.net";

export const metadata = {
  title: "Pricing — SourceBD",
  description:
    "Three plans for UK / US / EU / CA buyers sourcing from Bangladesh: Starter (free), Growth, and Enterprise. Compare features and view FAQs.",
  robots: { index: true, follow: true },
  alternates: { canonical: SITE_URL + "/pricing" },
};

function ctaHref(target: CtaTarget): string {
  if (target.kind === "signup") return `/signup?plan=${target.plan}`;
  const subject = encodeURIComponent(target.subject);
  return `mailto:${target.email}?subject=${subject}`;
}

// Wraps a price figure with HTML comment markers so the pre-launch
// price-swap is greppable. Smoke step asserts marker appears 3×.
function PriceHeadline({ value }: { value: string }) {
  return (
    <span
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: `<!-- launch marker: price -->${value}<!-- /launch marker -->`,
      }}
    />
  );
}

function CheckMark({ on }: { on: boolean }) {
  return on ? (
    <span aria-label="Included" className="text-sem-green">
      ✓
    </span>
  ) : (
    <span aria-label="Not included" className="text-ink-tertiary">
      —
    </span>
  );
}

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      {/* Hero */}
      <section className="text-center">
        <h1 className="font-display text-4xl font-light tracking-tight text-ink-primary md:text-5xl">
          Pricing built for{" "}
          <span className="proto-wordmark text-4xl md:text-5xl">
            sourcing teams
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-ink-secondary leading-relaxed">
          Start free. Upgrade when you place repeat orders. Talk to us when
          your programme needs seats, API access, or a dedicated compliance
          reviewer.
        </p>
        <p className="affiliation-disclaimer mx-auto mt-3 max-w-2xl">
          Prices shown in GBP. USD and EUR pricing arriving before MAGIC
          Las Vegas (August 2026).
        </p>
      </section>

      {/* Plan cards */}
      <section className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
        {PLANS.map((plan) => {
          const featured = plan.key === "growth";
          return (
            <div
              key={plan.key}
              className={
                "proto-card hoverable flex flex-col " +
                (featured ? "ring-2 ring-brand-forest" : "")
              }
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold text-ink-primary">
                  {plan.label}
                </h2>
                {featured ? (
                  <span className="rounded-pill bg-brand-forest-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-brand-forest">
                    Most popular
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-ink-secondary">{plan.tagline}</p>
              <p className="mt-6 font-display text-3xl font-light tracking-tight text-ink-primary">
                <PriceHeadline value={plan.priceHeadline} />
              </p>
              <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.06em] text-ink-tertiary">
                {plan.priceSubline}
              </p>
              {plan.trialNote ? (
                <p className="mt-2 text-xs text-sem-green">{plan.trialNote}</p>
              ) : null}
              <ul className="mt-6 flex-1 space-y-2 text-sm text-ink-secondary">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0 text-brand-forest">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={ctaHref(plan.ctaTarget)}
                className={
                  "mt-6 " + (featured ? "btn-proto primary" : "btn-proto")
                }
              >
                {plan.ctaLabel}
              </Link>
            </div>
          );
        })}
      </section>

      {/* Comparison table */}
      <section className="mt-20">
        <header className="proto-card-head">
          <h2 className="proto-card-title">Compare plans</h2>
        </header>
        <div className="proto-card overflow-x-auto p-0">
          <table className="min-w-full text-sm">
            <thead className="bg-brand-forest-soft text-left text-ink-primary">
              <tr>
                <th scope="col" className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-tertiary">
                  Feature
                </th>
                {PLANS.map((plan) => (
                  <th
                    key={plan.key}
                    scope="col"
                    className="px-4 py-3 text-center font-mono text-[10px] uppercase tracking-[0.08em] text-ink-tertiary"
                  >
                    {plan.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.feature}>
                  <th
                    scope="row"
                    className="px-4 py-3 text-left font-normal text-ink-secondary"
                  >
                    {row.feature}
                  </th>
                  <td className="px-4 py-3 text-center">
                    {typeof row.starter === "boolean" ? (
                      <CheckMark on={row.starter} />
                    ) : (
                      <span className="text-ink-primary">{row.starter}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {typeof row.growth === "boolean" ? (
                      <CheckMark on={row.growth} />
                    ) : (
                      <span className="text-ink-primary">{row.growth}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {typeof row.enterprise === "boolean" ? (
                      <CheckMark on={row.enterprise} />
                    ) : (
                      <span className="text-ink-primary">{row.enterprise}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-20">
        <header className="proto-card-head">
          <h2 className="proto-card-title">Frequently asked questions</h2>
        </header>
        <div className="proto-card divide-y divide-hairline p-0">
          {PRICING_FAQS.map((faq) => (
            <details key={faq.q} className="group px-5 py-4">
              <summary className="cursor-pointer list-none font-medium text-ink-primary marker:hidden">
                <span className="flex items-start justify-between gap-4">
                  <span>{faq.q}</span>
                  <span
                    aria-hidden
                    className="mt-1 shrink-0 text-ink-tertiary transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </span>
              </summary>
              <p className="mt-3 text-sm text-ink-secondary leading-relaxed">
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* Enterprise CTA */}
      <section className="mt-20 rounded-hero border border-hairline-strong bg-brand-forest-soft p-10 text-center">
        <h2 className="font-display text-2xl font-light tracking-tight text-ink-primary">
          Need something{" "}
          <span className="proto-wordmark text-2xl">bespoke</span>?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-ink-secondary">
          Enterprise programmes get seats, API access, bulk export, and a
          dedicated compliance reviewer. Tell us about your sourcing
          volume and we will reply with a quote within two working days.
        </p>
        <Link
          href="mailto:sales@sourcebd.com?subject=SourceBD%20Enterprise%20enquiry"
          className="btn-proto primary mt-6 inline-flex"
        >
          Contact sales
        </Link>
      </section>
    </main>
  );
}
