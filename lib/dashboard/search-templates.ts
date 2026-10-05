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

/**
 * The filter menus: one row of them under the landing's field and over the
 * results (founder's pick "A", 29 Sep 2026: "precise and noise-free"). Each
 * option toggles one value on a search; a menu with a value set shows it on
 * its own button. A value set some other way (the typeahead, the filter
 * pane) joins its menu's list, so it can always be taken off there.
 */
export type FilterOption = { key: string; label: string; code?: string; on: boolean; toggled: DiscoverState };
export type FilterMenu = { key: string; label: string; options: FilterOption[] };

const HS_OFFERED = ["6109", "6205", "6110", "6203", "6204", "6111", "6115"];
const PLACES_OFFERED = ["Dhaka", "Gazipur", "Narayanganj", "Chattogram"];
const CERTS_OFFERED = [
  { kind: "gots", label: "GOTS" },
  { kind: "wrap", label: "WRAP" },
  { kind: "oeko_tex", label: "OEKO-TEX" },
  { kind: "sa8000", label: "SA8000" },
] as const;

const toggle = <T,>(list: readonly T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
const fresh = (s: DiscoverState, over: Partial<DiscoverState>): DiscoverState => ({ ...s, ...over, page: 1 });

export function filterMenus(s: DiscoverState): FilterMenu[] {
  const hs = [...HS_OFFERED, ...s.hs.filter((h) => !HS_OFFERED.includes(h))];
  const places = [...PLACES_OFFERED, ...s.district.filter((d) => !PLACES_OFFERED.includes(d))];
  return [
    {
      key: "product",
      label: "Product",
      options: hs.map((h) => ({ key: `hs-${h}`, label: headingLabel(h), code: h, on: s.hs.includes(h), toggled: fresh(s, { hs: toggle(s.hs, h) }) })),
    },
    {
      key: "certificate",
      label: "Certificate",
      options: CERTS_OFFERED.map((c) => {
        const on = s.cert.some((x) => x.kind === c.kind);
        return {
          key: `cert-${c.kind}`,
          label: c.label,
          on,
          toggled: fresh(s, { cert: on ? s.cert.filter((x) => x.kind !== c.kind) : [...s.cert, { kind: c.kind, state: "valid" }] }),
        };
      }),
    },
    {
      key: "place",
      label: "Place",
      options: places.map((d) => ({ key: `district-${d}`, label: d, on: s.district.includes(d), toggled: fresh(s, { district: toggle(s.district, d) }) })),
    },
    {
      key: "type",
      label: "Company type",
      options: [
        { key: "type-factory", label: "Factories", on: s.type.includes("factory"), toggled: fresh(s, { type: toggle(s.type, "factory") }) },
        { key: "type-buying_house", label: "Buying houses", on: s.type.includes("buying_house"), toggled: fresh(s, { type: toggle(s.type, "buying_house") }) },
      ],
    },
    {
      key: "more",
      label: "More",
      options: [{ key: "rsc", label: "RSC safety record active", on: s.rsc === "active", toggled: fresh(s, { rsc: s.rsc === "active" ? null : "active" }) }],
    },
  ];
}

/** The chips a menu already shows: kept off the chip bar so a filter is drawn once. */
export function inFilterMenu(chipKey: string, s: DiscoverState): boolean {
  if (chipKey === "rsc") return s.rsc === "active";
  // A certificate in another state (expiring, expired) keeps its chip: the
  // menu's "GOTS" would not say which.
  return /^(hs|district|type)-/.test(chipKey) || /^cert-[a-z0-9_]+-valid$/.test(chipKey);
}

/** The words a menu's button carries when values are set: the one value, or how many. */
export function menuSummary(menu: FilterMenu): string | null {
  const on = menu.options.filter((o) => o.on);
  if (on.length === 0) return null;
  return on.length === 1 ? on[0]!.label : `${on.length} selected`;
}
