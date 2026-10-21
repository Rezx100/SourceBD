// The trust pages (B9e; Paper `30 Marketing`): Security, Data & methodology, For suppliers and About. They share the
// marketing parts and say what is true today: the security answers come from the runbooks and the live database, the
// source table comes from `public.sources` and is drawn with figures only when they were read, the supplier page
// sends a claim to the sign-up that makes a supplier account, and the About district counts are dated and static
// (re-read by `ops/about_district_counts.sql`, the result in `ops/plans/about-district-counts.md`).
// Nothing here is a score, a badge, or a promise the product does not keep.

import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/kit";
import { DemoClaim } from "@/components/site/demos";
import { HeroActions, HeroCentered, inkLink, measure, Section, TextLink } from "@/components/site/sections/ui";
import { Closing } from "@/components/site/sections/closing";
import { SOURCE_COUNT, TIERS, type Tier } from "@/components/site/sources";
import { SUBPROCESSORS, subprocessorCount } from "@/components/site/subprocessors";
import { readDay, withCommas, type SiteFacts, type SourceFact } from "@/lib/site-facts";
import { cn } from "@/lib/utils";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sourcebd.net";

export function trustMetadata(path: string, title: string, description: string): Metadata {
  return { title, description, alternates: { canonical: `${SITE_URL}${path}` }, openGraph: { title, description, url: `${SITE_URL}${path}`, siteName: "SourceBD", locale: "en_GB", type: "website" } };
}

const mailto = inkLink;
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

function Hero({ label, h1, lede, children, actions = true, stage }: { label: string; h1: ReactNode; lede: ReactNode; children?: ReactNode; actions?: boolean; stage?: ReactNode }) {
  return (
    <HeroCentered label={label} title={h1} lede={lede} stage={stage}>
      {actions ? <HeroActions center /> : null}
      {children}
    </HeroCentered>
  );
}

const countOf = (f: SiteFacts) => (f.suppliers !== null ? withCommas(f.suppliers) : null);

/**
 * How often the sources are read, as it is today: every scheduled read has been switched off since 6 Oct 2026
 * (`etl_schedules.enabled` is false for every register, read 22 Oct), so no page claims a weekly or daily read.
 * Methodology and About say the same.
 */
const FRESH = "There is no fixed schedule for re-reading the registers yet. Every fact shows the day its source was last read.";

/** How to report a wrong fact, in one place: Methodology's corrections and About say the same. */
function Correction() {
  return (
    <>
      Write to <A href="mailto:data@sourcebd.net">data@sourcebd.net</A>. We read the source again. The source wins.
    </>
  );
}

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

export function Security() {
  return (
    <main className="font-sans text-ink">
      <Hero label="Security" h1="Security, stated plainly." lede="What we do today. No badges, no promises." />

      <section aria-labelledby="nine" className="bg-surface py-14 md:py-section">
        <div className={cn(measure, "flex flex-col gap-8")}>
          <div className="flex flex-col gap-2">
            <h2 id="nine" className="text-site-body font-medium text-ink-subtle">
              Nine answers for your security review
            </h2>
            <p className="text-sm text-ink-3">Checked against our own runbooks · 5 Oct 2026</p>
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

      <Closing headline="Questions for your review? Ask us." lede="Free during beta. No card needed." />
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

/**
 * A sanctions list's two cells, the same on Methodology and the compliance product page: its entries, and the day of
 * its last full read with a mark when that was over 90 days ago, or "read in part" when no full read has finished.
 */
export function listCells(f: SourceFact | null, now: number): { entries: ReactNode; read: ReactNode } {
  const stale = f?.latest ? now - Date.parse(f.latest) > NINETY_DAYS : false;
  return {
    entries: f && f.records > 0 ? withCommas(f.records) : <span className="text-ink-3">{f ? "Listed, no records yet" : "Not read yet"}</span>,
    read:
      f && f.records > 0 && f.latest ? (
        <>
          {readDay(f.latest)}
          {stale ? <span className="font-medium text-ink"> · over 90 days ago</span> : null}
        </>
      ) : f && f.records > 0 ? (
        "Read in part, no full read yet"
      ) : (
        "Not read yet"
      ),
  };
}

/** Whether the sanctions lists were read: `sanctions_lists_read()` can fail while the other facts do not, and then every list would wrongly say "not read". */
export const listsRead = (facts: SiteFacts): boolean => (facts.sources ?? []).some((s) => s.tier === "tier5_regulatory" && s.records > 0);

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
      <div tabIndex={0} role="region" aria-label={`Tier ${tier.n} sources, scrolls sideways`} className="overflow-x-auto outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
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
              const list = regs ? listCells(f, now) : null;
              return (
                <tr key={s.code} className="align-top text-md">
                  <th scope="row" className="py-3 pr-4 font-semibold text-ink">
                    {s.name}
                    {regs ? null : <span className="block text-sm font-normal text-ink-3">{s.full}</span>}
                  </th>
                  <td className="py-3 pr-4 text-ink-2">{regs ? s.full : s.gives}</td>
                  {read && list ? (
                    <>
                      <td className="py-3 pr-4 text-right tabular-nums text-ink">{list.entries}</td>
                      <td className="py-3 text-ink-2">{list.read}</td>
                    </>
                  ) : read ? (
                    <>
                      <td className="py-3 pr-4 text-right tabular-nums text-ink">{f && f.records > 0 && figure !== null ? withCommas(figure) : <span className="text-ink-3">{f ? "Listed, no records yet" : "Not read yet"}</span>}</td>
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
  const listed = facts.sourcesListed ?? SOURCE_COUNT;
  const sub = facts.sourcesWithRecords !== null ? `${listed} sources listed · ${facts.sourcesWithRecords} hold supplier records. Read in order of trust. No scores.` : `${listed} sources listed. Read in order of trust. No scores.`;
  const updated = readDay(facts.latestRead);
  return (
    <main className="font-sans text-ink">
      <Hero label="Data & methodology" h1="How we check every supplier." lede={sub}>
        <div id="tiers" className="flex scroll-mt-24 flex-col gap-4 pt-6">
          <p className="text-sm text-ink-3">The source ladder · a higher tier is never overwritten by a lower one</p>
          <ol className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-5">
            {TIERS.map((t) => (
              <li key={t.key} className="flex flex-col gap-1 border-t border-ink pt-3">
                <span className="text-sm tabular-nums text-ink-3">
                  Tier {t.n} · {t.sources.length} {t.n === 5 ? "lists" : "sources"}
                </span>
                <span className="text-xl font-semibold text-ink">{t.label}</span>
                <span className="text-base text-ink-2">{t.ladder}</span>
              </li>
            ))}
          </ol>
        </div>
      </Hero>

      <Section id="sources" label={`The ${SOURCE_COUNT} sources`} headline="Every source, what it gives, and when we read it." lede={facts.sources !== null ? "Counts are published suppliers with a record from that source. A date marked “over 90 days ago” was read more than 90 days ago." : "Every source we list, and what it gives us. The counts and dates appear here when the register has been read."} tone="subtle">
        <div className="flex flex-col gap-14">
          {TIERS.map((t) => (
            <TierTable key={t.key} tier={t} facts={facts} now={now} />
          ))}
          {facts.sources !== null && updated ? <p className="text-sm text-ink-3">From the sources table · latest read {updated}</p> : null}
        </div>
      </Section>

      <Section label="How fresh" headline="Every fact carries the date we read it.">
        <p className="max-w-prose text-md text-ink-2">{FRESH}</p>
      </Section>

      <Section id="matching" label="How we match" headline="One factory, one record." tone="subtle" className="scroll-mt-24">
        <ol className="flex max-w-[800px] flex-col gap-3 text-md text-ink-2">
          {MATCH.map((m, i) => (
            <li key={m}>
              {i + 1}. {m}
            </li>
          ))}
        </ol>
      </Section>

      <Section id="corrections" label="Corrections" headline="Spot a wrong fact? Tell us." className="scroll-mt-24">
        <p className="max-w-prose text-md text-ink-2">
          <Correction />
        </p>
        <div>
          <ButtonLink href="mailto:data@sourcebd.net?subject=Correction" kind="secondary" size="lg" className="max-sm:h-input-touch">
            Report a correction
          </ButtonLink>
        </div>
      </Section>

      <Section label="What we never do" headline="Receipts, not opinions." tone="subtle">
        <ol className="grid max-w-[800px] gap-4">
          {NEVER.map((n, i) => (
            <li key={n} className="flex gap-4 border-t border-line pt-3 text-lg text-ink">
              <span className="text-site-body font-medium text-ink-subtle">{String(i + 1).padStart(2, "0")}</span>
              {n}
            </li>
          ))}
        </ol>
      </Section>

      <Closing headline="See the sources on a real record." lede="Free during beta. No card needed." />
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
  ["Open the email we send", "You give us an email at your company and we send it a link. It works for 24 hours."],
  ["Approved, or a person checks", "If your email domain matches the company's, the claim is approved at once. If not, a person reviews it."],
];

export function ForSuppliers({ facts }: { facts: SiteFacts }) {
  const count = countOf(facts);
  const updated = readDay(facts.latestRead);
  return (
    <main className="font-sans text-ink">
      <Hero
        label="For suppliers"
        h1="Claim your factory's record."
        lede="Buyers in the UK, EU, US and Canada see it today. Check it, flag what is out of date, answer RFQs."
        actions={false}
        stage={
          // The claim, played on the snapshot's real record (critique 22 Oct: the 3 Oct screenshot on concrete is gone).
          <DemoClaim
            stage="hero-cotton"
            eager
            after={count ? <p className="text-sm text-ink-subtle">{count} published suppliers{updated ? ` · updated ${updated}` : ""}</p> : null}
          />
        }
      >
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <ButtonLink href="/signup?role=supplier" prefetch={false} kind="primary" size="lg" className="h-12 rounded-frame px-5 text-site-body">
            Start your claim
          </ButtonLink>
          <TextLink href="/contact" className="px-4">
            Book a demo
          </TextLink>
        </div>
      </Hero>

      <Section label="Why claim" headline="Buyers already look you up." tone="subtle">
        <dl className="grid gap-x-10 gap-y-6 md:grid-cols-3">
          {WHY.map(([t, b]) => (
            <div key={t} className="flex flex-col gap-1 border-t border-ink pt-3">
              <dt className="text-xl font-semibold text-ink">{t}</dt>
              <dd className="text-md text-ink-2">{b}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section label="What you can change" headline="Your answers. Not your receipts.">
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

      <Section label="How we check it is you" headline="Three steps to claim your record." tone="subtle">
        <ol className="grid gap-x-10 gap-y-6 md:grid-cols-3">
          {STEPS.map(([t, b], i) => (
            <li key={t} className="flex flex-col gap-2 border-t border-ink pt-3">
              <span className="text-2xl tabular-nums text-ink-3">{i + 1}</span>
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

      <Closing headline="Your record is already public. Claim it." lede="Claiming is free. Buyers can also start here." />
    </main>
  );
}

// ---- About -------------------------------------------------------------------------------------------------------

export const ABOUT_META = { path: "/about", title: "About — SourceBD", description: "SourceBD makes every fact about a Bangladesh garment supplier checkable: the source, the number, the date. Bangladesh only, with receipts instead of opinions." };

/** The day the district counts were read (`ops/about_district_counts.sql`); the page says it, and a count is never read live here. */
export const DISTRICTS_READ = "21 Oct 2026";

/** Published suppliers by district as counted on `DISTRICTS_READ` (`ops/plans/about-district-counts.md`). */
const DISTRICTS: [string, string, string][] = [
  ["Dhaka", "4,651", "suppliers, 854 of them with Savar in the address"],
  ["Gazipur", "1,957", "suppliers"],
  ["Narayanganj", "1,647", "suppliers"],
  ["Chattogram", "1,195", "suppliers"],
  ["35 more districts", "433", "suppliers, from Mymensingh (130) and Narsingdi (94) down"],
  ["District not on file", "165", "suppliers whose register gives no district"],
];

/**
 * Who runs SourceBD, in the words of pages the site already carries (critique 22 Oct, About): the Book a demo page
 * (a message goes to the founder by email), the terms (what we are not; the law they are under), the Security page
 * (UK GDPR, the ICO registration pending, where the data is hosted). Nothing here is new: where the team works and
 * who the founder is are not said anywhere on the site, so About does not say them either.
 */
const WHO: [string, ReactNode][] = [
  ["Run by its founder", <>A message from the <A href="/contact">Book a demo</A> page goes to the founder by email.</>],
  ["What we are not", "We do not manufacture goods, and we are not a broker or buying agent."],
  ["The rules we work under", <>Our <A href="/legal/terms">terms</A> are governed by the laws of England and Wales. We follow UK GDPR for buyer accounts; our UK ICO registration is pending.</>],
  ["Where the data lives", <>In our Supabase database, AWS region us-west-1, in the United States. See <A href="/security">Security</A>.</>],
];

const HOW: [string, string][] = [
  ["Every fact shows its source.", "In words, with the date we read it."],
  ["Nothing fake.", "Real records or nothing. Examples are labelled as samples."],
  ["Gaps are shown as gaps.", "Locked, empty, out of date and sanctioned are normal states."],
  ["No scores, no paid placement.", "We never rate a supplier, and no one pays to rank higher."],
];

export function About({ facts }: { facts: SiteFacts }) {
  const latest = readDay(facts.latestRead);
  return (
    <main className="font-sans text-ink">
      <Hero label="Company · About" h1="Built for buyers who check." lede="We make every fact about a Bangladesh garment supplier checkable: the source, the number, the date." />

      <section aria-labelledby="where" className="bg-surface py-14 md:py-section">
        <div className={cn(measure, "flex flex-col gap-8")}>
          <div className="flex flex-col gap-2">
            <h2 id="where" className="text-site-body font-medium text-ink-subtle">
              Bangladesh only · where the suppliers are
            </h2>
            <p className="text-sm text-ink-3">Published suppliers by district · counted {DISTRICTS_READ}</p>
          </div>
          <dl className="grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {DISTRICTS.map(([place, n, what]) => (
              <div key={place} className="flex flex-col gap-1 border-t border-ink pt-3">
                <dt className="text-xl font-semibold text-ink">{place}</dt>
                <dd className="text-xl tabular-nums text-ink">{n}</dd>
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

      {/* How often the registers are read and how to report a wrong fact, in the methodology page's own words (critique 22 Oct, About). */}
      <Section label="Freshness and corrections" headline="How often we read, and how to correct us." tone="subtle">
        <dl className="grid max-w-[900px] gap-x-10 gap-y-6 md:grid-cols-2">
          <div className="flex flex-col gap-1 border-t border-ink pt-3">
            <dt className="text-lg font-semibold text-ink">How often we read</dt>
            <dd className="text-md text-ink-2">
              {FRESH}
              {latest ? ` The latest register read was ${latest}.` : ""}
            </dd>
          </div>
          <div className="flex flex-col gap-1 border-t border-ink pt-3">
            <dt className="text-lg font-semibold text-ink">A wrong fact</dt>
            <dd className="text-md text-ink-2">
              <Correction />
            </dd>
          </div>
        </dl>
      </Section>

      <Section label="The company" headline="Who runs SourceBD.">
        <dl className="grid max-w-[900px] gap-x-10 gap-y-6 md:grid-cols-2">
          {WHO.map(([t, b]) => (
            <div key={t} className="flex flex-col gap-1 border-t border-ink pt-3">
              <dt className="text-lg font-semibold text-ink">{t}</dt>
              <dd className="text-md text-ink-2">{b}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* The closing band every other page ends on (critique 22 Oct). */}
      <Closing headline="Check your first supplier today." lede="Free during beta. No card needed." />
    </main>
  );
}
