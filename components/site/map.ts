// The site map v4 as data (Paper `30 Marketing · Global`): the navigation's menus and the mega footer's columns,
// one list so the two cannot drift. Every address here is a page of the site; a page that is not built yet is not
// linked (the footer says nothing about it), so no link on the site goes nowhere.

export type NavItem = { title: string; body?: string; href: string; icon?: "search" | "receipt" | "send" | "bell" };

export const PRODUCT: readonly NavItem[] = [
  { title: "Supplier search", body: "Filter by HS code, certificate, place and size.", href: "/product/search", icon: "search" },
  { title: "Supplier records", body: "Every fact with its source and date.", href: "/product/records", icon: "receipt" },
  { title: "RFQs and messages", body: "Send one RFQ to up to 50 suppliers.", href: "/product/rfqs", icon: "send" },
  { title: "Compliance", body: "Expiry alerts and Entity List checks.", href: "/product/compliance", icon: "bell" },
];

export const SOLUTIONS: readonly NavItem[] = [
  { title: "Sourcing teams", href: "/solutions/sourcing" },
  { title: "Compliance teams", href: "/solutions/compliance" },
];

export const RESOURCES: readonly NavItem[] = [
  { title: "Data & methodology", href: "/methodology" },
  { title: "Compliance guides", href: "/compliance" },
  { title: "Security", href: "/security" },
  { title: "For suppliers", href: "/suppliers" },
  { title: "System status", href: "/status" },
];

// The desktop menus' panels, laid out as mercury.com's mega menu (founder, 24 Oct 2026): a lead column, a column per
// page with the pages it leads to under a small label, and a row for suppliers under them all. Every word is the
// site's own (the pages' heroes and the footer); a panel holds at least every item of its menu, which the phone
// sheet lists alone (`page.test.ts`).
type PanelLink = { title: string; body?: string; href: string };
export type MenuPanel = {
  lead: { title: string; body: string; links: readonly PanelLink[] };
  columns: readonly (PanelLink & { body: string; label: string; links: readonly PanelLink[] })[];
};

export const PROMISE = "No scores. No paid placement. No fact without a source and a date.";
export const STRAPLINE = "Every fact on a Bangladesh garment supplier, with its source and date.";

const PRICING = { title: "Pricing", body: "Free during beta. No card needed.", href: "/pricing" };
const METHOD = { title: "Data & methodology", body: "How we check every supplier.", href: "/methodology" };
const [SEARCH, RECORDS, RFQS, COMPLIANCE] = PRODUCT;
const [SOURCING_TEAMS, COMPLIANCE_TEAMS] = SOLUTIONS;

export const PANELS: Record<"product" | "solutions" | "resources", MenuPanel> = {
  product: {
    lead: { title: "Product", body: STRAPLINE, links: [PRICING, METHOD] },
    // Which team uses each, as the two solutions pages say (Find, Check, Ask; Certificates, Screening, Watch, Statement).
    columns: [
      { ...SEARCH!, body: SEARCH!.body!, label: "Solutions", links: [SOURCING_TEAMS!] },
      { ...RECORDS!, body: RECORDS!.body!, label: "Solutions", links: [SOURCING_TEAMS!, COMPLIANCE_TEAMS!] },
      { ...RFQS!, body: RFQS!.body!, label: "Solutions", links: [SOURCING_TEAMS!] },
      { ...COMPLIANCE!, body: COMPLIANCE!.body!, label: "Solutions", links: [COMPLIANCE_TEAMS!] },
    ],
  },
  solutions: {
    lead: { title: "Solutions", body: "Built for buyers who check.", links: [PRICING, METHOD] },
    columns: [
      { ...SOURCING_TEAMS!, body: "For sourcing managers buying clothing from Bangladesh.", label: "Product", links: [SEARCH!, RECORDS!, RFQS!] },
      { ...COMPLIANCE_TEAMS!, body: "For compliance and due diligence staff checking Bangladesh suppliers.", label: "Product", links: [RECORDS!, COMPLIANCE!] },
    ],
  },
  resources: {
    lead: {
      title: "Resources",
      body: PROMISE,
      links: [
        { title: "Security", body: "What we do today. No badges, no promises.", href: "/security" },
        { title: "System status", body: "When we last read each source.", href: "/status" },
      ],
    },
    columns: [
      {
        ...METHOD,
        label: "Sections",
        links: [
          { title: "The sources", href: "/methodology#sources" },
          { title: "Source tiers", href: "/methodology#tiers" },
          { title: "How we match names", href: "/methodology#matching" },
          { title: "Report a correction", href: "/methodology#corrections" },
        ],
      },
      {
        title: "Compliance guides",
        body: "Five laws a buyer of Bangladesh clothing meets, each with its sources and the date we last reviewed it.",
        href: "/compliance",
        label: "Guides",
        links: [
          { title: "UFLPA", href: "/compliance/uflpa" },
          { title: "UK Modern Slavery Act", href: "/compliance/uk-msa" },
          { title: "EU CSDDD", href: "/compliance/eu-csddd" },
          { title: "EU CBAM", href: "/compliance/eu-cbam" },
          { title: "EU EUDR", href: "/compliance/eu-eudr" },
        ],
      },
    ],
  },
};

/** The row under every panel: the suppliers' own page, as its hero says it. */
export const SUPPLIER_ROW = { title: "For suppliers", body: "Claim your factory's record. Buyers in the UK, EU, US and Canada see it today.", href: "/suppliers" };

export const FOOTER:readonly { title: string; links: readonly { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Supplier search", href: "/product/search" },
      { label: "Supplier records", href: "/product/records" },
      { label: "RFQs and messages", href: "/product/rfqs" },
      { label: "Compliance", href: "/product/compliance" },
      { label: "Pricing", href: "/pricing" },
      { label: "For suppliers", href: "/suppliers" },
    ],
  },
  {
    title: "Data & methodology",
    links: [
      { label: "How we check", href: "/methodology" },
      { label: "The sources", href: "/methodology#sources" },
      { label: "Source tiers", href: "/methodology#tiers" },
      { label: "How we match names", href: "/methodology#matching" },
      { label: "Report a correction", href: "/methodology#corrections" },
    ],
  },
  {
    title: "Compliance guides",
    links: [
      { label: "UFLPA", href: "/compliance/uflpa" },
      { label: "UK Modern Slavery Act", href: "/compliance/uk-msa" },
      { label: "EU CSDDD", href: "/compliance/eu-csddd" },
      { label: "EU CBAM", href: "/compliance/eu-cbam" },
      { label: "EU EUDR", href: "/compliance/eu-eudr" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Book a demo", href: "/contact" },
      { label: "Security", href: "/security" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/legal/privacy" },
      { label: "Terms", href: "/legal/terms" },
      { label: "Cookies", href: "/legal/cookies" },
      { label: "Data sources", href: "/legal/data-sources" },
      { label: "Trademarks", href: "/legal/trademarks" },
    ],
  },
  { title: "Status", links: [{ label: "System status", href: "/status" }] },
];
