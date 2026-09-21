// URL state for /app/discover (REZ-B, handoff §3.1). The query string is the
// search; back/forward restores it. Pure — no I/O — so a round-trip test can
// pin parse ↔ serialize without a database.

export const DISCOVER_PATH = "/app/discover";

export const PER_PAGE = [25, 50, 100] as const;
export type PerPage = (typeof PER_PAGE)[number];

export const SORTS = [
  { value: "sources", rpc: "receipts", label: "Most sources" },
  { value: "name", rpc: "name", label: "Name" },
  { value: "workers", rpc: "workers", label: "Workers" },
  { value: "established", rpc: "established", label: "Established" },
  { value: "cert_expiry", rpc: "cert_expiry", label: "Certificate expiry soonest" },
  { value: "hs_lines", rpc: "hs_lines", label: "HS lines" },
] as const;

export type DiscoverSort = (typeof SORTS)[number]["value"];

export const CERT_KINDS = ["gots", "wrap", "oeko_tex", "sa8000"] as const;
export type CertKind = (typeof CERT_KINDS)[number];
export type CertState = "valid" | "expiring" | "expired" | "any";

export const ENTITY_TYPES = ["factory", "buying_house"] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const REGISTRIES = ["BGMEA", "BKMEA", "BGAPMEA", "BTMA", "EPB", "RSC"] as const;
export type RegistryCode = (typeof REGISTRIES)[number];

export const BRAND_URL: Record<string, string> = {
  hm: "BRAND_HM",
  asos: "BRAND_ASOS",
  next: "BRAND_NEXT",
  ms: "BRAND_MS",
  inditex: "BRAND_INDITEX",
  primark: "BRAND_PRIMARK",
};

const BRAND_RPC_TO_URL: Record<string, string> = Object.fromEntries(
  Object.entries(BRAND_URL).map(([k, v]) => [v, k]),
);

export type CertFilter = { kind: CertKind; state: CertState };

export type DiscoverState = {
  q: string;
  hs: string[];
  cert: CertFilter[];
  reg: RegistryCode[];
  brand: string[];
  district: string[];
  city: string[];
  type: EntityType[];
  minSources: number | null;
  rsc: "active" | "lapsed" | null;
  estFrom: number | null;
  estTo: number | null;
  workersMin: number | null;
  workersMax: number | null;
  sort: DiscoverSort;
  page: number;
  per: PerPage;
  view: "cards" | "table";
  ask: boolean;
};

export const EMPTY_STATE: DiscoverState = {
  q: "",
  hs: [],
  cert: [],
  reg: [],
  brand: [],
  district: [],
  city: [],
  type: [],
  minSources: null,
  rsc: null,
  estFrom: null,
  estTo: null,
  workersMin: null,
  workersMax: null,
  sort: "sources",
  page: 1,
  per: 25,
  view: "cards",
  ask: false,
};

function one(sp: URLSearchParams, key: string): string {
  return (sp.get(key) ?? "").trim();
}

function csv(sp: URLSearchParams, key: string): string[] {
  const raw = one(sp, key);
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function intOrNull(raw: string, min: number, max: number): number | null {
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

const CERT_KIND_SET = new Set<string>(CERT_KINDS);
const CERT_STATE_SET = new Set<string>(["valid", "expiring", "expired", "any"]);
const TYPE_SET = new Set<string>(ENTITY_TYPES);
const REG_SET = new Set<string>(REGISTRIES);
const SORT_SET = new Set<string>(SORTS.map((s) => s.value));
const PER_SET = new Set<number>(PER_PAGE);

function parseCert(token: string): CertFilter | null {
  const [kindRaw, stateRaw] = token.split(":");
  const kind = (kindRaw ?? "").trim().toLowerCase().replace(/-/g, "_");
  if (!CERT_KIND_SET.has(kind)) return null;
  const state = (stateRaw ?? "any").trim().toLowerCase();
  if (!CERT_STATE_SET.has(state)) return null;
  return { kind: kind as CertKind, state: state as CertState };
}

function parseHs(token: string): string | null {
  const digits = token.replace(/\D/g, "").slice(0, 6);
  if (digits.length < 4) return null;
  return digits.slice(0, 4);
}

export function parseDiscoverState(
  input: URLSearchParams | Record<string, string | string[] | undefined>,
): DiscoverState {
  const sp =
    input instanceof URLSearchParams
      ? input
      : new URLSearchParams(
          Object.entries(input).flatMap(([k, v]) => {
            if (v === undefined) return [];
            return Array.isArray(v) ? v.map((x) => [k, x] as [string, string]) : [[k, v] as [string, string]];
          }),
        );

  const hs = [...new Set(csv(sp, "hs").map(parseHs).filter((x): x is string => x !== null))];
  const cert = csv(sp, "cert")
    .map(parseCert)
    .filter((x): x is CertFilter => x !== null);
  const reg = csv(sp, "reg").filter((x): x is RegistryCode => REG_SET.has(x));
  const brand = [
    ...new Set(
      csv(sp, "brand").map((b) => {
        const key = b.toLowerCase();
        if (BRAND_URL[key]) return BRAND_URL[key]!;
        const upper = b.toUpperCase();
        return BRAND_RPC_TO_URL[upper] ? upper : "";
      }),
    ),
  ].filter((b) => b.startsWith("BRAND_"));
  const type = csv(sp, "type").filter((x): x is EntityType => TYPE_SET.has(x));
  const sortRaw = one(sp, "sort");
  const sort = (SORT_SET.has(sortRaw) ? sortRaw : "sources") as DiscoverSort;
  const perRaw = intOrNull(one(sp, "per"), 1, 100);
  const per = (perRaw && PER_SET.has(perRaw) ? perRaw : 25) as PerPage;
  const rscRaw = one(sp, "rsc");
  const rsc = rscRaw === "active" || rscRaw === "lapsed" ? rscRaw : null;
  const viewRaw = one(sp, "view");

  return {
    q: one(sp, "q"),
    hs,
    cert,
    reg,
    brand,
    district: csv(sp, "district"),
    city: csv(sp, "city"),
    type,
    minSources: intOrNull(one(sp, "min_sources"), 1, 5),
    rsc,
    estFrom: intOrNull(one(sp, "est_from"), 1900, 2100),
    estTo: intOrNull(one(sp, "est_to"), 1900, 2100),
    workersMin: intOrNull(one(sp, "workers_min"), 1, 1_000_000),
    workersMax: intOrNull(one(sp, "workers_max"), 1, 1_000_000),
    sort,
    page: Math.max(1, intOrNull(one(sp, "page"), 1, 10_000) ?? 1),
    per,
    view: viewRaw === "table" ? "table" : "cards",
    ask: one(sp, "ask") === "1",
  };
}

function setCsv(sp: URLSearchParams, key: string, values: readonly string[]): void {
  if (values.length === 0) return;
  sp.set(key, values.join(","));
}

export function serializeDiscoverState(state: DiscoverState): URLSearchParams {
  const sp = new URLSearchParams();
  if (state.q) sp.set("q", state.q);
  setCsv(sp, "hs", state.hs);
  if (state.cert.length > 0) {
    sp.set(
      "cert",
      state.cert.map((c) => (c.state === "any" ? c.kind : `${c.kind}:${c.state}`)).join(","),
    );
  }
  setCsv(sp, "reg", state.reg);
  setCsv(
    sp,
    "brand",
    state.brand.map((b) => BRAND_RPC_TO_URL[b] ?? b.replace(/^BRAND_/i, "").toLowerCase()),
  );
  setCsv(sp, "district", state.district);
  setCsv(sp, "city", state.city);
  setCsv(sp, "type", state.type);
  if (state.minSources != null) sp.set("min_sources", String(state.minSources));
  if (state.rsc) sp.set("rsc", state.rsc);
  if (state.estFrom != null) sp.set("est_from", String(state.estFrom));
  if (state.estTo != null) sp.set("est_to", String(state.estTo));
  if (state.workersMin != null) sp.set("workers_min", String(state.workersMin));
  if (state.workersMax != null) sp.set("workers_max", String(state.workersMax));
  if (state.sort !== "sources") sp.set("sort", state.sort);
  if (state.page > 1) sp.set("page", String(state.page));
  if (state.per !== 25) sp.set("per", String(state.per));
  if (state.view === "table") sp.set("view", "table");
  if (state.ask) sp.set("ask", "1");
  return sp;
}

export function discoverHref(state: DiscoverState, over: Partial<DiscoverState> = {}): string {
  const next = { ...state, ...over };
  const qs = serializeDiscoverState(next).toString();
  return qs ? `${DISCOVER_PATH}?${qs}` : DISCOVER_PATH;
}

/** Query keys a GET form must keep as hidden inputs. Always drops `page`. */
export function discoverHiddenParams(
  state: DiscoverState,
  omit: readonly string[],
): [string, string][] {
  const sp = serializeDiscoverState(state);
  sp.delete("page");
  for (const key of omit) sp.delete(key);
  return [...sp.entries()];
}

export const COMPOSER_HIDDEN_OMIT = ["q"] as const;
export const FILTER_HIDDEN_OMIT = [
  "hs",
  "cert",
  "reg",
  "brand",
  "district",
  "city",
  "type",
  "min_sources",
  "rsc",
  "workers_min",
  "workers_max",
  "est_from",
  "est_to",
] as const;

export function sortRpc(sort: DiscoverSort): string {
  return SORTS.find((s) => s.value === sort)?.rpc ?? "receipts";
}

export function sortLabel(sort: DiscoverSort): string {
  return SORTS.find((s) => s.value === sort)?.label ?? "Most sources";
}

export function certKinds(state: DiscoverState): string[] | null {
  if (state.cert.length === 0) return null;
  return [...new Set(state.cert.map((c) => c.kind))];
}

export function certState(state: DiscoverState): CertState | null {
  if (state.cert.length === 0) return null;
  const states = new Set(state.cert.map((c) => c.state));
  if (states.size === 1) {
    const only = [...states][0]!;
    return only;
  }
  return "any";
}

export function filterCount(state: DiscoverState): number {
  return (
    (state.q ? 1 : 0) +
    (state.hs.length ? 1 : 0) +
    (state.cert.length ? 1 : 0) +
    (state.reg.length ? 1 : 0) +
    (state.brand.length ? 1 : 0) +
    (state.district.length ? 1 : 0) +
    (state.city.length ? 1 : 0) +
    (state.type.length ? 1 : 0) +
    (state.minSources != null ? 1 : 0) +
    (state.rsc ? 1 : 0) +
    (state.estFrom != null || state.estTo != null ? 1 : 0) +
    (state.workersMin != null || state.workersMax != null ? 1 : 0)
  );
}

const CERT_LABEL: Record<CertKind, string> = {
  gots: "GOTS",
  wrap: "WRAP",
  oeko_tex: "OEKO-TEX",
  sa8000: "SA8000",
};

const BRAND_LABEL: Record<string, string> = {
  BRAND_HM: "H&M",
  BRAND_ASOS: "ASOS",
  BRAND_NEXT: "NEXT",
  BRAND_MS: "M&S",
  BRAND_INDITEX: "Inditex",
  BRAND_PRIMARK: "Primark",
};

export type DiscoverChip = {
  key: string;
  label: string;
  code?: string | null;
  /** State with this chip removed. */
  without: DiscoverState;
};

export function discoverChips(state: DiscoverState): DiscoverChip[] {
  const chips: DiscoverChip[] = [];
  if (state.q) {
    chips.push({
      key: "q",
      label: state.q,
      without: { ...state, q: "", page: 1 },
    });
  }
  for (const hs of state.hs) {
    chips.push({
      key: `hs-${hs}`,
      label: `HS ${hs}`,
      code: hs,
      without: { ...state, hs: state.hs.filter((h) => h !== hs), page: 1 },
    });
  }
  for (const c of state.cert) {
    const name = CERT_LABEL[c.kind] ?? c.kind;
    chips.push({
      key: `cert-${c.kind}-${c.state}`,
      label: c.state === "any" ? `Certificate · ${name}` : `Certificate · ${name}, ${c.state}`,
      without: { ...state, cert: state.cert.filter((x) => x !== c), page: 1 },
    });
  }
  for (const r of state.reg) {
    chips.push({
      key: `reg-${r}`,
      label: r,
      without: { ...state, reg: state.reg.filter((x) => x !== r), page: 1 },
    });
  }
  for (const b of state.brand) {
    chips.push({
      key: `brand-${b}`,
      label: `Listed by ${BRAND_LABEL[b] ?? b}`,
      without: { ...state, brand: state.brand.filter((x) => x !== b), page: 1 },
    });
  }
  for (const d of state.district) {
    chips.push({
      key: `district-${d}`,
      label: d,
      without: { ...state, district: state.district.filter((x) => x !== d), page: 1 },
    });
  }
  for (const c of state.city) {
    chips.push({
      key: `city-${c}`,
      label: c,
      without: { ...state, city: state.city.filter((x) => x !== c), page: 1 },
    });
  }
  for (const t of state.type) {
    chips.push({
      key: `type-${t}`,
      label: t === "buying_house" ? "Buying house" : "Factory",
      without: { ...state, type: state.type.filter((x) => x !== t), page: 1 },
    });
  }
  if (state.minSources != null) {
    chips.push({
      key: "min_sources",
      label: `≥ ${state.minSources} sources`,
      without: { ...state, minSources: null, page: 1 },
    });
  }
  if (state.rsc) {
    chips.push({
      key: "rsc",
      label: state.rsc === "active" ? "RSC active" : "RSC lapsed",
      without: { ...state, rsc: null, page: 1 },
    });
  }
  if (state.estFrom != null || state.estTo != null) {
    chips.push({
      key: "est",
      label:
        state.estFrom != null && state.estTo != null
          ? `Est. ${state.estFrom}–${state.estTo}`
          : state.estFrom != null
            ? `Est. from ${state.estFrom}`
            : `Est. to ${state.estTo}`,
      without: { ...state, estFrom: null, estTo: null, page: 1 },
    });
  }
  if (state.workersMin != null || state.workersMax != null) {
    chips.push({
      key: "workers",
      label:
        state.workersMin != null && state.workersMax != null
          ? `${state.workersMin}–${state.workersMax} workers`
          : state.workersMin != null
            ? `≥ ${state.workersMin} workers`
            : `≤ ${state.workersMax} workers`,
      without: { ...state, workersMin: null, workersMax: null, page: 1 },
    });
  }
  return chips;
}

export function queryTitle(state: DiscoverState): string {
  const chips = discoverChips(state);
  if (chips.length === 0) return "All published suppliers";
  return chips.map((c) => c.label).join(" · ");
}

export type DiscoverRpcArgs = {
  p_q: string | null;
  p_entity_types: string[] | null;
  p_min_sources: number | null;
  p_cert_kinds: string[] | null;
  p_rsc_min: number | null;
  p_city: string | null;
  p_district: string | null;
  p_category: string | null;
  p_sort: string;
  p_limit: number;
  p_offset: number;
  p_registries: string[] | null;
  p_factory_types: string[] | null;
  p_brand_codes: string[] | null;
  p_completeness_min: number | null;
  p_workers_min: number | null;
  p_hs_codes: string[] | null;
  p_cert_state: string | null;
  p_rsc_state: string | null;
  p_est_from: number | null;
  p_est_to: number | null;
  p_workers_max: number | null;
  p_districts: string[] | null;
  p_cities: string[] | null;
  p_exclude_sanctioned: boolean;
};

export function discoverRpcArgs(
  state: DiscoverState,
  over: { limit?: number; offset?: number; rpcQ?: string | null } = {},
): DiscoverRpcArgs {
  const limit = over.limit ?? state.per;
  const offset = over.offset ?? (state.page - 1) * state.per;
  const kinds = certKinds(state);
  const stateFilter = certState(state);
  return {
    p_q: over.rpcQ !== undefined ? over.rpcQ : state.q || null,
    p_entity_types: state.type.length ? state.type : null,
    p_min_sources: state.minSources,
    p_cert_kinds: kinds,
    p_rsc_min: null,
    p_city: null,
    p_district: null,
    p_category: null,
    p_sort: sortRpc(state.sort),
    p_limit: Math.min(100, Math.max(1, limit)),
    p_offset: Math.max(0, offset),
    p_registries: state.reg.length ? [...state.reg] : null,
    p_factory_types: null,
    p_brand_codes: state.brand.length ? [...state.brand] : null,
    p_completeness_min: null,
    p_workers_min: state.workersMin,
    p_hs_codes: state.hs.length ? [...state.hs] : null,
    p_cert_state: stateFilter,
    p_rsc_state: state.rsc,
    p_est_from: state.estFrom,
    p_est_to: state.estTo,
    p_workers_max: state.workersMax,
    p_districts: state.district.length ? [...state.district] : null,
    p_cities: state.city.length ? [...state.city] : null,
    p_exclude_sanctioned: true,
  };
}
