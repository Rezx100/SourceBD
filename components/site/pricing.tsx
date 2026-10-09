// Pricing (B9d; Paper `30 Marketing · Pricing`): two plans as they really are today, what the product holds now and
// nothing designed-but-unbuilt, and the questions buyers ask. There is no price anywhere because there is none yet; the
// page says so. Enterprise lists only what exists (the agreements and a call), never SSO, an audit log or evidence packs.
// The supplier count comes from the site's live facts and is left out when it was not read.

import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/kit";
import { Close, Display, Faq, HeroActions, Label, Lede, Section, wrap } from "@/components/site/parts";
import { withCommas, type SiteFacts } from "@/lib/site-facts";
import { cn } from "@/lib/utils";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sourcebd.net";

export const PRICING_TITLE = "Pricing — SourceBD";
export const PRICING_DESCRIPTION = "SourceBD is free while it is in beta, with no card needed. Enterprise teams can ask for a data processing agreement, invoicing and help setting up.";

export const pricingMetadata = (): Metadata => ({
  title: PRICING_TITLE,
  description: PRICING_DESCRIPTION,
  robots: { index: true, follow: true },
  alternates: { canonical: `${SITE_URL}/pricing` },
  openGraph: { title: PRICING_TITLE, description: PRICING_DESCRIPTION, url: `${SITE_URL}/pricing`, siteName: "SourceBD", locale: "en_GB", type: "website" },
});

const BETA = ["Search {n} suppliers with filters", "Supplier records with sources and dates", "RFQ to up to 50 suppliers at once", "Messages, saved suppliers, expiry watch", "UFLPA and sanctions list checks"];
const ENTERPRISE = ["A data processing agreement, on request", "Terms and invoicing agreed with you", "A call to set up your team"];

/** Only what ships today; the second and third columns are what each plan gets. */
const COMPARE: [string, string, string][] = [
  ["Search with filters: HS code, certificate, place, size", "Included", "Included"],
  ["Supplier records with sources and dates", "Included", "Included"],
  ["Save suppliers", "Included", "Included"],
  ["RFQs and messages with suppliers", "Up to 50 suppliers per RFQ", "Up to 50 suppliers per RFQ"],
  ["Certificate expiry watch", "Included", "Included"],
  ["UFLPA Entity List and sanctions list checks", "Included", "Included"],
  ["Data processing agreement", "Enterprise only", "On request"],
  ["Terms and invoicing", "Standard terms", "Agreed with you"],
];

const FAQ = [
  { q: "Will it stay free?", a: "The beta stays free. Before any paid plan, we publish the prices first." },
  { q: "Do I need a card?", a: "No. Sign up with your work email." },
  { q: "Who is Enterprise for?", a: "Teams that need a data processing agreement, invoicing, or help getting set up." },
  {
    q: "Where is my data stored?",
    a: (
      <>
        In our Supabase database, AWS region us-west-1, in the United States. See{" "}
        <Link href="/security" prefetch={false} className="font-medium text-brand-ink underline decoration-1 [text-underline-position:from-font]">
          Security
        </Link>
        .
      </>
    ),
  },
  { q: "Can a supplier pay to rank higher?", a: "No. There is no paid placement, and no supplier score." },
];

function Plan({ name, tag, headline, lede, cta, listLabel, items, className }: { name: string; tag: string; headline: string; lede: string; cta: ReactNode; listLabel: string; items: string[]; className?: string }) {
  return (
    <article className={cn("flex flex-col gap-6 rounded-lg border border-line bg-surface p-8 max-sm:p-5", className)}>
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-ink">{name}</h2>
        <p className="font-mono text-sm text-ink-3">{tag}</p>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-display-2 font-semibold leading-[1.1] tracking-tighter text-ink max-md:text-3xl">{headline}</p>
        <p className="text-md text-ink-2">{lede}</p>
      </div>
      <div>{cta}</div>
      <div className="flex flex-col gap-3 border-t border-line pt-5">
        <p className="font-mono text-sm text-ink-3">{listLabel}</p>
        <ul className="flex flex-col gap-2 text-md text-ink">
          {items.map((i) => (
            <li key={i} className="flex gap-3">
              <span aria-hidden className="mt-2.5 h-px w-3 shrink-0 bg-ink-3" />
              {i}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
export function Pricing({ facts }: { facts: SiteFacts }) {
  const count = facts.suppliers !== null ? withCommas(facts.suppliers) : null;
  const beta = BETA.map((b) => (count ? b.replace("{n}", count) : b.replace("Search {n} suppliers", "Search suppliers")));
  return (
    <main className="font-sans text-ink">
      <section className="pb-20 pt-20 max-md:pb-10 max-md:pt-10">
        <div className={cn(wrap, "flex flex-col gap-6")}>
          <Label>Pricing</Label>
          <Display level={1} as="h1" className="max-w-[880px]">
            Free during beta.
          </Display>
          <Lede>Everything in SourceBD is free while we are in beta. No card needed.</Lede>
          <HeroActions tryLine={count ? `Search ${count} suppliers by name, product or HS code` : "Search suppliers by name, product or HS code"} />
        </div>
      </section>

      <section aria-labelledby="plans" className="bg-subtle py-20 max-md:py-12">
        <div className={cn(wrap, "flex flex-col gap-8")}>
          <div className="flex flex-col gap-2">
            <h2 id="plans" className="font-mono text-base text-ink-3 max-sm:text-sm">
              Two plans, as they really are today
            </h2>
            <p className="text-sm text-ink-3">No prices yet · updated 3 Oct 2026</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <Plan
              name="Beta"
              tag="For every buyer, today"
              headline="Free during beta"
              lede="Every feature in the product. No card, no trial clock."
              cta={
                <ButtonLink href="/signup" prefetch={false} kind="primary" size="lg" className="max-sm:h-input-touch">
                  Start free
                </ButtonLink>
              }
              listLabel="What you get"
              items={beta}
            />
            <Plan
              name="Enterprise"
              tag="For teams with paperwork"
              headline="Talk to us"
              lede="The same product, with the agreements your company needs."
              cta={
                <ButtonLink href="/contact" prefetch={false} kind="secondary" size="lg" className="max-sm:h-input-touch">
                  Contact sales
                </ButtonLink>
              }
              listLabel="Everything in Beta, plus"
              items={ENTERPRISE}
            />
          </div>
        </div>
      </section>

      <Section label="01 · Compare" headline="What is in the product today." lede="Only what ships now. Designs that are not built yet are not on this list.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <caption className="sr-only">What each plan includes today</caption>
            <thead>
              <tr className="border-b border-ink text-base font-semibold text-ink">
                <th scope="col" className="py-3 pr-4">
                  <span className="sr-only">Feature</span>
                </th>
                <th scope="col" className="py-3 pr-4">Beta</th>
                <th scope="col" className="py-3">Enterprise</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {COMPARE.map(([f, a, b]) => (
                <tr key={f} className="align-top text-md">
                  <th scope="row" className="py-4 pr-4 font-normal text-ink">{f}</th>
                  <td className="py-4 pr-4 text-ink-2">{a}</td>
                  <td className="py-4 text-ink-2">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section label="02 · Questions" headline="Questions buyers ask." tone="subtle">
        <Faq items={FAQ} />
        <Link href="/contact" prefetch={false} className="w-fit text-md font-medium text-brand-ink underline decoration-1 [text-underline-position:from-font]">
          Contact sales
        </Link>
      </Section>

      <Close headline="Start free today." lede="Free during beta. No card needed." />
    </main>
  );
}
