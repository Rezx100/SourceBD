// The searches the landing offers before a buyer has typed anything
// (founder, 28 Sep 2026: "keep the search page super clean, with only filters
// and templates that users will use for their business").
//
// Each template is a real search: its state is what the results page parses
// from its URL, its count is what that search finds (read live, cached an
// hour), and its words describe only the filters it sets. Nothing here is a
// recommendation or a judgment about a supplier.

import { EMPTY_STATE, discoverHref, type DiscoverState } from "@/lib/discover-v32-state";
import { headingLabel } from "@/lib/search-suggest";

export type SearchTemplate = {
  key: string;
  title: string;
  /** One line: what the search sets, in words. */
  blurb: string;
  state: DiscoverState;
};

const at = (over: Partial<DiscoverState>): DiscoverState => ({ ...EMPTY_STATE, ...over });

export const SEARCH_TEMPLATES: readonly SearchTemplate[] = [
  {
    key: "gots-knit",
    title: "GOTS-certified knitwear",
    blurb: "T-shirts, knit shirts and pullovers from factories holding a valid GOTS certificate",
    state: at({ hs: ["6109", "6105", "6110"], cert: [{ kind: "gots", state: "valid" }] }),
  },
  {
    key: "wrap-woven-shirts",
    title: "Woven shirts, WRAP certified",
    blurb: "Men's shirts and women's blouses, with a valid WRAP certificate",
    state: at({ hs: ["6205", "6206"], cert: [{ kind: "wrap", state: "valid" }] }),
  },
  {
    key: "denim-trousers",
    title: "Trousers, jeans and suits",
    blurb: "Exporters of woven trousers, jeans and suits on the EPB list",
    state: at({ hs: ["6203", "6204"] }),
  },
  {
    key: "sweaters",
    title: "Sweaters and cardigans",
    blurb: "Exporters of jerseys, pullovers and cardigans on the EPB list",
    state: at({ hs: ["6110"] }),
  },
  {
    key: "babywear-oeko",
    title: "Babywear, OEKO-TEX certified",
    blurb: "Babies' garments, knit and woven, with a valid OEKO-TEX certificate",
    state: at({ hs: ["6111", "6209"], cert: [{ kind: "oeko_tex", state: "valid" }] }),
  },
  {
    key: "intimates",
    title: "Lingerie and intimates",
    blurb: "Bras, briefs, slips and nightwear exporters on the EPB list",
    state: at({ hs: ["6212", "6108", "6208"] }),
  },
  {
    key: "rsc-large",
    title: "Large factories on the RSC",
    blurb: "Factories with an active RSC safety record and at least 1,000 workers on the supplier record",
    state: at({ type: ["factory"], rsc: "active", workersMin: 1000 }),
  },
  {
    key: "uk-brands",
    title: "On UK retailers' supplier lists",
    blurb: "Named on the published supplier lists of NEXT, M&S, Primark or ASOS",
    state: at({ brand: ["BRAND_NEXT", "BRAND_MS", "BRAND_PRIMARK", "BRAND_ASOS"] }),
  },
  {
    key: "buying-houses-dhaka",
    title: "Buying houses in Dhaka",
    blurb: "Sourcing agents registered in Dhaka district",
    state: at({ type: ["buying_house"], district: ["Dhaka"] }),
  },
];

export function templateHref(t: SearchTemplate): string {
  return discoverHref(t.state);
}

/** One-click filters under the landing's field, each a search of its own. */
export type QuickFilter = { label: string; href: string; code?: string };

export const QUICK_FILTERS: readonly { group: string; items: readonly QuickFilter[] }[] = [
  {
    group: "Product",
    items: ["6109", "6205", "6110", "6203", "6204", "6111", "6115"].map((hs) => ({
      label: headingLabel(hs),
      code: hs,
      href: discoverHref(at({ hs: [hs] })),
    })),
  },
  {
    group: "Certificate",
    items: [
      { label: "GOTS", href: discoverHref(at({ cert: [{ kind: "gots", state: "valid" }] })) },
      { label: "WRAP", href: discoverHref(at({ cert: [{ kind: "wrap", state: "valid" }] })) },
      { label: "OEKO-TEX", href: discoverHref(at({ cert: [{ kind: "oeko_tex", state: "valid" }] })) },
      { label: "SA8000", href: discoverHref(at({ cert: [{ kind: "sa8000", state: "valid" }] })) },
      { label: "RSC active", href: discoverHref(at({ rsc: "active" })) },
    ],
  },
  {
    group: "Place",
    items: ["Dhaka", "Gazipur", "Narayanganj", "Chattogram"].map((d) => ({ label: d, href: discoverHref(at({ district: [d] })) })),
  },
  {
    group: "Company",
    items: [
      { label: "Factories", href: discoverHref(at({ type: ["factory"] })) },
      { label: "Buying houses", href: discoverHref(at({ type: ["buying_house"] })) },
    ],
  },
];
