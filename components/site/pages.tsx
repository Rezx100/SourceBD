// The four product pages and the two solutions pages (Paper `30 Marketing · Product` and `Solutions`): one template,
// because Paper draws them as one: a label, a one-line promise, one way in (the search on the search page, Start free
// elsewhere), the product, then sections that each say one thing and show what proves it, and a close.
// M4 (15 Oct 2026): every page moved into the home's frame with the demos as its proof (`components/site/product/*.tsx`,
// which the routes draw); the words stay here. Since the 22 Oct critique no page shows a 3 Oct screenshot: each row's
// picture is a demo the page chooses.

import type { Metadata } from "next";
import type { ReactNode } from "react";

/** A section of a page: `n` finds it in the page's code, `label` is its name above the headline (never its number: critique 22 Oct, S13). */
export type Block = { n: string; label: string; headline: string; lede: string; extra?: ReactNode };
export type Page = {
  group: "Product" | "Solutions";
  name: string;
  /** The headline; `{n}` is the live supplier count when it was read. */
  h1: string;
  h1Plain: string;
  lede: string;
  title: string;
  description: string;
  blocks: Block[];
  outcome?: string;
  close: string;
};

const STATES: [string, string][] = [
  ["Expired", "with the date it ended"],
  ["Expires in N days", "with the date it ends"],
  ["Valid until", "with the date"],
  ["Listed as valid", "when the body publishes no date"],
];


export const PAGES: Record<string, Page> = {
  "product/search": {
    group: "Product",
    name: "Supplier search",
    h1: "Search {n} garment suppliers.",
    h1Plain: "Search Bangladesh garment suppliers.",
    lede: "Filter by HS code, certificate, place and size. Open any supplier beside your results.",
    title: "Supplier search — SourceBD",
    description: "Search Bangladesh garment suppliers by name, product or HS code. Filter by certificate, district and size, and open each record beside your results.",
    blocks: [
      { n: "01", label: "Filters", headline: "Filters that match how you buy.", lede: "HS code, certificate and its status, district, workers, brand supplier lists, BGMEA or BKMEA member. The button shows how many suppliers you will get." },
      { n: "02", label: "Records", headline: "The record opens beside your list.", lede: "Check certificates, safety and sources, then move to the next row. You never lose your search." },
      { n: "03", label: "Results", headline: "Every row says which to open.", lede: "What it makes, where it is, its workers, the certificate schemes it holds today and how many sources hold it. The dates are on the record, one click away." },
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
    blocks: [
      { n: "01", label: "Sources", headline: "Sources in words, not badges.", lede: "“From BGMEA · checked 24 Jul 2026.” When a fact has no source linked yet, we say so." },
      {
        n: "02",
        label: "Certificates",
        headline: "Four certificate states, each with a date.",
        lede: "Expired comes first. We never call a certificate “active”.",
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
            <p className="text-sm text-ink-3">Mondol Fabrics Ltd. · as read on 3 Oct 2026</p>
          </div>
        ),
      },
      { n: "04", label: "Safety", headline: "Safety inspections, as text.", lede: "RSC reports as figures with their date. Never a progress bar." },
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
    blocks: [
      { n: "01", label: "Quotes", headline: "Quotes side by side.", lede: "FOB per piece, MOQ, lead time and valid until. Suppliers that have not replied stay on the list." },
      { n: "02", label: "Messages", headline: "Replies in one thread per supplier.", lede: "Files, read receipts and the supplier’s record, one click away." },
      { n: "03", label: "Many at once", headline: "Write it once, send it to 50.", lede: "Product, quantity, target FOB, tech pack. Review every supplier before it goes. A supplier on the UFLPA Entity List can’t receive an RFQ." },
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
    blocks: [
      { n: "01", label: "Needs attention", headline: "Expired first, then expiring.", lede: "“Expires in 5 days · 8 Oct 2026.” One action on each: ask for the renewal." },
      { n: "02", label: "UFLPA", headline: "UFLPA screening, with the list and its date.", lede: "We check supplier names against the UFLPA Entity List. Three answers: on the list, possible Xinjiang link, no link found. “No link found” is not a clearance." },
      // The table is drawn from the live facts by the page (`product/compliance.tsx`); with none read, the lede says so instead.
      { n: "", label: "The lists", headline: "The lists we check, and when we read them.", lede: "Each list's entries and the day of its last full read, as the product holds them now." },
      { n: "03", label: "Modern slavery statement", headline: "A statement you confirm, line by line.", lede: "A draft built from your saved suppliers. Every claim we can’t confirm is marked “[Confirm: …]”. You can’t download until you confirm each one." },
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
    blocks: [
      { n: "01", label: "Find", headline: "Find factories that make your product.", lede: "Search by HS code, district and workers. Each row shows the certificate schemes a supplier holds today and how many sources name it." },
      { n: "02", label: "Check", headline: "Check them before you ask.", lede: "Certificates with dates, safety inspections, and the source of every fact. Save the ones that pass." },
      { n: "03", label: "Ask", headline: "Ask many at once.", lede: "One RFQ to up to 50 suppliers. Quotes come back side by side: FOB per piece, MOQ, lead time." },
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
    blocks: [
      { n: "01", label: "Certificates", headline: "Check certificates and their dates.", lede: "Number, issued by, valid until. Expired first. Each one links to the issuer’s own page." },
      { n: "02", label: "Screening", headline: "Screen against the UFLPA Entity List.", lede: "And five more sanctions and forced labour lists, each with the date we read it. “No link found” is not a clearance." },
      { n: "03", label: "Watch", headline: "Watch for expiry.", lede: "Expired and expiring certificates on your saved suppliers, with one action each: ask for the renewal." },
      { n: "04", label: "Statement", headline: "Draft the modern slavery statement.", lede: "Built from your saved suppliers. Every claim we can’t confirm stays marked until you confirm it." },
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
