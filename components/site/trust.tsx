// The trust pages (B9e; Paper `30 Marketing`): Security, Data & methodology, For suppliers and About. They share the
// marketing parts and say what is true today: the security answers come from the runbooks and the live database, the
// source table comes from `public.sources` and is drawn with figures only when they were read, the supplier page
// sends a claim to the sign-up that makes a supplier account, and the About district counts are dated and static.
// Nothing here is a score, a badge, or a promise the product does not keep.

import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/kit";
import { Close, Display, HeroActions, Label, Lede, Section, wrap } from "@/components/site/parts";
import { SOURCE_COUNT, TIERS, type Tier } from "@/components/site/sources";
import { SUBPROCESSORS, subprocessorCount } from "@/components/site/subprocessors";
import { readDay, withCommas, type SiteFacts, type SourceFact } from "@/lib/site-facts";
import { cn } from "@/lib/utils";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sourcebd.net";

export function trustMetadata(path: string, title: string, description: string): Metadata {
  return { title, description, alternates: { canonical: `${SITE_URL}${path}` }, openGraph: { title, description, url: `${SITE_URL}${path}`, siteName: "SourceBD", locale: "en_GB", type: "website" } };
}

const mailto = "font-medium text-brand-ink underline decoration-1 [text-underline-position:from-font]";
const A = ({ href, children }: { href: string; children: ReactNode }) =>
  href.startsWith("mailto:") ? (
    <a href={href} className={mailto}>
      {children}
    </a>
  ) : (
    <Link href={href} prefetch={false} className={mailto}>
      {children}
    </Link>
  );

function Hero({ label, h1, lede, children, actions = true, count }: { label: string; h1: ReactNode; lede: ReactNode; children?: ReactNode; actions?: boolean; count: string | null }) {
  return (
    <section className="pb-20 pt-20 max-md:pb-10 max-md:pt-10">
      <div className={cn(wrap, "flex flex-col gap-6")}>
        <Label>{label}</Label>
        <Display level={1} as="h1" className="max-w-[880px]">
          {h1}
        </Display>
        <Lede>{lede}</Lede>
        {actions ? <HeroActions tryLine={count ? `Search ${count} suppliers by name, product or HS code` : "Search suppliers by name, product or HS code"} /> : null}
        {children}
      </div>
    </section>
  );
}

const countOf = (f: SiteFacts) => (f.suppliers !== null ? withCommas(f.suppliers) : null);

// ---- Security ----------------------------------------------------------------------------------------------------

export const SECURITY_META = { path: "/security", title: "Security — SourceBD", description: "What SourceBD does for security today: where the data is hosted, how access is checked, backups, sub-processors and the data processing agreement. No badges, no promises." };

const ANSWERS: [string, string][] = [
  ["Hosting and region", "Supabase, AWS us-west-1, United States"],
  ["Encryption in transit", "HTTPS on every page"],
  ["Access control", "Checked on the server, every request"],
  ["Row-level security", "On for every table the product uses"],
  ["Backups", "Once a day, with a written restore plan"],
  ["Sub-processors", `${subprocessorCount()}, each named below`],
  ["GDPR", "UK GDPR for buyer accounts"],
  ["Data processing agreement", "On request"],
  ["Contact", "support@sourcebd.net"],
];

export function Security({ facts }: { facts: SiteFacts }) {
  const count = countOf(facts);
  return (
    <main className="font-sans text-ink">
      <Hero label="Security" h1="Security, stated plainly." lede="What we do today. No badges, no promises." count={count} />

      <section aria-labelledby="nine" className="bg-subtle py-20 max-md:py-12">
        <div className={cn(wrap, "flex flex-col gap-8")}>
          <div className="flex flex-col gap-2">
            <h2 id="nine" className="font-mono text-base text-ink-3 max-sm:text-sm">
              Nine answers for your security review
            </h2>
            <p className="font-mono text-sm text-ink-3">Checked against our own runbooks · 5 Oct 2026</p>
          </div>
          <dl className="grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {ANSWERS.map(([q, a]) => (
              <div key={q} className="flex flex-col gap-1 border-t border-ink pt-3">
                <dt className="text-lg font-semibold text-ink">{q}</dt>
                <dd className="text-md text-ink-2">{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <Section label="The details" headline="Each answer, in one place.">
        <div className="flex max-w-[800px] flex-col gap-8">
          <Detail title="Hosting and region">The database runs on Supabase, in AWS region us-west-1, United States. The app deploys only from reviewed code on GitHub.</Detail>
          <Detail title="Encryption in transit">Every page loads over HTTPS through Cloudflare, and is encrypted again from Cloudflare to our server.</Detail>
          <Detail title="Access control">Your role and ownership are checked on the server on every request. Hiding a button is never the control. Contact details leave the server only when you may see them.</Detail>
          <Detail title="Row-level security">Switched on for every table the product reads and writes, so a query only returns the rows its user may read.</Detail>
          <Detail title="Backups">The database is backed up once a day. Our written restore plan: lose at most 24 hours of data, and be back within 4 hours.</Detail>
          <Detail title="Sub-processors">
            <ul className="mt-1 flex flex-col gap-1">
              {SUBPROCESSORS.map(([n, w]) => (
                <li key={n}>
                  <span className="font-semibold text-ink">{n}</span> · {w}
                </li>
              ))}
            </ul>
          </Detail>
          <Detail title="GDPR">
            We follow UK GDPR for buyer accounts. The <A href="/legal/privacy">privacy notice</A> lists what we collect and why. Non-essential cookies stay off until you turn them on.
          </Detail>
          <Detail title="Data processing agreement">
            On request. Write to <A href="mailto:privacy@sourcebd.net">privacy@sourcebd.net</A>.
          </Detail>
          <Detail title="Contact">
            Found a security problem? Write to <A href="mailto:support@sourcebd.net">support@sourcebd.net</A>.
          </Detail>
        </div>
      </Section>

      <Section label="Not today" headline="What we don't have yet." tone="subtle">
        <ul className="flex max-w-[800px] flex-col gap-3 text-lg text-ink">
          <li>No SOC 2 or ISO 27001 report. We will not show a badge we have not earned.</li>
          <li>No single sign-on yet.</li>
          <li>
            Our UK ICO registration is pending; the <A href="/legal/privacy">privacy notice</A> says so.
          </li>
        </ul>
      </Section>

      <Close headline="Questions for your review? Ask us." lede="Free during beta. No card needed." />
    </main>
  );
}

function Detail({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      <div className="text-md text-ink-2">{children}</div>
    </div>
  );
}

// ---- Data & methodology ------------------------------------------------------------------------------------------

export const METHOD_META = { path: "/methodology", title: "Data & methodology — SourceBD", description: "How SourceBD checks every Bangladesh garment supplier: the 25 sources in order of trust, how fresh each fact is, how names are matched, and what we never do. No scores." };

const NINETY_DAYS = 90 * 864e5;

function sourceFigures(facts: SiteFacts, code: string): SourceFact | null {
  return facts.sources?.find((s) => s.code === code) ?? null;
}

function TierTable({ tier, facts, now }: { tier: Tier; facts: SiteFacts; now: number }) {
  const read = facts.sources !== null;
  const regs = tier.key === "tier5_regulatory";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-xl font-semibold text-ink">
          Tier {tier.n} · {tier.label}
        </h3>
        <p className="max-w-prose text-md text-ink-2">{tier.note}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <caption className="sr-only">
            Tier {tier.n}, {tier.label}: each source{regs ? ", who keeps it" : " and what it gives us"}
            {read ? (regs ? ", its entries and when we last read it" : ", how many suppliers have a record from it and when we last read it") : ""}
          </caption>
          <thead>
            <tr className="border-b border-ink text-sm text-ink-3">
              <th scope="col" className="py-2 pr-4 font-medium">{regs ? "List" : "Source"}</th>
              <th scope="col" className="py-2 pr-4 font-medium">{regs ? "Kept by" : "What it gives us"}</th>
              {read ? (
                <>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">{regs ? "Entries" : "Suppliers with a record"}</th>
                  <th scope="col" className="py-2 font-medium">Last read</th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {tier.sources.map((s) => {
              const f = sourceFigures(facts, s.code);
              const figure = f ? (regs ? f.records : f.suppliers) : null;
              const stale = f?.latest ? now - Date.parse(f.latest) > NINETY_DAYS : false;
              return (
                <tr key={s.code} className="align-top text-md">
                  <th scope="row" className="py-3 pr-4 font-semibold text-ink">
                    {s.name}
                    {regs ? null : <span className="block text-sm font-normal text-ink-3">{s.full}</span>}
                  </th>
                  <td className="py-3 pr-4 text-ink-2">{regs ? s.full : s.gives}</td>
                  {read ? (
                    <>
                      <td className="py-3 pr-4 text-right font-mono text-ink">{f && f.records > 0 && figure !== null ? withCommas(figure) : <span className="font-sans text-ink-3">{f ? "Listed, no records yet" : "Not read yet"}</span>}</td>
                      <td className="py-3 text-ink-2">
                        {f && f.records > 0 && f.latest ? (
                          <>
                            {readDay(f.latest)}
                            {stale ? <span className="font-medium text-ink"> · over 90 days ago</span> : null}
                          </>
                        ) : (
                          "Not read yet"
                        )}
                      </td>
                    </>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const MATCH = ["Records that share a registration number are one supplier.", "Without a number, we match name and address. Doubtful pairs go to a person.", "When two sources disagree, we keep both and show both."];
const NEVER = ["No scores, grades or stars on a supplier.", "No paid placement. A supplier can't pay to rank higher.", "No fact without a source and a date.", "A lower tier never overwrites a higher one.", "A cross-check source never puts a supplier on SourceBD alone."];

export function Methodology({ facts, now = Date.now() }: { facts: SiteFacts; now?: number }) {
  const count = countOf(facts);
  const listed = facts.sourcesListed ?? SOURCE_COUNT;
  const sub = facts.sourcesWithRecords !== null ? `${listed} sources listed · ${facts.sourcesWithRecords} hold supplier records. Read in order of trust. No scores.` : `${listed} sources listed. Read in order of trust. No scores.`;
  const updated = readDay(facts.latestRead);
  return (
    <main className="font-sans text-ink">
      <Hero label="Data & methodology" h1="How we check every supplier." lede={sub} count={count}>
        <div id="tiers" className="flex scroll-mt-24 flex-col gap-4 pt-6">
          <p className="font-mono text-sm text-ink-3">The source ladder · a higher tier is never overwritten by a lower one</p>
          <ol className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-5">
            {TIERS.map((t) => (
              <li key={t.key} className="flex flex-col gap-1 border-t border-ink pt-3">
                <span className="font-mono text-sm text-ink-3">
                  Tier {t.n} · {t.sources.length} {t.n === 5 ? "lists" : "sources"}
                </span>
                <span className="text-xl font-semibold text-ink">{t.label}</span>
                <span className="text-base text-ink-2">{t.ladder}</span>
              </li>
            ))}
          </ol>
        </div>
      </Hero>

      <Section id="sources" label={`01 · The ${SOURCE_COUNT} sources`} headline="Every source, what it gives, and when we read it." lede={facts.sources !== null ? "Counts are published suppliers with a record from that source. A date marked “over 90 days ago” was read more than 90 days ago." : "Every source we list, and what it gives us. The counts and dates appear here when the register has been read."} tone="subtle">
        <div className="flex flex-col gap-14">
          {TIERS.map((t) => (
            <TierTable key={t.key} tier={t} facts={facts} now={now} />
          ))}
          {facts.sources !== null && updated ? <p className="font-mono text-sm text-ink-3">From the sources table · latest read {updated}</p> : null}
        </div>
      </Section>

      <Section label="02 · How fresh" headline="Every fact carries the date we read it.">
        <p className="max-w-prose text-md text-ink-2">RSC is read every week. Every day we re-open a batch of source pages to check the fact is still there. The other registers have no fixed schedule yet.</p>
      </Section>

      <Section id="matching" label="03 · How we match" headline="One factory, one record." tone="subtle" className="scroll-mt-24">
        <ol className="flex max-w-[800px] flex-col gap-3 text-md text-ink-2">
          {MATCH.map((m, i) => (
            <li key={m}>
              {i + 1}. {m}
            </li>
          ))}
        </ol>
      </Section>

      <Section id="corrections" label="04 · Corrections" headline="Spot a wrong fact? Tell us." className="scroll-mt-24">
        <p className="max-w-prose text-md text-ink-2">
          Write to <A href="mailto:data@sourcebd.net">data@sourcebd.net</A>. We read the source again. The source wins.
        </p>
        <div>
          <ButtonLink href="mailto:data@sourcebd.net?subject=Correction" kind="secondary" size="lg" className="max-sm:h-input-touch">
            Report a correction
          </ButtonLink>
        </div>
      </Section>

      <Section label="05 · What we never do" headline="Receipts, not opinions." tone="subtle">
        <ol className="grid max-w-[800px] gap-4">
          {NEVER.map((n, i) => (
            <li key={n} className="flex gap-4 border-t border-line pt-3 text-lg text-ink">
              <span className="font-mono text-base text-ink-3">{String(i + 1).padStart(2, "0")}</span>
              {n}
            </li>
          ))}
        </ol>
      </Section>

      <Close headline="See the sources on a real record." lede="Free during beta. No card needed." />
    </main>
  );
}

// ---- For suppliers -----------------------------------------------------------------------------------------------

export const SUPPLIERS_META = { path: "/suppliers", title: "For suppliers — SourceBD", description: "Buyers in the UK, EU, US and Canada already see your factory's record. Claim it free, check it, flag what is out of date and answer RFQs." };

const WHY: [string, string][] = [
  ["Answer RFQs", "Buyers send RFQs from your record. Reply and quote in one thread."],
  ["Fix what is out of date", "Tell us when a fact is wrong. We read the source again, and the source wins."],
  ["See what buyers see", "Every fact on your record, with the register it came from and the date we read it."],
];

const STEPS: [string, string][] = [
  ["Find your company", "Search by name or registration number."],
  ["Open the email we send", "We send a link to your company email. It works for 24 hours."],
  ["Approved, or a person checks", "If your email domain matches the company's, the claim is approved at once. If not, a person reviews it."],
];

export function ForSuppliers({ facts }: { facts: SiteFacts }) {
  const count = countOf(facts);
  const updated = readDay(facts.latestRead);
  return (
    <main className="font-sans text-ink">
      <Hero label="For suppliers" h1="Claim your factory's record." lede="Buyers in the UK, EU, US and Canada see it today. Check it, flag what is out of date, answer RFQs." actions={false} count={count}>
        <div className="flex flex-wrap items-center gap-4">
          <ButtonLink href="/signup?role=supplier" prefetch={false} kind="primary" size="lg" className="max-sm:h-input-touch">
            Start your claim
          </ButtonLink>
          <A href="/contact">Talk to us</A>
        </div>
        <figure className="flex flex-col gap-3 pt-6">
          <Image src="/site/records-overview.png" alt="A supplier record as a buyer sees it: sanctions, certificates, safety, workers and sources at the top, then the key facts, each with where it came from." width={1440} height={900} className="h-auto w-full rounded-lg border border-line shadow-dialog" />
          <figcaption className="font-mono text-sm text-ink-3">
            Real screen · what buyers see today on Aboni Knitwear Ltd., a real public record
            {count ? ` · ${count} published suppliers${updated ? ` · updated ${updated}` : ""}` : ""}
          </figcaption>
        </figure>
      </Hero>

      <Section label="01 · Why claim" headline="Buyers already look you up." tone="subtle">
        <dl className="grid gap-x-10 gap-y-6 md:grid-cols-3">
          {WHY.map(([t, b]) => (
            <div key={t} className="flex flex-col gap-1 border-t border-ink pt-3">
              <dt className="text-xl font-semibold text-ink">{t}</dt>
              <dd className="text-md text-ink-2">{b}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section label="02 · What you can change" headline="Your answers. Not your receipts.">
        <div className="grid max-w-[900px] gap-8 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <h3 className="text-base font-semibold text-ink">You can</h3>
            <p className="text-md text-ink-2">Reply to buyers&apos; RFQs and messages, and report a fact that is out of date.</p>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-base font-semibold text-ink">Only the source can change</h3>
            <p className="text-md text-ink-2">Register facts, certificates, safety reports and sanctions. Ask the source to update it; we read it again.</p>
          </div>
        </div>
        <p className="w-fit rounded-sm border border-dashed border-line-strong px-2 py-1 text-sm font-semibold text-ink-2">Editing your own products: in design, not in the product yet</p>
      </Section>

      <Section label="03 · How we check it is you" headline="Three steps to claim your record." tone="subtle">
        <ol className="grid gap-x-10 gap-y-6 md:grid-cols-3">
          {STEPS.map(([t, b], i) => (
            <li key={t} className="flex flex-col gap-2 border-t border-ink pt-3">
              <span className="font-mono text-2xl text-ink-3">{i + 1}</span>
              <span className="text-lg font-semibold text-ink">{t}</span>
              <span className="text-md text-ink-2">{b}</span>
            </li>
          ))}
        </ol>
        <div>
          <ButtonLink href="/signup?role=supplier" prefetch={false} kind="primary" size="lg" className="max-sm:h-input-touch">
            Start your claim
          </ButtonLink>
        </div>
      </Section>

      <Close headline="Your record is already public. Claim it." lede="Claiming is free. Buyers can also start here." />
    </main>
  );
}

// ---- About -------------------------------------------------------------------------------------------------------

export const ABOUT_META = { path: "/about", title: "About — SourceBD", description: "SourceBD makes every fact about a Bangladesh garment supplier checkable: the source, the number, the date. Bangladesh only, with receipts instead of opinions." };

/** Published suppliers by district as counted on 3 Oct 2026; the page says the day, and a count is never read live here. */
const DISTRICTS: [string, string, string][] = [
  ["Dhaka", "4,421", "suppliers, 874 of them with Savar in the address"],
  ["Gazipur", "1,819", "suppliers"],
  ["Narayanganj", "1,628", "suppliers"],
  ["Chattogram", "1,080", "suppliers"],
  ["43 more districts", "445", "suppliers, from Mymensingh (134) and Narsingdi (91) down"],
  ["District not on file", "875", "suppliers whose register gives no district"],
];

const HOW: [string, string][] = [
  ["Every fact shows its source.", "In words, with the date we read it."],
  ["Nothing fake.", "Real records or nothing. Examples are labelled as samples."],
  ["Gaps are shown as gaps.", "Locked, empty, out of date and sanctioned are normal states."],
  ["No scores, no paid placement.", "We never rate a supplier, and no one pays to rank higher."],
];

export function About({ facts }: { facts: SiteFacts }) {
  const count = countOf(facts);
  return (
    <main className="font-sans text-ink">
      <Hero label="Company · About" h1="Built for buyers who check." lede="We make every fact about a Bangladesh garment supplier checkable: the source, the number, the date." count={count} />

      <section aria-labelledby="where" className="bg-subtle py-20 max-md:py-12">
        <div className={cn(wrap, "flex flex-col gap-8")}>
          <div className="flex flex-col gap-2">
            <h2 id="where" className="font-mono text-base text-ink-3 max-sm:text-sm">
              Bangladesh only · where the suppliers are
            </h2>
            <p className="font-mono text-sm text-ink-3">Published suppliers by district · counted 3 Oct 2026</p>
          </div>
          <dl className="grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {DISTRICTS.map(([place, n, what]) => (
              <div key={place} className="flex flex-col gap-1 border-t border-ink pt-3">
                <dt className="text-xl font-semibold text-ink">{place}</dt>
                <dd className="font-mono text-xl text-ink">{n}</dd>
                <dd className="text-md text-ink-2">{what}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <Section label="How we work" headline="Receipts, not opinions.">
        <dl className="grid max-w-[900px] gap-x-10 gap-y-6 md:grid-cols-2">
          {HOW.map(([t, b]) => (
            <div key={t} className="flex flex-col gap-1 border-t border-ink pt-3">
              <dt className="text-lg font-semibold text-ink">{t}</dt>
              <dd className="text-md text-ink-2">{b}</dd>
            </div>
          ))}
        </dl>
        <A href="/methodology">Read the methodology</A>
      </Section>
    </main>
  );
}
