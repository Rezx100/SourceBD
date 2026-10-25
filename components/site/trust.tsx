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
import { HomeMain } from "@/components/site/home-main";
import { Clip } from "@/components/site/sections/browser";
import { CloseActions, Finale } from "@/components/site/sections/close";
import { Band, FactCards, PageHead, tabular } from "@/components/site/sections/inner";
import { inkLink, secondary, TextLink } from "@/components/site/sections/ui";
import { SOURCE_COUNT, TIERS, type Tier } from "@/components/site/sources";
import { SUBPROCESSORS, subprocessorCount } from "@/components/site/subprocessors";
import { readDay, withCommas, type SiteFacts, type SourceFact } from "@/lib/site-facts";
import { SUPPLIER_CLIP } from "@/components/site/clips";

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
    <HomeMain className="font-sans antialiased">
      <PageHead label="Security" title="Security, stated plainly." lede="What we do today. No badges, no promises.">
        <CloseActions />
      </PageHead>

      <FactCards id="nine" tone="warm" heading="Nine answers for your security review" lede="Checked against our own runbooks on 5 Oct 2026." items={ANSWERS.map(([q, a]) => ({ title: q, body: a }))} />

      <Band id="details" tone="day" heading="Each answer, in one place.">
        <div className="grid gap-x-8 gap-y-10 md:grid-cols-2">
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
      </Band>

      <FactCards
        id="not-today"
        tone="day"
        heading="What we don't have yet."
        items={[
          { title: "No SOC 2 or ISO 27001 report", body: "We will not show a badge we have not earned." },
          { title: "No single sign-on yet", body: "Not in the product today." },
          { title: "UK ICO registration pending", body: <>The <A href="/legal/privacy">privacy notice</A> says so.</> },
        ]}
      />

      <Finale heading="Questions for your review? Ask us." />
    </HomeMain>
  );
}

/** A detail under the security answers: its name, then its words, in home's card type with a rule above. */
function Detail({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-t border-line pt-4">
      <h3 className="font-display text-site-card text-ink">{title}</h3>
      <div className="font-book text-site-card text-ink-2">{children}</div>
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
          {stale ? <span className="font-display text-ink"> · over 90 days ago</span> : null}
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
        <h3 className="font-display text-site-lead text-ink">
          Tier {tier.n} · {tier.label}
        </h3>
        <p className="max-w-[672px] font-book text-site-card text-ink-2">{tier.note}</p>
      </div>
      <div tabIndex={0} role="region" aria-label={`Tier ${tier.n} sources, scrolls sideways`} className={tabular}>
        <table>
          <caption className="sr-only">
            Tier {tier.n}, {tier.label}: each source{regs ? ", who keeps it" : " and what it gives us"}
            {read ? (regs ? ", its entries and when we last read it" : ", how many suppliers have a record from it and when we last read it") : ""}
          </caption>
          <thead>
            <tr>
              <th scope="col">{regs ? "List" : "Source"}</th>
              <th scope="col">{regs ? "Kept by" : "What it gives us"}</th>
              {read ? (
                <>
                  <th scope="col" className="text-right">{regs ? "Entries" : "Suppliers with a record"}</th>
                  <th scope="col">Last read</th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {tier.sources.map((s) => {
              const f = sourceFigures(facts, s.code);
              const figure = f ? (regs ? f.records : f.suppliers) : null;
              const stale = f?.latest ? now - Date.parse(f.latest) > NINETY_DAYS : false;
              const list = regs ? listCells(f, now) : null;
              return (
                <tr key={s.code}>
                  <th scope="row">
                    {s.name}
                    {regs ? null : <span className="block font-book text-ink-3">{s.full}</span>}
                  </th>
                  <td>{regs ? s.full : s.gives}</td>
                  {read && list ? (
                    <>
                      <td className="text-right tabular-nums text-ink">{list.entries}</td>
                      <td>{list.read}</td>
                    </>
                  ) : read ? (
                    <>
                      <td className="text-right tabular-nums text-ink">{f && f.records > 0 && figure !== null ? withCommas(figure) : <span className="text-ink-3">{f ? "Listed, no records yet" : "Not read yet"}</span>}</td>
                      <td>
                        {f && f.records > 0 && f.latest ? (
                          <>
                            {readDay(f.latest)}
                            {stale ? <span className="font-display text-ink"> · over 90 days ago</span> : null}
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
    <HomeMain className="font-sans antialiased">
      <PageHead label="Data & methodology" title="How we check every supplier." lede={sub}>
        <CloseActions />
      </PageHead>

      <FactCards
        id="tiers"
        tone="warm"
        heading="The source ladder. A higher tier is never overwritten by a lower one."
        items={TIERS.map((t) => ({ figure: `Tier ${t.n}`, title: `${t.label} · ${t.sources.length} ${t.n === 5 ? "lists" : "sources"}`, body: t.ladder }))}
      />

      <Band id="sources" tone="day" heading={`Every source, what it gives, and when we read it. All ${SOURCE_COUNT}.`} lede={facts.sources !== null ? "Counts are published suppliers with a record from that source. A date marked “over 90 days ago” was read more than 90 days ago." : "Every source we list, and what it gives us. The counts and dates appear here when the register has been read."}>
        <div className="flex flex-col gap-14">
          {TIERS.map((t) => (
            <TierTable key={t.key} tier={t} facts={facts} now={now} />
          ))}
          {facts.sources !== null && updated ? <p className="font-book text-site-item text-ink-2">From the sources table · latest read {updated}</p> : null}
        </div>
      </Band>

      <FactCards
        id="matching"
        tone="day"
        heading="Every fact carries the date we read it. One factory, one record."
        items={[
          { title: "How fresh", body: FRESH },
          ...MATCH.map((m, i) => ({ title: ["One number, one supplier", "Name and address, then a person", "Both sides when sources disagree"][i]!, body: m })),
        ]}
        cols={2}
      />

      <FactCards id="corrections" tone="day" heading="Spot a wrong fact? Tell us." items={[{ title: "Corrections", body: <Correction /> }]} cols={2}>
        <a href="mailto:data@sourcebd.net?subject=Correction" className={secondary}>
          Report a correction
        </a>
      </FactCards>

      <FactCards id="never" tone="night" heading="What we never do. Receipts, not opinions." items={NEVER.map((n, i) => ({ figure: String(i + 1).padStart(2, "0"), title: n, body: null }))} />

      <Finale heading="See the sources on a real record." />
    </HomeMain>
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

export function ForSuppliers() {
  return (
    <HomeMain className="font-sans antialiased">
      <PageHead
        label="For suppliers"
        title="Claim your factory's record."
        lede="Buyers in the UK, EU, US and Canada see it today. Check it, flag what is out of date, answer RFQs."
        picture={<Clip name={SUPPLIER_CLIP.file} says={SUPPLIER_CLIP.says} />}
      >
        <CloseActions primary={CLAIM} />
      </PageHead>

      <FactCards id="why" tone="warm" heading="Buyers already look you up." items={WHY.map(([t, b]) => ({ title: t, body: b }))} />

      <FactCards
        id="change"
        tone="day"
        heading="Your answers. Not your receipts."
        lede="Editing your own products is in design, not in the product yet."
        items={[
          { title: "You can", body: "Reply to buyers' RFQs and messages, and report a fact that is out of date." },
          { title: "Only the source can change", body: "Register facts, certificates, safety reports and sanctions. Ask the source to update it; we read it again." },
        ]}
        cols={2}
      />

      <FactCards id="steps" tone="day" heading="Three steps to claim your record." items={STEPS.map(([t, b], i) => ({ figure: String(i + 1), title: t, body: b }))}>
        <ButtonLink href={CLAIM[1]} prefetch={false} kind="primary" size="lg" className="h-10 rounded-full px-5 text-site-item">
          {CLAIM[0]}
        </ButtonLink>
      </FactCards>

      <Finale heading="Your record is already public. Claim it." primary={CLAIM} />
    </HomeMain>
  );
}

const CLAIM = ["Start your claim", "/signup?role=supplier"] as const;

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

const facts2 = (items: readonly (readonly [string, ReactNode])[]) => items.map(([title, body]) => ({ title, body }));

const HOW: [string, string][] = [
  ["Every fact shows its source.", "In words, with the date we read it."],
  ["Nothing fake.", "Real records or nothing. Examples are labelled as samples."],
  ["Gaps are shown as gaps.", "Locked, empty, out of date and sanctioned are normal states."],
  ["No scores, no paid placement.", "We never rate a supplier, and no one pays to rank higher."],
];

export function About({ facts }: { facts: SiteFacts }) {
  const latest = readDay(facts.latestRead);
  return (
    <HomeMain className="font-sans antialiased">
      <PageHead label="About" title="Built for buyers who check." lede="We make every fact about a Bangladesh garment supplier checkable: the source, the number, the date.">
        <CloseActions />
      </PageHead>

      <FactCards id="where" tone="warm" heading="Bangladesh only. Where the suppliers are." lede={`Published suppliers by district, counted ${DISTRICTS_READ}.`} items={DISTRICTS.map(([place, n, what]) => ({ figure: n, title: place, body: what }))} />

      <FactCards id="how" tone="day" heading="How we work. Receipts, not opinions." items={facts2(HOW)} cols={2}>
        <TextLink href="/methodology">Read the methodology</TextLink>
      </FactCards>

      {/* How often the registers are read and how to report a wrong fact, in the methodology page's own words (critique 22 Oct, About). */}
      <FactCards
        id="fresh"
        tone="day"
        heading="How often we read, and how to correct us."
        items={facts2([
          ["How often we read", `${FRESH}${latest ? ` The latest register read was ${latest}.` : ""}`],
          ["A wrong fact", <Correction key="correction" />],
        ])}
        cols={2}
      />

      <FactCards id="company" tone="day" heading="Who runs SourceBD." items={facts2(WHO)} cols={2} />

      <Finale heading="Check your first supplier today." />
    </HomeMain>
  );
}
