// Marketing pricing page. Public, indexable, static.
//
// Design source of truth: app/(app)/app/settings/plan/page.tsx — the
// authenticated plan page uses Card + CardHeader + CardTitle + CardContent
// + Button (all portal-native components). This marketing page mirrors that
// exact component pattern so /pricing and /app/settings/plan look like the
// same product. Magic UI BlurFade provides section entrances;
// is used only for the standalone enterprise CTA (not inside plan cards).

import Link from "next/link";
import { ArrowRight, Check } from "@phosphor-icons/react/dist/ssr";

import { BlurFade } from "@/components/ui/blur-fade";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormGrid } from "@/components/ui/form-grid";
import { Kicker } from "@/components/ui/page-kit";

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
    <span aria-label="Included" className="inline-flex justify-center text-sem-green">
      <Check size={16} weight="bold" />
    </span>
  ) : (
    <span aria-label="Not included" className="inline-flex justify-center text-ink-tertiary">
      —
    </span>
  );
}

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">

      {/* ── Hero ── */}
      <section className="mb-12 flex flex-col items-center text-center">
        <BlurFade delay={0.1} className="mx-auto w-full max-w-4xl text-center">
          <Kicker className="justify-center">Pricing</Kicker>
          <h1 className="mx-auto mt-1 text-balance font-display text-[clamp(1.75rem,7vw,2.5rem)] font-bold tracking-tight text-ink-primary">
            Free during public beta.{" "}
            <span className="text-brand-forest">No card required.</span>
          </h1>
        </BlurFade>
        <BlurFade delay={0.2} className="w-full text-center">
          <div className="flex w-full justify-center">
            <p className="mt-4 max-w-md text-center text-sm leading-relaxed text-ink-secondary">
              SourceBD is open at zero price while we validate buyer workflows,
              data quality, and the right commercial model. No card, no checkout,
              no hidden paid gate.
            </p>
          </div>
          <div className="mt-2 flex w-full justify-center">
            <p className="max-w-xs text-center text-[12px] leading-relaxed text-ink-tertiary">
              Paid tiers, Stripe checkout, billing portal, and plan enforcement
              are deferred until after the public beta.
            </p>
          </div>
        </BlurFade>
      </section>

      {/* ── Plan cards — exact portal Card + Button pattern ── */}
      <BlurFade delay={0.15}>
        <FormGrid cols={3}>
          {PLANS.map((plan) => {
            const featured = plan.key === "growth";
            return (
              <Card
                key={plan.key}
                className={
                  "flex flex-col " +
                  (featured ? "border-brand-forest shadow-l2 ring-1 ring-brand-forest/20" : "")
                }
              >
                <CardHeader>
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <CardTitle className="text-base">{plan.label}</CardTitle>
                    {featured ? (
                      <Badge tone="active">Most popular</Badge>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4 pt-0">
                  <p className="text-[14px] text-ink-secondary">{plan.tagline}</p>

                  <div>
                    <p className="font-display text-3xl font-bold tracking-tight text-ink-primary">
                      <PriceHeadline value={plan.priceHeadline} />
                    </p>
                    <p className="mt-0.5 text-[12px] text-ink-tertiary">
                      {plan.priceSubline}
                    </p>
                    {plan.trialNote ? (
                      <p className="mt-1 text-[12px] text-sem-green">{plan.trialNote}</p>
                    ) : null}
                  </div>

                  <ul className="flex-1 space-y-2 text-[14px] text-ink-secondary">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check
                          size={17}
                          weight="bold"
                          className="mt-0.5 shrink-0 text-sem-green"
                        />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    asChild
                    variant={featured ? "default" : "outline"}
                    size="lg"
                    className="h-11 w-full text-sm font-semibold shadow-sm"
                  >
                    <Link href={ctaHref(plan.ctaTarget)}>{plan.ctaLabel}</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </FormGrid>
      </BlurFade>

      {/* ── Comparison table ── */}
      <BlurFade delay={0.1}>
        <section className="mt-16">
          <h2 className="mb-4 font-display text-base font-bold text-ink-primary">
            Compare plans
          </h2>
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50">
                    <th scope="col" className="px-3 py-3 text-left text-[12px] font-semibold uppercase tracking-wider text-ink-tertiary sm:px-5">
                      Feature
                    </th>
                    {PLANS.map((plan) => (
                      <th
                        key={plan.key}
                        scope="col"
                        className="px-3 py-3 text-center text-[12px] font-semibold uppercase tracking-wider text-ink-tertiary sm:px-5"
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
                        className="px-3 py-3 text-left text-[14px] font-normal text-ink-secondary sm:px-5"
                      >
                        {row.feature}
                      </th>
                      <td className="px-3 py-3 text-center text-[14px] sm:px-5">
                        {typeof row.starter === "boolean" ? (
                          <CheckMark on={row.starter} />
                        ) : (
                          <span className="text-ink-primary">{row.starter}</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center text-[14px] sm:px-5">
                        {typeof row.growth === "boolean" ? (
                          <CheckMark on={row.growth} />
                        ) : (
                          <span className="text-ink-primary">{row.growth}</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center text-[14px] sm:px-5">
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
          </Card>
        </section>
      </BlurFade>

      {/* ── FAQ ── */}
      <BlurFade delay={0.1}>
        <section className="mt-16">
          <h2 className="mb-4 font-display text-base font-bold text-ink-primary">
            Frequently asked questions
          </h2>
          <Card className="divide-y divide-neutral-100 p-0">
            {PRICING_FAQS.map((faq) => (
              <details key={faq.q} className="group px-5 py-4">
                <summary className="cursor-pointer list-none text-[14px] font-medium text-ink-primary marker:hidden">
                  <span className="flex items-start justify-between gap-4">
                    <span>{faq.q}</span>
                    <span
                      aria-hidden
                      className="mt-0.5 shrink-0 text-ink-tertiary transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </span>
                </summary>
                <p className="mt-3 text-[14px] leading-relaxed text-ink-secondary">
                  {faq.a}
                </p>
              </details>
            ))}
          </Card>
        </section>
      </BlurFade>

      {/* ── Enterprise CTA ── */}
      <BlurFade delay={0.15}>
        <section className="mt-16 overflow-hidden rounded-xl border border-brand-forest-soft bg-brand-forest-soft p-6 text-center sm:p-10">
          <h2 className="text-balance font-display text-xl font-bold tracking-tight text-ink-primary sm:text-2xl">
            Need something{" "}
            <span className="text-brand-forest">bespoke</span>?
          </h2>
          <div className="mt-3 flex w-full justify-center">
            <p className="max-w-md text-center text-sm leading-relaxed text-ink-secondary">
              Enterprise programmes will eventually need seats, API access, bulk
              export, and dedicated compliance review. During beta, tell us what
              your team needs and we will use it to shape the roadmap.
            </p>
          </div>
          <div className="mt-6 inline-block">
            <Link
              href="mailto:sales@sourcebd.net?subject=SourceBD%20Enterprise%20enquiry"
              className="btn-proto primary inline-flex h-11 items-center gap-2 px-8 text-sm font-semibold text-white shadow-sm"
            >
              Contact sales <ArrowRight size={17} />
            </Link>
          </div>
        </section>
      </BlurFade>

    </main>
  );
}
