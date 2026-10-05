// The four product pages and the two solutions pages (Paper `30 Marketing · Product` and `Solutions`): one template,
// because Paper draws them as one: a label, a one-line promise, the search and the two calls to action, a real screen
// of the product, then numbered sections that each say one thing and show the screen that proves it, and a close.
// Every screen is a real v4 capture (`public/site/*.png`, taken 3 Oct 2026); the RFQ and quote screens hold sample
// figures and say so under the picture. The statement draft is not in the product yet and is marked that way.
// The figure and date in the hero come from the site's live facts and are left out when they were not read.

import Image from "next/image";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Close, Display, HeroActions, Label, Lede, Section, wrap } from "@/components/site/parts";
import { readDay, withCommas, type SiteFacts } from "@/lib/site-facts";
import { cn } from "@/lib/utils";

type Shot = { src: string; alt: string; caption: string };
type Block = { n: string; label: string; headline: string; lede: string; shot?: Shot; extra?: ReactNode; tag?: string };
type Page = {
  group: "Product" | "Solutions";
  name: string;
  /** The headline; `{n}` is the live supplier count when it was read. */
  h1: string;
  h1Plain: string;
  lede: string;
  title: string;
  description: string;
  hero: Shot;
  blocks: Block[];
  outcome?: string;
  close: string;
};

function Figure({ shot }: { shot: Shot }) {
  return (
    <figure className="flex flex-col gap-3">
      <Image src={shot.src} alt={shot.alt} width={1440} height={900} className="h-auto w-full rounded-lg border border-line shadow-dialog" />
      <figcaption className="font-mono text-sm text-ink-3">{shot.caption}</figcaption>
    </figure>
  );
}

const shot = (name: string, alt: string, caption: string): Shot => ({ src: `/site/${name}.png`, alt, caption });

const STATES: [string, string][] = [
  ["Expired", "with the date it ended"],
  ["Expires in N days", "with the date it ends"],
  ["Valid until", "with the date"],
  ["No expiry date published", "said as it is, never guessed"],
];

/** The lists the Compliance page screens against, as read on the days shown (captured 3 Oct 2026; the product shows today's). */
const LISTS: [string, string, string, string][] = [
  ["UFLPA Entity List", "US Department of Homeland Security", "160", "14 May 2026"],
  ["Specially Designated Nationals (SDN) list", "US Treasury, OFAC", "9,799", "27 Jun 2026"],
  ["Consolidated list of financial sanctions targets", "UK Treasury, OFSI", "1,286", "26 Jun 2026"],
  ["EU sanctions map", "European Union", "1,589", "26 Jun 2026"],
  ["Withhold Release Orders and Findings", "US Customs and Border Protection", "75", "30 Jul 2026"],
  ["List of Goods Produced by Child Labor or Forced Labor", "US Department of Labor, ILAB", "457", "26 Jun 2026"],
];

const InDesign = () => <p className="w-fit rounded-sm border border-dashed border-line-strong px-2 py-1 text-sm font-semibold text-ink-2">In design · not in the product yet</p>;

export const PAGES: Record<string, Page> = {
  "product/search": {
    group: "Product",
    name: "Supplier search",
    h1: "Search {n} garment suppliers.",
    h1Plain: "Search Bangladesh garment suppliers.",
    lede: "Filter by HS code, certificate, place and size. Open any supplier beside your results.",
    title: "Supplier search — SourceBD",
    description: "Search Bangladesh garment suppliers by name, product or HS code. Filter by certificate, district and size, and open each record beside your results.",
    hero: shot("search-results", "The results for “knit”: a list of suppliers, each with its type, district, first certificate problem and how many sources name it.", "Real screen · results for “knit” · 4,645 suppliers"),
    blocks: [
      { n: "01", label: "Filters", headline: "Filters that match how you buy.", lede: "HS code, certificate and its status, district, workers, brand supplier lists, BGMEA or BKMEA member. The button shows how many suppliers you will get.", shot: shot("search-filters", "The filter panel open over the results, showing the certificate, district and size filters.", "Real screen · knit, filters open · 4,645 suppliers") },
      { n: "02", label: "Records", headline: "The record opens beside your list.", lede: "Check certificates, safety and sources, then move to the next row. You never lose your search.", shot: shot("search-pane", "A supplier’s record open in a panel beside the results list.", "Real screen · Aboni Knitwear open beside the results") },
      { n: "03", label: "Results", headline: "Every row says what needs a look.", lede: "The first certificate problem shows in the list, with its date. Sources counts the lists that name the supplier." },
    ],
    close: "Try it on your next product.",
  },
  "product/records": {
    group: "Product",
    name: "Supplier records",
    h1: "Every fact, with its receipt.",
    h1Plain: "Every fact, with its receipt.",
    lede: "Each fact names its source and the date we checked it.",
    title: "Supplier records — SourceBD",
    description: "Every fact on a Bangladesh garment supplier names its source and the date we read it. Certificates with dates, safety inspections as text, and both numbers when sources disagree.",
    hero: shot("records-overview", "A supplier record: sanctions, certificates, safety, workers and sources at the top, then the key facts, each with where it came from.", "Real screen · Aboni Knitwear Ltd. · 11 sources"),
    blocks: [
      { n: "01", label: "Sources", headline: "Sources in words, not badges.", lede: "“From BGMEA · checked 24 Jul 2026.” When a fact has no source linked yet, we say so." },
      {
        n: "02",
        label: "Certificates",
        headline: "Four certificate states, each with a date.",
        lede: "Expired comes first. We never call a certificate “active”.",
        shot: shot("records-certs", "The certificates tab: four certificates, one expired, one expiring soon, one valid until a date and one with no expiry date published.", "Real screen · Aboni Knitwear Ltd. · certificates"),
        extra: (
          <dl className="grid max-w-[720px] gap-x-10 gap-y-3 sm:grid-cols-2">
            {STATES.map(([a, b]) => (
              <div key={a} className="flex flex-col gap-0.5 border-t border-ink pt-2">
                <dt className="text-base font-semibold text-ink">{a}</dt>
                <dd className="text-md text-ink-2">{b}</dd>
              </div>
            ))}
          </dl>
        ),
      },
      {
        n: "03",
        label: "Sources disagree",
        headline: "When sources disagree, you see both.",
        lede: "BGMEA lists 4,200 employees for Mondol Fabrics. RSC counted 2,060 workers in 2 buildings. We show both, with their dates.",
        extra: (
          <div className="flex max-w-[560px] flex-col gap-1 rounded-lg border border-line bg-subtle p-4">
            <p className="text-sm font-semibold text-ink">2 sources differ</p>
            <p className="text-base text-ink-2">RSC counted 2,060 workers in 2 buildings. BGMEA has 4,200 employees, as declared by the factory.</p>
            <p className="font-mono text-xs text-ink-3">Mondol Fabrics Ltd. · as read on 3 Oct 2026</p>
          </div>
        ),
      },
      { n: "04", label: "Safety", headline: "Safety inspections, as text.", lede: "RSC reports as figures with their date. Never a progress bar.", shot: shot("records-safety", "The safety tab: RSC inspections covered, 100% of initial items fixed, training completed, and links to the fire, electrical, structural and boiler reports.", "Real screen · Aboni Knitwear Ltd. · certificates and safety") },
      { n: "05", label: "Contacts", headline: "Contact details are locked.", lede: "You see what is on file. Send an RFQ and the supplier replies in SourceBD." },
    ],
    close: "Check one supplier now.",
  },
  "product/rfqs": {
    group: "Product",
    name: "RFQs and messages",
    h1: "One RFQ, up to 50 suppliers.",
    h1Plain: "One RFQ, up to 50 suppliers.",
    lede: "Send one request, compare quotes side by side, keep every reply in one place.",
    title: "RFQs and messages — SourceBD",
    description: "Send one RFQ to up to 50 Bangladesh suppliers, compare FOB, MOQ and lead time side by side, and keep every reply in one thread per supplier.",
    hero: shot("rfq-one", "The new RFQ form: the supplier, the product, quantity, target price, ship-by date and questions, with a preview of what the supplier receives.", "Real screen · RFQ to Aboni Knitwear Ltd., ready to send"),
    blocks: [
      { n: "01", label: "Quotes", headline: "Quotes side by side.", lede: "FOB per piece, MOQ, lead time and valid until. Suppliers that have not replied stay on the list.", shot: shot("rfq-quotes", "An RFQ with two quotes listed best first, each with price per piece, MOQ, lead time and valid-until date, and a third supplier that has not replied.", "Sample state · figures are examples; supplier names and the RFQ are real") },
      { n: "02", label: "Messages", headline: "Replies in one thread per supplier.", lede: "Files, read receipts and the supplier’s record, one click away.", shot: shot("rfq-thread", "A message thread with one supplier, with the supplier’s record beside it.", "Real screen · thread with Thermax Woven Dyeing") },
      { n: "03", label: "Many at once", headline: "Write it once, send it to 50.", lede: "Product, quantity, target FOB, tech pack. Review every supplier before it goes. A supplier on the UFLPA Entity List can’t receive an RFQ.", shot: shot("rfq-fifty", "The new RFQ form addressed to 50 suppliers, with a button to review all 50 before sending.", "Sample state · review all 50 suppliers before sending") },
    ],
    close: "Send your first RFQ today.",
  },
  "product/compliance": {
    group: "Product",
    name: "Compliance",
    h1: "Know before a certificate expires.",
    h1Plain: "Know before a certificate expires.",
    lede: "Watch your saved suppliers for expiry and Entity List changes, with the date of every check.",
    title: "Compliance — SourceBD",
    description: "Watch your saved Bangladesh suppliers for certificate expiry and UFLPA Entity List changes, with the date of every check. “No link found” is never a clearance.",
    hero: shot("comp-expiry", "The Compliance page listing certificates on saved suppliers, expired first, with a request for the renewal on each.", "Real screen · certificate expiry, expired first"),
    blocks: [
      { n: "01", label: "Needs attention", headline: "Expired first, then expiring.", lede: "“Expires in 5 days · 8 Oct 2026.” One action on each: ask for the renewal.", shot: shot("compliance-hub", "The Compliance page: certificates that need a look, expired first, with an ask for the new certificate on each.", "Real screen · needs attention, from your saved suppliers") },
      { n: "02", label: "UFLPA", headline: "UFLPA screening, with the list and its date.", lede: "We check supplier names against the UFLPA Entity List. Three answers: on the list, possible Xinjiang link, no link found. “No link found” is not a clearance.", shot: shot("comp-uflpa", "UFLPA checks on saved suppliers: how many are on the list, how many have a possible Xinjiang link, and how many have no link found, with each supplier’s result.", "Real screen · UFLPA checks on your saved suppliers") },
      {
        n: "",
        label: "The lists",
        headline: "The lists we check, and when we read them.",
        lede: "Entries and read dates as of 3 Oct 2026. The product shows the day each list was last read.",
        extra: (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <caption className="sr-only">The lists we check, who keeps them, how many entries and when we last read them</caption>
              <thead>
                <tr className="border-b border-ink text-sm text-ink-3">
                  <th scope="col" className="py-2 pr-4 font-medium">List</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Kept by</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">Entries</th>
                  <th scope="col" className="py-2 font-medium">Last read</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {LISTS.map(([l, by, n, d]) => (
                  <tr key={l} className="align-top text-md">
                    <th scope="row" className="py-3 pr-4 font-semibold text-ink">{l}</th>
                    <td className="py-3 pr-4 text-ink-2">{by}</td>
                    <td className="py-3 pr-4 text-right font-mono text-ink">{n}</td>
                    <td className="py-3 text-ink-2">{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ),
      },
      { n: "03", label: "Modern slavery statement", headline: "A statement you confirm, line by line.", lede: "A draft built from your saved suppliers. Every claim we can’t confirm is marked “[Confirm: …]”. You can’t download until you confirm each one.", tag: "design" },
    ],
    close: "Watch your saved suppliers.",
  },
  "solutions/sourcing": {
    group: "Solutions",
    name: "Sourcing teams",
    h1: "From search to RFQ in one sitting.",
    h1Plain: "From search to RFQ in one sitting.",
    lede: "For sourcing managers buying clothing from Bangladesh.",
    title: "For sourcing teams — SourceBD",
    description: "For sourcing managers buying clothing from Bangladesh: find factories by HS code and district, check certificates and safety, and send one RFQ to up to 50 suppliers.",
    hero: shot("saved-selected", "The Saved page with three suppliers picked, and the bar offering one RFQ to all three.", "Real screen · sample list, live facts · 3 suppliers chosen for one RFQ"),
    blocks: [
      { n: "01", label: "Find", headline: "Find factories that make your product.", lede: "Search by HS code, district and workers. Each row shows the first certificate problem and how many sources name the supplier.", shot: shot("search-filters", "The filter panel open over the results for “knit”.", "Real screen · knit, filters open · 4,645 suppliers") },
      { n: "02", label: "Check", headline: "Check them before you ask.", lede: "Certificates with dates, safety inspections, and the source of every fact. Save the ones that pass.", shot: shot("search-pane", "A supplier’s record open in a panel beside the results list.", "Real screen · Aboni Knitwear Ltd. open beside the results") },
      { n: "03", label: "Ask", headline: "Ask many at once.", lede: "One RFQ to up to 50 suppliers. Quotes come back side by side: FOB per piece, MOQ, lead time.", shot: shot("rfq-quotes", "An RFQ with two quotes listed best first, and a third supplier that has not replied.", "Sample state · figures are examples; supplier names and the RFQ are real") },
    ],
    outcome: "A shortlist your compliance team can check, source by source.",
    close: "Build your shortlist today.",
  },
  "solutions/compliance": {
    group: "Solutions",
    name: "Compliance teams",
    h1: "Show where every fact came from.",
    h1Plain: "Show where every fact came from.",
    lede: "For compliance and due diligence staff checking Bangladesh suppliers.",
    title: "For compliance teams — SourceBD",
    description: "For compliance and due diligence staff: certificates with dates, UFLPA and sanctions screening with the day each list was read, expiry watch, and the source of every fact.",
    hero: shot("compliance-hub", "The Compliance page: certificates that need a look, expired first, with an ask for the new certificate on each.", "Real screen · needs attention across your saved suppliers"),
    blocks: [
      { n: "01", label: "Certificates", headline: "Check certificates and their dates.", lede: "Number, issued by, valid until. Expired first. Each one links to the issuer’s own page.", shot: shot("records-certs", "The certificates tab: four certificates, one expired.", "Real screen · Aboni Knitwear Ltd. · 4 certificates, 1 expired") },
      { n: "02", label: "Screening", headline: "Screen against the UFLPA Entity List.", lede: "And five more sanctions and forced labour lists, each with the date we read it. “No link found” is not a clearance.", shot: shot("comp-uflpa", "UFLPA checks on saved suppliers, each with its result.", "Real screen · UFLPA checks on your saved suppliers") },
      { n: "03", label: "Watch", headline: "Watch for expiry.", lede: "Expired and expiring certificates on your saved suppliers, with one action each: ask for the renewal.", shot: shot("comp-expiry", "Certificates on saved suppliers, expired first, with a request for the renewal on each.", "Real screen · certificate expiry, expired first") },
      { n: "04", label: "Statement", headline: "Draft the modern slavery statement.", lede: "Built from your saved suppliers. Every claim we can’t confirm stays marked until you confirm it.", tag: "design" },
    ],
    outcome: "Evidence you can show an auditor: the source, the number, the date.",
    close: "Check your suppliers today.",
  },
};

export const siteMetadata = (key: string): Metadata | null => {
  const p = PAGES[key];
  if (!p) return null;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sourcebd.net";
  return { title: p.title, description: p.description, alternates: { canonical: `${site}/${key}` }, openGraph: { title: p.title, description: p.description, url: `${site}/${key}`, siteName: "SourceBD", locale: "en_GB", type: "website" } };
};

export function SitePage({ pageKey, facts }: { pageKey: string; facts: SiteFacts }) {
  const p = PAGES[pageKey]!;
  const count = facts.suppliers !== null ? withCommas(facts.suppliers) : null;
  const updated = readDay(facts.latestRead);
  const h1 = count ? p.h1.replace("{n}", count) : p.h1.includes("{n}") ? p.h1Plain : p.h1;
  return (
    <main className="font-sans text-ink">
      <section className="pb-20 pt-20 max-md:pb-10 max-md:pt-10">
        <div className={cn(wrap, "flex flex-col gap-10")}>
          <div className="flex flex-col gap-6">
            <Label>
              {p.group} · {p.name}
            </Label>
            <Display level={1} as="h1" className="max-w-[880px]">
              {h1}
            </Display>
            <Lede>{p.lede}</Lede>
            <HeroActions />
          </div>
          <Figure shot={p.hero} />
          {count ? (
            <p className="font-mono text-sm text-ink-3">
              {count} published suppliers{updated ? ` · updated ${updated}` : ""}
            </p>
          ) : null}
        </div>
      </section>

      {p.blocks.map((b, i) => (
        <Section key={b.headline} label={b.n ? `${b.n} · ${b.label}` : b.label} headline={b.headline} lede={b.lede} tone={i % 2 === 0 ? "subtle" : "plain"} className="py-20 max-md:py-12">
          {b.tag ? <InDesign /> : null}
          {b.shot ? <Figure shot={b.shot} /> : null}
          {b.extra}
        </Section>
      ))}

      {p.outcome ? (
        <section className="border-t border-line py-20 max-md:py-12">
          <div className={cn(wrap, "flex flex-col gap-4")}>
            <Label>The outcome</Label>
            <p className="max-w-[880px] text-3xl font-semibold tracking-tighter text-ink [text-wrap:balance] max-sm:text-2xl">{p.outcome}</p>
          </div>
        </section>
      ) : null}

      <Close headline={p.close} lede="Free during beta. No card needed." />
    </main>
  );
}
