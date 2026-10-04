// The filter pane's words and rules (B4b, Paper `10 · Filters panel open, live count` and
// `11 · Filters sheet`). The pane keeps its draft as a plain form; the URL stays the search:
// `searchOf` turns a draft into the same state the page parses from an address, so what the
// live count reads and what "Show N suppliers" opens are one thing. Pure, so the rules are
// tested without a browser.

import { formatCount } from "@/lib/dashboard/facts";
import { BRAND_URL, certState as sharedCertState, parseDiscoverState, serializeDiscoverState, type CertState, type DiscoverState } from "@/lib/discover-v32-state";

/** Paper's order: GOTS, OEKO-TEX, WRAP, SA8000. */
export const CERT_ORDER = ["gots", "oeko_tex", "wrap", "sa8000"] as const;
export const CERT_NAME: Record<(typeof CERT_ORDER)[number], string> = { gots: "GOTS", oeko_tex: "OEKO-TEX", wrap: "WRAP", sa8000: "SA8000" };
export const BRAND_NAME: Record<string, string> = { hm: "H&M", asos: "ASOS", next: "NEXT", ms: "M&S", inditex: "Inditex", primark: "Primark" };
export const DISTRICTS = ["Dhaka", "Gazipur", "Narayanganj", "Chattogram", "Savar", "Ashulia", "Tongi", "Mymensingh", "Comilla", "Narsingdi"];
export const TYPE_NAME = { factory: "Factory", buying_house: "Buying house" } as const;
/** `p_cert_state` is one value for every certificate (spec §4.1), so "expiring or expired" is not a choice the search can make. */
export const CERT_STATES: { value: CertState; label: string }[] = [
  { value: "any", label: "Any" },
  { value: "valid", label: "Valid" },
  { value: "expiring", label: "Expiring" },
  { value: "expired", label: "Expired" },
];

export type GroupId = "cert" | "place" | "type" | "hs" | "reg" | "brand" | "size" | "sources";

/** What the pane's fields hold now: strings and lists, as the fields give them. */
export type FilterForm = {
  cert: string[];
  certState: CertState;
  district: string[];
  city: string;
  type: string[];
  hs: string;
  reg: string[];
  brand: string[];
  workersMin: string;
  workersMax: string;
  estFrom: string;
  estTo: string;
  minSources: string;
  rsc: boolean;
  /** The URL said `rsc=lapsed`: the switch cannot show it, so it is kept until the buyer turns the switch on or clears everything. */
  rscLapsed: boolean;
  hideSanctioned: boolean;
};

export function formOf(state: DiscoverState): FilterForm {
  const brand = (serializeDiscoverState(state).get("brand") ?? "").split(",").filter(Boolean);
  return {
    cert: [...new Set(state.cert.map((c) => c.kind))],
    certState: sharedCertState(state) ?? "any",
    district: state.district,
    city: state.city.join(", "),
    type: state.type,
    hs: state.hs.join(", "),
    reg: state.reg,
    brand,
    workersMin: state.workersMin == null ? "" : String(state.workersMin),
    workersMax: state.workersMax == null ? "" : String(state.workersMax),
    estFrom: state.estFrom == null ? "" : String(state.estFrom),
    estTo: state.estTo == null ? "" : String(state.estTo),
    minSources: state.minSources == null ? "" : String(state.minSources),
    rsc: state.rsc === "active",
    rscLapsed: state.rsc === "lapsed",
    hideSanctioned: !state.sanctioned,
  };
}

/** Clear all: every filter off, the standing one back on. The query, the sort and the page size are not filters. */
export function clearedForm(): FilterForm {
  return {
    cert: [],
    certState: "any",
    district: [],
    city: "",
    type: [],
    hs: "",
    reg: [],
    brand: [],
    workersMin: "",
    workersMax: "",
    estFrom: "",
    estTo: "",
    minSources: "",
    rsc: false,
    rscLapsed: false,
    hideSanctioned: true,
  };
}

/** The draft as the address the page would parse: the query and the sort stay, the page goes back to the first. */
export function searchOf(base: DiscoverState, f: FilterForm): DiscoverState {
  const sp = new URLSearchParams();
  if (base.q) sp.set("q", base.q);
  if (base.sort !== "sources") sp.set("sort", base.sort);
  if (base.per !== 25) sp.set("per", String(base.per));
  if (base.ask) sp.set("ask", "1");
  const certs = CERT_ORDER.filter((k) => f.cert.includes(k));
  // A status without a certificate has nothing to apply to.
  if (certs.length) sp.set("cert", certs.map((k) => (f.certState === "any" ? k : `${k}:${f.certState}`)).join(","));
  if (f.district.length) sp.set("district", f.district.join(","));
  if (f.city.trim()) sp.set("city", f.city);
  if (f.type.length) sp.set("type", f.type.join(","));
  if (f.hs.trim()) sp.set("hs", f.hs);
  if (f.reg.length) sp.set("reg", f.reg.join(","));
  if (f.brand.length) sp.set("brand", f.brand.join(","));
  if (f.workersMin.trim()) sp.set("workers_min", f.workersMin);
  if (f.workersMax.trim()) sp.set("workers_max", f.workersMax);
  if (f.estFrom.trim()) sp.set("est_from", f.estFrom);
  if (f.estTo.trim()) sp.set("est_to", f.estTo);
  if (f.minSources) sp.set("min_sources", f.minSources);
  if (f.rsc) sp.set("rsc", "active");
  else if (f.rscLapsed) sp.set("rsc", "lapsed");
  if (!f.hideSanctioned) sp.set("sanctioned", "1");
  return parseDiscoverState(sp);
}

/** What the search is, for comparing two drafts: the sort and the page do not change a count. */
export function countKey(state: DiscoverState): string {
  const sp = serializeDiscoverState({ ...state, sort: "sources", page: 1 });
  sp.sort();
  return sp.toString();
}

/** "Show 71 suppliers"; no number when the count could not be read. */
export function showLabel(count: number | null): string {
  if (count === null) return "Show suppliers";
  return `Show ${formatCount(count)} ${count === 1 ? "supplier" : "suppliers"}`;
}

const list = (xs: string[]) => xs.join(", ");

/** "500–2,000", "500 or more", "up to 2,000": a range as a buyer says it. */
function range(min: string, max: string, from = (v: string) => `${v} or more`): string | null {
  const a = min.trim();
  const b = max.trim();
  if (a && b) return `${a}–${b}`;
  if (a) return from(a);
  if (b) return `up to ${b}`;
  return null;
}

/** The second line of a row on a phone, and the words of a chip: what the group holds, null when it holds nothing. */
export function summaryOf(f: FilterForm, id: GroupId): string | null {
  switch (id) {
    case "cert": {
      const names = CERT_ORDER.filter((k) => f.cert.includes(k)).map((k) => CERT_NAME[k]);
      if (names.length === 0) return null;
      return f.certState === "any" ? list(names) : `${list(names)} · ${f.certState}`;
    }
    case "place": {
      const parts = [...f.district, ...f.city.split(",").map((c) => c.trim()).filter(Boolean)];
      return parts.length ? list(parts) : null;
    }
    case "type":
      return f.type.length ? list(f.type.map((t) => TYPE_NAME[t as keyof typeof TYPE_NAME] ?? t)) : null;
    case "hs": {
      const codes = f.hs.split(",").map((c) => c.trim()).filter(Boolean);
      return codes.length ? list(codes.map((c) => `HS ${c}`)) : null;
    }
    case "reg":
      return f.reg.length ? list(f.reg) : null;
    case "brand":
      return f.brand.length ? list(f.brand.map((b) => BRAND_NAME[b] ?? b.toUpperCase())) : null;
    case "size": {
      const w = range(f.workersMin, f.workersMax);
      const e = range(f.estFrom, f.estTo, (v) => `from ${v}`);
      return [w ? `${w} workers` : null, e ? `founded ${e}` : null].filter(Boolean).join(" · ") || null;
    }
    case "sources":
      return f.minSources ? `At least ${f.minSources}` : null;
  }
}

/** Which groups hold a filter in the address now: the ones the pane opens at desktop width. */
export function groupsSet(state: DiscoverState): GroupId[] {
  const f = formOf(state);
  return (["cert", "place", "type", "hs", "reg", "brand", "size", "sources"] as const).filter((id) => summaryOf(f, id) !== null);
}

export type AppliedChip = { key: string; label: string; without: DiscoverState };

/**
 * The filters that are on, one chip each with its ×: Paper's "Certificate: GOTS",
 * "Location: Gazipur". The standing filter (sanctioned hidden) and the query are not chips here.
 */
export function appliedChips(state: DiscoverState): AppliedChip[] {
  const f = formOf(state);
  const off = (over: Partial<DiscoverState>): DiscoverState => ({ ...state, ...over, page: 1 });
  const chips: AppliedChip[] = [];
  const cert = summaryOf(f, "cert");
  if (cert) chips.push({ key: "cert", label: `Certificate: ${cert}`, without: off({ cert: [] }) });
  const place = summaryOf(f, "place");
  if (place) chips.push({ key: "place", label: `Location: ${place}`, without: off({ district: [], city: [] }) });
  const type = summaryOf(f, "type");
  if (type) chips.push({ key: "type", label: `Company type: ${type}`, without: off({ type: [] }) });
  const hs = summaryOf(f, "hs");
  if (hs) chips.push({ key: "hs", label: `Product: ${hs}`, without: off({ hs: [] }) });
  const reg = summaryOf(f, "reg");
  if (reg) chips.push({ key: "reg", label: `Member of: ${reg}`, without: off({ reg: [] }) });
  const brand = summaryOf(f, "brand");
  if (brand) chips.push({ key: "brand", label: `Brand list: ${brand}`, without: off({ brand: [] }) });
  const workers = range(f.workersMin, f.workersMax);
  if (workers) chips.push({ key: "workers", label: `Workers: ${workers}`, without: off({ workersMin: null, workersMax: null }) });
  const est = range(f.estFrom, f.estTo, (v) => `from ${v}`);
  if (est) chips.push({ key: "est", label: `Founded: ${est}`, without: off({ estFrom: null, estTo: null }) });
  if (state.minSources != null) chips.push({ key: "sources", label: `Sources: at least ${state.minSources}`, without: off({ minSources: null }) });
  if (state.rsc) chips.push({ key: "rsc", label: state.rsc === "active" ? "RSC safety programme" : "RSC lapsed", without: off({ rsc: null }) });
  return chips;
}

/** The brand keys the form offers, in the address's own order. */
export const BRAND_KEYS = Object.keys(BRAND_URL);
