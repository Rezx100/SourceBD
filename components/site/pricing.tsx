// Pricing (B9d; Paper `30 Marketing · Pricing`): two plans as they really are today, what the product holds now and
// nothing designed-but-unbuilt, and the questions buyers ask. There is no price anywhere because there is none yet; the
// page says so. Enterprise lists only what exists (the agreements and a call), never SSO or an audit log.
// The supplier count comes from the site's live facts and is left out when it was not read.

import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { Metadata } from "next";
import { ButtonLink } from "@/components/kit";
import { HomeMain } from "@/components/site/home-main";
import { CloseActions, Finale } from "@/components/site/sections/close";
import { Band, FactCards, PageHead, tabular } from "@/components/site/sections/inner";
import { inkLink, secondary } from "@/components/site/sections/ui";
import { withCommas, type SiteFacts } from "@/lib/site-facts";

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
  ["Modern slavery statement draft from your saved suppliers", "Included", "Included"],
  ["Evidence pack: certificates, UFLPA checks and sources as one CSV", "Included", "Included"],
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
        <Link href="/security" prefetch={false} className={inkLink}>
          Security
        </Link>
        .
      </>
    ),
  },
  { q: "Can a supplier pay to rank higher?", a: "No. There is no paid placement, and no supplier score." },
];

/** A plan as home's close draws its two cards: a sunken panel, its name and line, the way in, then what it holds. */
function Plan({ name, tag, headline, lede, primary, listLabel, items }: { name: string; tag: string; headline: string; lede: string; primary: boolean; listLabel: string; items: string[] }) {
  return (
    <article className="flex flex-col gap-6 rounded-frame bg-sunken p-6 md:p-8">
      <div className="flex flex-col gap-1">
        <h3 className="font-display text-site-card text-ink">{name}</h3>
        <p className="font-book text-site-card text-ink-2">{tag}</p>
      </div>
      <div className="flex flex-col gap-2">
        <p className="font-display text-site-section-sm text-ink md:text-site-section">{headline}</p>
        <p className="font-book text-site-card text-ink-2">{lede}</p>
      </div>
      {primary ? (
        <ButtonLink href="/signup" prefetch={false} kind="primary" size="lg" className="h-10 w-fit rounded-full px-5 text-site-item">
          Start free
        </ButtonLink>
      ) : (
        <Link href="/contact" prefetch={false} className={secondary}>
          Book a demo
          <ArrowUpRight size={14} aria-hidden />
        </Link>
      )}
      <div className="flex flex-col gap-3 border-t border-line pt-5">
        <p className="font-display text-site-item text-ink-2">{listLabel}</p>
        <ul className="flex flex-col gap-2 font-book text-site-item text-ink">
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
    <HomeMain className="font-sans antialiased">
      <PageHead label="Pricing" title="Free during beta." lede="Everything in SourceBD is free while we are in beta. No card needed.">
        <CloseActions />
      </PageHead>

      <Band id="plans" tone="warm" heading="Two plans, as they really are today" lede="No prices yet.">
        <div className="grid gap-4 md:grid-cols-2 md:gap-8">
          <Plan name="Beta" tag="For every buyer, today" headline="Free during beta" lede="Every feature in the product. No card, no trial clock." primary listLabel="What you get" items={beta} />
          <Plan name="Enterprise" tag="For teams with paperwork" headline="Terms agreed with you" lede="The same product, with the agreements your company needs." primary={false} listLabel="Everything in Beta, plus" items={ENTERPRISE} />
        </div>
      </Band>

      <Band id="compare" tone="day" heading="What is in the product today." lede="Only what ships now. Designs that are not built yet are not on this list.">
        <div tabIndex={0} role="region" aria-label="What each plan includes, scrolls sideways" className={tabular}>
          <table>
            <caption className="sr-only">What each plan includes today</caption>
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">Feature</span>
                </th>
                <th scope="col">Beta</th>
                <th scope="col">Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map(([f, a, b]) => (
                <tr key={f}>
                  <th scope="row">{f}</th>
                  <td>{a}</td>
                  <td>{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Band>

      <FactCards id="faq" tone="day" heading="Questions buyers ask." items={FAQ.map((f) => ({ title: f.q, body: f.a }))} cols={2} />

      <Finale heading="Start free today." />
    </HomeMain>
  );
}
