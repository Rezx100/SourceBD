// Marketing pricing page. Public, indexable, static.
//
// Free public beta posture: no Stripe checkout, no paid tiers, no trial
// language. Growth / Enterprise are future capability descriptions only.
//
// Plan tier identifiers (`starter` / `growth` / `enterprise`) are the
// same ones the `profiles.plan_tier` CHECK constraint admits (migration
// 0031, B10). The single PLANS / COMPARISON_ROWS / PRICING_FAQS source
// lives in `lib/marketing/pricing-plans.ts` and is also imported by
// `app/(app)/app/settings/plan/page.tsx` so the matrix cannot drift.
//
// Design: Magic UI BlurFade for section entrances, MagicCard for plan
// cards, ShimmerButton for primary CTAs — unified with the home page.

import Link from "next/link";
import { ArrowRight, Check, Minus } from "@phosphor-icons/react/dist/ssr";

import { BlurFade } from "@/components/ui/blur-fade";
import { MagicCard } from "@/components/ui/magic-card";
import { ShimmerButton } from "@/components/ui/shimmer-button";

import {
  COMPARISON_ROWS,
  PLANS,
  PRICING_FAQS,
  type CtaTarget,
} from "@/lib/marketing/pricing-plans";

export const dynamic = "force-static";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sourcebd.net";
const FOREST = "#1f4d3a";

export const metadata = {
  title: "Pricing — SourceBD",
  description:
    "SourceBD is in a free public beta. Pricing, billing, and paid plan enforcement arrive after beta usage proves the right commercial model.",
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
      <Check size={15} weight="bold" />
    </span>
  ) : (
    <span aria-label="Not included" className="text-ink-tertiary">
      <Minus size={15} />
    </span>
  );
}

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">

      {/* ── Hero ── */}
      <section className="text-center">
        <BlurFade delay={0.1}>
          <p className="mb-3 inline-flex items-center gap-2 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[#1f4d3a]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#1f4d3a]" />
            Pricing
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-tight text-neutral-900 md:text-5xl">
            Free during public beta.{" "}
            <span className="text-[#1f4d3a]">No card required.</span>
          </h1>
        </BlurFade>
        <BlurFade delay={0.2}>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-neutral-600">
            SourceBD is open at zero price while we validate buyer workflows,
            data quality, and the right commercial model. No card, no checkout,
            no hidden paid gate.
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-neutral-400">
            Paid tiers, Stripe checkout, billing portal, and plan enforcement
            are deferred until after the public beta.
          </p>
        </BlurFade>
      </section>

      {/* ── Plan cards ── */}
      <section className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
        {PLANS.map((plan, i) => {
          const featured = plan.key === "growth";
          return (
            <BlurFade key={plan.key} delay={0.15 + i * 0.08}>
              <MagicCard
                className={
                  "flex h-full flex-col rounded-xl border bg-white p-6 " +
                  (featured
                    ? "border-[#1f4d3a]/40 ring-2 ring-[#1f4d3a]/20"
                    : "border-neutral-200")
                }
                gradientFrom={FOREST}
                gradientTo="#2d6a4f"
                gradientColor="#ecf3ee"
                gradientOpacity={featured ? 0.15 : 0.08}
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-neutral-900">
                    {plan.label}
                  </h2>
                  {featured ? (
                    <span className="rounded-full bg-[#ecf3ee] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#1f4d3a]">
                      Most popular
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-neutral-500">{plan.tagline}</p>

                <p className="mt-6 font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-tight text-neutral-900">
                  <PriceHeadline value={plan.priceHeadline} />
                </p>
                <p className="mt-1 text-[11px] text-neutral-400">
                  {plan.priceSubline}
                </p>
                {plan.trialNote ? (
                  <p className="mt-2 text-xs text-sem-green">{plan.trialNote}</p>
                ) : null}

                <ul className="mt-6 flex-1 space-y-2.5 text-sm text-neutral-600">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <span className="mt-0.5 shrink-0 text-[#1f4d3a]">
                        <Check size={14} weight="bold" />
                      </span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {featured ? (
                  <Link href={ctaHref(plan.ctaTarget)} className="mt-6 block">
                    <ShimmerButton className="w-full py-2.5 text-sm font-medium" background={FOREST}>
                      {plan.ctaLabel}
                    </ShimmerButton>
                  </Link>
                ) : (
                  <Link
                    href={ctaHref(plan.ctaTarget)}
                    className="mt-6 block rounded-lg border border-neutral-200 px-4 py-2.5 text-center text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-400 hover:text-neutral-900"
                  >
                    {plan.ctaLabel}
                  </Link>
                )}
              </MagicCard>
            </BlurFade>
          );
        })}
      </section>

      {/* ── Comparison table ── */}
      <BlurFade delay={0.1}>
        <section className="mt-20">
          <div className="mb-4 flex items-baseline gap-3">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-neutral-900">
              Compare plans
            </h2>
          </div>
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-[0_1px_3px_rgba(15,15,20,0.06)]">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50">
                    <th scope="col" className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                      Feature
                    </th>
                    {PLANS.map((plan) => (
                      <th
                        key={plan.key}
                        scope="col"
                        className="px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-neutral-400"
                      >
                        {plan.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {COMPARISON_ROWS.map((row) => (
                    <tr key={row.feature} className="hover:bg-neutral-50/60">
                      <th
                        scope="row"
                        className="px-5 py-3.5 text-left font-normal text-neutral-700"
                      >
                        {row.feature}
                      </th>
                      <td className="px-5 py-3.5 text-center">
                        {typeof row.starter === "boolean" ? (
                          <span className="inline-flex justify-center"><CheckMark on={row.starter} /></span>
                        ) : (
                          <span className="text-neutral-900">{row.starter}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {typeof row.growth === "boolean" ? (
                          <span className="inline-flex justify-center"><CheckMark on={row.growth} /></span>
                        ) : (
                          <span className="text-neutral-900">{row.growth}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {typeof row.enterprise === "boolean" ? (
                          <span className="inline-flex justify-center"><CheckMark on={row.enterprise} /></span>
                        ) : (
                          <span className="text-neutral-900">{row.enterprise}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </BlurFade>

      {/* ── FAQ ── */}
      <BlurFade delay={0.1}>
        <section className="mt-20">
          <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl font-bold text-neutral-900">
            Frequently asked questions
          </h2>
          <div className="divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-[0_1px_3px_rgba(15,15,20,0.06)]">
            {PRICING_FAQS.map((faq) => (
              <details key={faq.q} className="group px-5 py-4">
                <summary className="cursor-pointer list-none font-medium text-neutral-900 marker:hidden">
                  <span className="flex items-start justify-between gap-4">
                    <span>{faq.q}</span>
                    <span
                      aria-hidden
                      className="mt-0.5 shrink-0 text-neutral-400 transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-neutral-500">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </section>
      </BlurFade>

      {/* ── Enterprise CTA ── */}
      <BlurFade delay={0.15}>
        <section className="mt-20 overflow-hidden rounded-2xl border border-[#1f4d3a]/20 bg-[#ecf3ee] p-10 text-center">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight text-neutral-900">
            Need something{" "}
            <span className="text-[#1f4d3a]">bespoke</span>?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-neutral-600">
            Enterprise programmes will eventually need seats, API access, bulk
            export, and dedicated compliance review. During beta, tell us what
            your team needs and we will use it to shape the roadmap.
          </p>
          <div className="mt-6 inline-block">
            <Link href="mailto:sales@sourcebd.net?subject=SourceBD%20Enterprise%20enquiry">
              <ShimmerButton className="px-8 py-3 text-sm font-medium" background={FOREST}>
                <span className="flex items-center gap-2">
                  Contact sales <ArrowRight size={16} />
                </span>
              </ShimmerButton>
            </Link>
          </div>
        </section>
      </BlurFade>

    </main>
  );
}
