// The site map v4 as data (Paper `30 Marketing · Global`): the navigation's menus and the mega footer's columns,
// one list so the two cannot drift. Every address here is a page of the site; a page that is not built yet is not
// linked (the footer says nothing about it), so no link on the site goes nowhere.

export type NavItem = { title: string; body?: string; href: string };

export const PRODUCT: readonly NavItem[] = [
  { title: "Supplier search", body: "Filter by HS code, certificate, place and size.", href: "/product/search" },
  { title: "Supplier records", body: "Every fact with its source and date.", href: "/product/records" },
  { title: "RFQs and messages", body: "Send one RFQ to up to 50 suppliers.", href: "/product/rfqs" },
  { title: "Compliance", body: "Expiry alerts and Entity List checks.", href: "/product/compliance" },
];

/** The Product menu on a wide screen (Paper "Home · Nav · Product menu open"): four groups, each a route of the app.
 * The board's "Supplier records" (/app/suppliers) has no index page, a record opens from a search, so it is not listed. */
export const PRODUCT_GROUPS: readonly { title: string; icon: "search" | "receipt" | "send" | "bell"; items: readonly NavItem[] }[] = [
  { title: "Find", icon: "search", items: [{ title: "Search", href: "/app" }, { title: "Saved suppliers", href: "/app/saved" }, { title: "Saved searches", href: "/app/searches" }, { title: "HS headings", href: "/app/headings" }] },
  { title: "Check", icon: "receipt", items: [{ title: "Compliance hub", href: "/app/compliance" }, { title: "UFLPA checks", href: "/app/compliance/uflpa" }, { title: "Expiry dates", href: "/app/compliance/expiry" }, { title: "Modern slavery statement", href: "/app/compliance/msa" }] },
  { title: "Ask", icon: "send", items: [{ title: "RFQs and quotes", href: "/app/rfqs" }, { title: "Messages", href: "/app/messages" }, { title: "Orders", href: "/app/orders" }, { title: "Your products", href: "/app/products" }] },
  { title: "Watch", icon: "bell", items: [{ title: "Alerts and notifications", href: "/app/settings/notifications" }, { title: "Team and roles", href: "/app/settings/members" }, { title: "Methodology", href: "/methodology" }, { title: "Data status", href: "/status" }] },
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

export const FOOTER: readonly { title: string; links: readonly { label: string; href: string }[] }[] = [
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
      { label: "Contact sales", href: "/contact" },
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

export const PROMISE = "No scores. No paid placement. No fact without a source and a date.";
export const STRAPLINE = "Every fact on a Bangladesh garment supplier, with its source and date.";
