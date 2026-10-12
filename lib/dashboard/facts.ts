// Fact formatting for the dashboard kit (REZ-A): certificate states, dates,
// counts, names. Pure functions — every rendered value on a card, table row or
// sheet passes through here, so the boundary tests can pin the words.

import { publicPage } from "./source-tiers";

export type CertState = "valid" | "expiring" | "expired";

export type CertModel = {
  kind: string;
  /** Scheme as a buyer reads it: `GOTS`, `WRAP Gold`, `OEKO-TEX Standard 100`. */
  scheme: string;
  number: string | null;
  issuer: string | null;
  scope: string | null;
  expiresOn: string | null;
  state: CertState;
  /** Whole days until expiry (negative when past); null without a date. */
  daysLeft: number | null;
  documentUrl: string | null;
  /** The mark code for the issuer's rank square. */
  markCode: string;
};

const DAY = 86_400_000;
const EXPIRING_WITHIN_DAYS = 90;

/** UTC midnight of an ISO date or timestamp; null when unparsable. */
export function dayOf(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor(t / DAY) * DAY;
}

/** Whole days from `today` to `iso` (negative when `iso` is in the past). */
export function daysUntil(iso: string | null | undefined, today: Date): number | null {
  const d = dayOf(iso);
  const t = dayOf(today.toISOString());
  if (d === null || t === null) return null;
  return Math.round((d - t) / DAY);
}

/**
 * valid · expiring (≤ 90 days) · expired. An undated certificate is one its body lists without a
 * date (every OEKO-TEX row: the label check publishes none), so while it is listed it is valid; a
 * delisted one is caught by its listing status, never by a date.
 */
export function certState(expiresOn: string | null | undefined, today: Date): CertState {
  const days = daysUntil(expiresOn, today);
  if (days === null) return "valid";
  if (days < 0) return "expired";
  if (days <= EXPIRING_WITHIN_DAYS) return "expiring";
  return "valid";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `2027-05-12` → `12 May 2027`. Null in, null out. */
export function formatDay(iso: string | null | undefined): string | null {
  const d = dayOf(iso);
  if (d === null) return null;
  const date = new Date(d);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/**
 * A day as a buyer types it, to `YYYY-MM-DD`: "15 Nov 2026", "15 November 2026", "15/11/2026",
 * "15.11.2026", "2026-11-15". Null when it is not a real day. Day first, never month first: the
 * app's buyers write 15/11, and the browser's own date box showed them "10/15/2026".
 */
export function parseDay(text: string): string | null {
  const s = text.trim();
  let y = 0, m = 0, d = 0;
  let r: RegExpExecArray | null;
  if ((r = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s))) [y, m, d] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else if ((r = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s))) [d, m, y] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else if ((r = /^(\d{1,2})\s+([a-z]{3,})\.?,?\s+(\d{4})$/i.exec(s))) {
    const word = r[2]!.toLowerCase();
    const i = MONTHS.findIndex((n) => word.startsWith(n.toLowerCase()));
    if (i < 0) return null;
    [d, m, y] = [Number(r[1]), i + 1, Number(r[3])];
  } else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

/**
 * The span a set of reads covers: `18 May – 18 Sep 2026`, or one date when
 * they all fall on the same day. Shared by the topbar and the sheet header so
 * the two cannot drift; both used to print a maximum, which said nothing
 * about the oldest read behind the figure beside it.
 */
export function formatDayRange(oldestIso: string | null | undefined, newestIso: string | null | undefined): string | null {
  const a = formatDay(oldestIso);
  const b = formatDay(newestIso);
  if (a === null || b === null) return a ?? b;
  if (a === b) return a;
  const year = a.slice(a.lastIndexOf(" ") + 1);
  return `${year === b.slice(b.lastIndexOf(" ") + 1) ? a.slice(0, a.lastIndexOf(" ")) : a} – ${b}`;
}

/** `2027-05-12` → `May 2027`. */
export function formatMonth(iso: string | null | undefined): string | null {
  const d = dayOf(iso);
  if (d === null) return null;
  const date = new Date(d);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** `2026-09-12T14:30:00Z` → `12 Sep 2026, 14:30` (UTC, so the server and the browser agree). */
export function formatTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${formatDay(iso)}, ${hh}:${mm}`;
}

/**
 * A moment relative to now, for a secondary caption only: `just now`,
 * `4m ago`, `23h ago`, `3d ago`; older than 30 days, the day itself. The one
 * relative formatter in the app, so a list never mixes `8/20/2026` with
 * `3d ago`.
 */
export function formatRelative(iso: string | null | undefined, now: Date = new Date()): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const delta = now.getTime() - t;
  if (delta < 60_000) return "just now";
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < DAY) return `${Math.floor(delta / 3_600_000)}h ago`;
  if (delta < 30 * DAY) return `${Math.floor(delta / DAY)}d ago`;
  return formatDay(iso);
}

/**
 * Money, one way: `6.15 USD`, `26,550.00 USD`. Two decimals always, up to
 * four for a unit price under a cent, the ISO code after the figure (the
 * RFQ and order tables are read by buyers in four currencies, and a symbol
 * is ambiguous across them).
 */
export function formatMoney(n: number | null | undefined, currency: string): string | null {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return null;
  const v = Number(n);
  const digits = Math.abs(v) > 0 && Math.abs(v) < 0.01 ? 4 : 2;
  return `${new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: digits }).format(v)} ${currency}`;
}

/** A quantity with its unit, never rounded: `12,000 pcs`, `1,250.5 kg`. */
export function formatQuantity(n: number | null | undefined, unit: string): string | null {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return null;
  return `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 4 }).format(Number(n))} ${unit}`;
}

/** Tabular figure with thousands separators: 3314 → `3,314`. */
export function formatCount(n: number | null | undefined): string | null {
  if (n === null || n === undefined || !Number.isFinite(n)) return null;
  return new Intl.NumberFormat("en-GB").format(Math.round(n));
}

/** One certificate as `supplier_cert_checks` (0122) returns it. */
export type CertCheck = {
  kind: string;
  certificate_no: string | null;
  listing_status: string;
  checked_at: string | null;
  delisted_at: string | null;
};
/** `supplier_cert_checks`: the record's certificates, and each scheme's last complete read. */
export type CertChecks = { certs: CertCheck[]; reads: Record<string, string | null> };

/** One shipment as Volza returned it (0137 `top_shipments`, 0139 `top_record` and each market's `top`). */
export type VolzaShipment = {
  shipment_date: string | null;
  hsn_code: string | null;
  product_description: string | null;
  buyer_name: string | null;
  destination_country: string | null;
  trade_value_usd: number | null;
  unit_rate_usd: number | null;
  unit: string | null;
};
export type VolzaMarketName = "United Kingdom" | "United States" | "EU" | "Canada";
export type VolzaMarket = { shipments: number; fob_usd: number | null; buyers: number | null; top: VolzaShipment | null };
/** `supplier_volza_exports` (0137, 0139, 0140): null unless the reader is on a paying plan and there is an exact match. */
export type VolzaExports = {
  shipments: number;
  fob_usd: number | null;
  buyers: number | null;
  window_start: string;
  window_end: string;
  volza_name: string | null;
  top_shipments: VolzaShipment[];
  fetched_at: string;
  /** 0139: Volza's counts as returned. */
  summary?: { count_of_hsn_codes?: number | null; count_of_unique_destination_countries?: number | null; count_of_shipment_modes?: number | null } | null;
  /** 0139: the one stored shipment, every field. */
  top_record?: VolzaShipment | null;
  /** 0139: null for a supplier that ships to one country. */
  markets?: Partial<Record<VolzaMarketName, VolzaMarket>> | null;
  /** 0139: null unless every shipment is counted in pieces. */
  small_orders?: { under_pcs: number; shipments: number; of: number } | null;
  /** 0140: what the stored shipment is. Absent or "value": the biggest; "date": the latest on record. */
  record_sort?: "value" | "date" | null;
};

/** One shipment in a reveal, as `supplier_shipment_reveal` (0141) returns it: no unit price. */
export type RevealRecord = {
  date: string | null;
  product: string | null;
  hs_code: string | null;
  buyer: string | null;
  buyer_country: string | null;
  destination: string | null;
  unit: string | null;
  value_usd: number | null;
  weight_kg: number | null;
};
/** `supplier_shipment_reveal` (0141): the saved latest shipments, cut to 15 or 25 by the database. */
export type ShipmentReveal = { fetched_at: string; limit: number; records: RevealRecord[] };
/** `supplier_shipment_reveal_state` (0141): what the Recent shipments section shows this reader. */
export type ShipmentRevealState =
  | { state: "upgrade" }
  | { state: "shown"; reveal: ShipmentReveal }
  | { state: "offer"; shown: number; limit: number | null; used: number };

/** A reveal row as the table prints it (Paper page 34, K4, three columns after the founder's note of 11 Oct). */
export type RevealRow = { key: string; date: string; product: string; hs: string | null; buyerTo: string | null; value: string | null; weight: string | null };

/**
 * The reveal's rows: the date, the product as filed in sentence case with its HS code (6109.10), the buyer tidied
 * as on the band ("The Haddad Apparel Group Ltd") with where it went, the value and the gross weight. Never a unit
 * price, and never a quantity: the records carry none (only value over unit price, which is a price).
 */
export function revealRows(records: readonly RevealRecord[]): RevealRow[] {
  return records.map((r, i) => {
    const hs = r.hs_code && /^\d{6,}$/.test(r.hs_code) ? `${r.hs_code.slice(0, 4)}.${r.hs_code.slice(4, 6)}` : null;
    const buyerTo = [tidyBuyer(r.buyer), place(r.destination)].filter(Boolean).join(" · ") || null;
    return {
      key: `${i}`,
      date: formatDay(r.date) ?? "Date not filed",
      product: productWords(r.product) ?? "Garments",
      hs,
      buyerTo,
      value: typeof r.value_usd === "number" ? usd(Math.round(r.value_usd)) : null,
      weight: typeof r.weight_kg === "number" && r.weight_kg > 0 ? `${Math.round(r.weight_kg).toLocaleString("en-GB")} kg` : null,
    };
  });
}

/**
 * Pieces a year the customs row says the supplier shipped: the window's export value a year over the
 * stored shipment's price a piece (at least US$1, so a cheap line cannot inflate it). Null when the row
 * is missing (a reader not on a paying plan) or not counted in pieces.
 */
export function shippedPiecesPerYear(v: VolzaExports | null | undefined): number | null {
  const one = v?.top_record ?? v?.top_shipments[0];
  const years = v ? (Date.parse(v.window_end) - Date.parse(v.window_start)) / (365.25 * 864e5) : 0;
  if (!v?.fob_usd || !one?.unit_rate_usd || one.unit !== "PCS" || !(years > 0)) return null;
  return v.fob_usd / years / Math.max(one.unit_rate_usd, 1);
}

export const CAPACITY_EXPORTS_MORE = "Exports suggest more than this";
export const CAPACITY_INCONSISTENT = "Filed figures look inconsistent; confirm with the supplier";

/**
 * The registers' capacity stays as filed (no figure is rewritten from another source). A buyer gets
 * one of two notes (founder, 11 Oct 2026: one plain line, not a diagnosis); the checks behind the
 * second, in pieces a year (a day's figure counts 300 working days, a dozen 12 pieces):
 * - filed over 25 times exports, for a supplier with 50+ shipments (Hamza Clothing: 20,000,000 dozen);
 * - the same number filed per day and per year (17 published records);
 * - the two figures over 3 times apart, a year of pieces filed as dozens among them (247 of 376);
 * - over 1,000,000 pieces a day or 10,000,000 dozen a year: more than one factory makes.
 * The first: exports over 3 times the larger figure (RAM Apparel, about 14 times its 25,000 dozen).
 * Both export checks need the customs row, which only a reader on a paying plan gets.
 */
export function capacityNote(
  s: { production_capacity_pcs_day?: number | null; production_capacity_dozen_yearly?: number | null },
  v: VolzaExports | null | undefined,
): string | null {
  const day = s.production_capacity_pcs_day ?? 0;
  const dozen = s.production_capacity_dozen_yearly ?? 0;
  const filed = Math.max(day * 300, dozen * 12);
  if (!filed) return null;
  const shipped = shippedPiecesPerYear(v);
  if (shipped !== null && shipped > 3 * filed) return CAPACITY_EXPORTS_MORE;
  const wrong =
    (shipped !== null && v!.shipments >= 50 && filed > 25 * shipped) ||
    (day > 0 && dozen > 0 && (day === dozen || filed > 3 * Math.min(day * 300, dozen * 12))) ||
    day > 1_000_000 ||
    dozen > 10_000_000;
  return wrong ? CAPACITY_INCONSISTENT : null;
}

const usd = (n: number, digits = 0) =>
  `US$${n.toLocaleString("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

/** US$21.7m, US$4.97m, US$845k, US$950: export totals at a glance. */
export function formatUsdShort(n: number): string {
  if (n >= 999_500) {
    const m = n / 1e6;
    // Three figures at most, never "US$1000k": 191m, 21.7m, 4.97m.
    return `US$${m.toFixed(m >= 99.95 ? 0 : m >= 9.995 ? 1 : 2).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "")}m`;
  }
  if (n >= 1e3) return `US$${Math.round(n / 1e3)}k`;
  return usd(n);
}

const MARKETS: VolzaMarketName[] = ["United Kingdom", "United States", "EU", "Canada"];
const SHORT: Record<VolzaMarketName, string> = { "United Kingdom": "UK", "United States": "US", EU: "EU", Canada: "Canada" };
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;
const utcDay = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`);

/** "Sep 2024 – Aug 2026": the customs window, in months. */
export function customsWindow(v: Pick<VolzaExports, "window_start" | "window_end">): string {
  const [a, b] = [utcDay(v.window_start), utcDay(v.window_end)];
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return "the two-year window";
  return `${MONTHS[a.getUTCMonth()]} ${a.getUTCFullYear()} – ${MONTHS[b.getUTCMonth()]} ${b.getUTCFullYear()}`;
}

const ENDINGS = [["CO", "KG"], ["Z", "O", "O"], ["S", "P", "A"], ["B", "V"], ["S", "A"], ["S", "L"], ["LTD"], ["LIMITED"], ["LLC"], ["INC"], ["GMBH"], ["BV"], ["SA"], ["SL"], ["SPA"], ["SRL"], ["CORP"], ["PLC"], ["LP"]];
const CASED: Record<string, string> = { GMBH: "GmbH", LTD: "Ltd", INC: "Inc", THE: "The", AND: "and", OF: "of" };

/**
 * How customs names the brands whose own lists we hold (source-tiers' BRAND_* labels). Strict on
 * purpose: "NEXT" alone would match Next Level Apparel, so a miss is preferred to a false match.
 */
const CUSTOMS_BRANDS: Record<string, RegExp> = {
  "H&M": /\bH\s*&\s*M\b|\bHENNES\b/i,
  ASOS: /\bASOS\b/i,
  NEXT: /\bNEXT\s+(RETAIL|SOURCING|PLC|DIRECTORY|HOLDINGS)\b/i,
  "M&S": /\bMARKS\s*(&|AND)\s*SPENCER\b/i,
  Inditex: /\bINDITEX\b|\bZARA\b|\bBERSHKA\b|\bSTRADIVARIUS\b|\bMASSIMO\s+DUTTI\b|\bPULL\s*(&|AND)\s*BEAR\b/i,
  Primark: /\bPRIMARK\b|\bPENNEYS\b/i,
};

/** Buyer names on the shipments the customs row holds (the stored one, and the biggest to each market). */
function customsBuyerNames(v: VolzaExports | null | undefined): string[] {
  if (!v) return [];
  const markets = Object.values(v.markets ?? {}).map((m) => m?.top ?? null);
  return [v.top_record ?? null, ...v.top_shipments, ...markets].map((x) => x?.buyer_name ?? "").filter(Boolean);
}

/**
 * Up to five distinct buyers from those shipments, tidied ("Action Service Distributie B V"). Customs
 * buyers are importers: often a logistics or buying house rather than the brand, so they sit beside
 * the brands' own lists, never in place of them (founder, 11 Oct 2026). Empty for a reader the
 * customs read refused.
 */
export function customsBuyers(v: VolzaExports | null | undefined): string[] {
  const seen = new Map<string, string>();
  for (const raw of customsBuyerNames(v)) {
    const name = tidyBuyer(raw);
    if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
  }
  return [...seen.values()].slice(0, 5);
}

/** The listed brands a customs buyer on file also names: the two sources agreeing. */
export function brandsInCustoms(brands: readonly string[], v: VolzaExports | null | undefined): Set<string> {
  const names = customsBuyerNames(v);
  return new Set(brands.filter((b) => CUSTOMS_BRANDS[b] && names.some((n) => CUSTOMS_BRANDS[b]!.test(n))));
}

// What the trade calls a customs buyer, where one distinctive word settles it. The brands' own
// patterns come after Inditex's labels, so "INDITEX ZARA LELYSTAD" is Zara and a bare "INDITEX" is Inditex.
// ponytail: a short hand-kept list; anything not on it falls back to the filed name without its legal
// ending, and the filed name is always printed small beside it. Add a name when a buyer keeps appearing.
const TRADE_NAMES: [RegExp, string][] = [
  [/\bZARA\b/i, "Zara"],
  [/\bBERSHKA\b/i, "Bershka"],
  [/\bSTRADIVARIUS\b/i, "Stradivarius"],
  [/\bMASSIMO\s+DUTTI\b/i, "Massimo Dutti"],
  [/\bPULL\s*(&|AND)\s*BEAR\b/i, "Pull&Bear"],
  ...Object.entries(CUSTOMS_BRANDS).map(([label, re]): [RegExp, string] => [re, label]),
  [/\bPUNTO\s+FA\b/i, "Mango"],
  [/\bHUGO\s+BOSS\b/i, "Hugo Boss"],
  [/\bLEVI\s+STRAUSS\b/i, "Levi's"],
  [/\bWAL-?MART\b/i, "Walmart"],
  [/\bKIK\s+TEXTIL/i, "KiK"],
  [/\bLIDL\b/i, "Lidl"],
  [/\bALDI\b/i, "Aldi"],
  [/\bTESCO\b/i, "Tesco"],
  [/\bDECATHLON\b/i, "Decathlon"],
  [/\bCARREFOUR\b/i, "Carrefour"],
  [/\bTCHIBO\b/i, "Tchibo"],
  [/\bUNIQLO\b/i, "Uniqlo"],
];
// Words a company's name ends in that nobody says: the legal endings, and what customs adds after them.
const NAME_TAILS = [...ENDINGS, ["CO"], ["CORPORATION"], ["INCORPORATED"], ["COMPANY"], ["UNIT"], ["BRANCH"]];

/** One buyer of a supplier: the name a reader knows it by, and where we hold it from. */
export type Buyer = {
  name: string;
  /** The brand's own disclosure list names this supplier. */
  listed: boolean;
  /** A customs record on file names it as the importer. */
  customs: boolean;
  /** The customs record's own name for it, when that is not the name shown. */
  filed: string | null;
};

/**
 * A customs buyer under the name people use (founder, 12 Oct 2026: "Inditex Zara Lelystad Branch Nieu"
 * set as large as a brand reads as the brand's name). "Zara" from the list above, else the filed name
 * without its legal ending ("Canadian Tire Corporation Ltd" is "Canadian Tire"). `filed` keeps the
 * record's own name whenever the two differ, to be printed small: the short name is ours, not customs'.
 */
export function knownBuyer(tidy: string): Pick<Buyer, "name" | "filed"> {
  const words = tidy.split(" ");
  const up = words.map((w) => w.toUpperCase().replace(/[.,]/g, ""));
  let n = words.length;
  // A whole ending at a time ("S A", "Corporation Ltd"), and never the name's last word standing.
  for (let e; (e = NAME_TAILS.find((t) => t.length < n && t.every((x, j) => up[n - t.length + j] === x))); ) n -= e.length;
  const name = TRADE_NAMES.find(([re]) => re.test(tidy))?.[1] ?? words.slice(0, n).join(" ");
  return { name, filed: name.toLowerCase() === tidy.toLowerCase() ? null : tidy };
}

/**
 * Who buys from a supplier, as one list: each brand whose own list names it, joined with the customs
 * buyer that is the same company where the strict patterns above say so, then the customs buyers no
 * list names. Both sources agreeing comes first. A name is never listed twice.
 */
export function buyersOf(brands: readonly string[], v: VolzaExports | null | undefined): Buyer[] {
  const names = customsBuyerNames(v);
  const listed: Buyer[] = brands.map((b) => {
    const re = CUSTOMS_BRANDS[b];
    const hit = re ? tidyBuyer(names.find((n) => re.test(n))) : null;
    return { name: b, listed: true, customs: hit !== null, filed: hit && hit.toLowerCase() !== b.toLowerCase() ? hit : null };
  });
  const rows = [...listed.filter((r) => r.customs), ...listed.filter((r) => !r.customs)];
  for (const c of customsBuyers(v)) {
    if (brands.some((b) => CUSTOMS_BRANDS[b]?.test(c))) continue;
    const k = knownBuyer(c);
    if (!rows.some((r) => r.name.toLowerCase() === k.name.toLowerCase())) rows.push({ ...k, listed: false, customs: true });
  }
  return rows;
}

/**
 * A buyer as the customs record files it, tidied (Volza data session, 11 Oct 2026): up to and
 * including the first legal ending, else up to the first number; an all-capitals name in title case,
 * words of three letters or fewer kept as filed ("TJX UK"). "THE HADDAD APPAREL GROUP LTD 131 D" is
 * "The Haddad Apparel Group Ltd"; "BUGATTI GMBH HANSA STRASSE 55 32049" is "Bugatti GmbH".
 */
export function tidyBuyer(raw: string | null | undefined): string | null {
  const words = (raw ?? "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (!words.length) return null;
  const up = words.map((w) => w.toUpperCase().replace(/[.,]/g, ""));
  let cut = -1;
  for (let i = 0; i < up.length && cut < 0; i++) {
    // Never the first word: "SA FASHION TRADING LTD" is cut at Ltd, not at "SA".
    const e = i > 0 ? ENDINGS.find((end) => end.every((t, j) => up[i + j] === t)) : undefined;
    if (e) cut = i + e.length;
  }
  if (cut < 0) {
    const n = words.findIndex((w) => /\d/.test(w));
    cut = n > 0 ? n : words.length;
  }
  const kept = words.slice(0, cut);
  if (/[a-z]/.test(kept.join(" "))) return kept.join(" ");
  return kept.map((w) => CASED[w] ?? (w.length > 3 ? w[0] + w.slice(1).toLowerCase() : w)).join(" ");
}

/** "MEN'S BASIC T SHIRT" is "Men's basic t shirt": a product as filed, in sentence case. */
function productWords(raw: string | null): string | null {
  const t = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  // Mostly capitals ("MEN'S BASIC T SHIRT (Men's T-Shirt)") reads as filed in capitals.
  const upper = (t.match(/[A-Z]/g) ?? []).length;
  const lower = (t.match(/[a-z]/g) ?? []).length;
  const s = upper > lower ? t.toLowerCase() : t;
  return s[0]!.toUpperCase() + s.slice(1);
}
const place = (raw: string | null | undefined) => (raw && raw !== "Not Available" ? raw : null);

/** The one stored shipment: 0139's `top_record`, else 0137's first of `top_shipments`. */
const stored = (v: VolzaExports): VolzaShipment | null => v.top_record ?? v.top_shipments[0] ?? null;
const isLatest = (v: VolzaExports) => v.record_sort === "date";

export type CustomsFigure = { value: string; label: string };
export type CustomsBand = { window: string; shipsTo: string | null; figures: CustomsFigure[] };

/**
 * The band under the compliance strip (Paper page 34, boards A, B, F): the window, the markets line
 * when the markets were fetched, and the figures, export value first. "Latest shipment on record"
 * only when 0140 says the stored shipment is the latest: the biggest shipment's date is never passed
 * off as the last one.
 */
export function customsBand(v: VolzaExports): CustomsBand {
  const figures: CustomsFigure[] = [];
  if (v.fob_usd !== null) figures.push({ value: formatUsdShort(v.fob_usd), label: "export value" });
  const s = stored(v);
  const latest = isLatest(v) ? formatDay(s?.shipment_date?.slice(0, 10)) : null;
  if (latest) figures.push({ value: latest, label: "latest shipment on record" });
  figures.push({ value: v.shipments.toLocaleString("en-GB"), label: v.shipments === 1 ? "shipment" : "shipments" });
  if (v.buyers !== null) figures.push({ value: v.buyers.toLocaleString("en-GB"), label: v.buyers === 1 ? "buyer" : "buyers" });
  if (v.fob_usd !== null && v.shipments > 0) {
    const avg = v.fob_usd / v.shipments;
    const step = avg >= 10_000 ? 100 : 10;
    figures.push({ value: usd(Math.round(avg / step) * step), label: "average shipment" });
  }
  const total = v.summary?.count_of_unique_destination_countries ?? null;
  let shipsTo: string | null = null;
  if (v.markets) {
    const m = v.markets;
    const named = MARKETS.filter((k) => (m[k]?.shipments ?? 0) > 0).sort((a, b) => m[b]!.shipments - m[a]!.shipments);
    if (named.length) shipsTo = `${named.map((k) => SHORT[k]).join(", ")}${total && total > named.length ? ` · ${total} countries in all` : ""}`;
  } else if (total === 1) {
    shipsTo = place(s?.destination_country);
  }
  return { window: customsWindow(v), shipsTo, figures };
}

export type CustomsRow = { label: string; value: string; note: string | null };

/** "Boys tee (HS 6109.10) to The Haddad Apparel Group Ltd, United States": one shipment in words. */
function shipmentWords(s: VolzaShipment, withCountry = true): string {
  const hs = s.hsn_code && /^\d{6,}$/.test(s.hsn_code) ? ` (HS ${s.hsn_code.slice(0, 4)}.${s.hsn_code.slice(4, 6)})` : "";
  const to = [tidyBuyer(s.buyer_name), withCountry ? place(s.destination_country) : null].filter(Boolean).join(", ");
  return `${productWords(s.product_description) ?? "Garments"}${hs}${to ? ` to ${to}` : ""}`;
}

/**
 * The Exports tab's own lines (board B): only what the band cannot say. Unit prices wait for the
 * per-heading price check (spec §2: 6 of 252 stored prices are plainly not per piece), so none is
 * printed yet.
 */
export function customsRows(v: VolzaExports): CustomsRow[] {
  const rows: CustomsRow[] = [];
  const [a, b] = [utcDay(v.window_start), utcDay(v.window_end)];
  const months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth() + 1;
  if (months > 0 && v.shipments > 0) {
    const per = v.shipments / months;
    rows.push({
      label: "Shipping rhythm",
      value: per >= 1.5 ? `About ${Math.round(per).toLocaleString("en-GB")} shipments a month` : `${plural(v.shipments, "shipment")} in ${months} months`,
      note: `${plural(v.shipments, "shipment")}, ${customsWindow(v)}`,
    });
  }
  const codes = v.summary?.count_of_hsn_codes ?? null;
  if (codes) {
    const total = v.summary?.count_of_unique_destination_countries ?? null;
    const modes = v.summary?.count_of_shipment_modes ?? null;
    const note = [total ? plural(total, "destination country", "destination countries") : null, modes ? plural(modes, "shipping mode") : null].filter(Boolean).join(" · ");
    rows.push({ label: "Product range", value: plural(codes, "product code"), note: note || null });
  }
  const s = stored(v);
  if (s && s.trade_value_usd !== null) {
    rows.push({
      label: isLatest(v) ? "Latest shipment on record" : "Biggest shipment",
      value: [usd(Math.round(s.trade_value_usd)), formatDay(s.shipment_date?.slice(0, 10))].filter(Boolean).join(" · "),
      note: shipmentWords(s),
    });
  }
  const small = v.small_orders;
  if (small && small.of > 0) {
    rows.push(
      small.shipments === 0
        ? { label: "Small orders", value: `None under ${small.under_pcs.toLocaleString("en-GB")} pieces`, note: "Counted in pieces. Not a minimum order." }
        : {
            label: "Small orders",
            value: `${small.shipments.toLocaleString("en-GB")} of ${plural(small.of, "shipment")} under ${small.under_pcs.toLocaleString("en-GB")} pieces`,
            note: `${Math.round((100 * small.shipments) / small.of)}%, counted in pieces. Not a minimum order.`,
          },
    );
  }
  return rows;
}

const THE: Record<VolzaMarketName, string> = { "United Kingdom": "the UK", "United States": "the US", EU: "the EU", Canada: "Canada" };

/** "Where it ships" (board B): one row per market, most shipments first; a market with none says so for the window. */
export function marketRows(v: VolzaExports): CustomsRow[] {
  const m = v.markets;
  if (!m) return [];
  const shipped = MARKETS.filter((k) => (m[k]?.shipments ?? 0) > 0).sort((a, b) => m[b]!.shipments - m[a]!.shipments);
  const none = MARKETS.filter((k) => m[k] && m[k]!.shipments === 0);
  return [
    ...shipped.map((k) => {
      const x = m[k]!;
      return {
        label: k,
        value: [plural(x.shipments, "shipment"), x.fob_usd !== null ? formatUsdShort(x.fob_usd) : null, x.buyers !== null ? plural(x.buyers, "buyer") : null].filter(Boolean).join(" · "),
        // The EU is 27 countries, so its row names the country; the others are the country.
        note: x.top ? `Biggest shipment there: ${shipmentWords(x.top, k === "EU")}` : null,
      };
    }),
    ...none.map((k) => ({ label: k, value: `No shipments to ${THE[k]}`, note: customsWindow(v) })),
  ];
}

/** The profile names the records, not the provider: Volza is named on /legal/data-sources only (founder, 11 Oct 2026). */
export function customsSource(v: VolzaExports): string {
  const filed = v.volza_name ? `, filed as ${v.volza_name.replace(/\.+$/, "")}` : "";
  return `Garment export shipments (HS 61 and 62)${filed} · fetched ${formatDay(v.fetched_at) ?? "date unknown"}`;
}

/** Who publishes each scheme's list, and how stale a check may be (spec-etl-freshness §3). */
const CERT_BODY: Record<string, { name: string; slaHours: number }> = {
  gots: { name: "GOTS", slaHours: 72 },
  wrap: { name: "WRAP", slaHours: 72 },
  oeko_tex: { name: "OEKO-TEX", slaHours: 240 },
  sa8000: { name: "SAAS", slaHours: 240 },
};

/**
 * The line under a certificate's state: when its body last showed it (spec §3). Says what we
 * found, never "clear". Null for a scheme we do not read or a certificate with no check yet.
 * `newer`: another certificate of the scheme on the record runs later, so "no newer" is untrue.
 */
export function certCheckLine(
  kind: string,
  expiresOn: string | null,
  check: CertCheck | undefined,
  reads: Record<string, string | null>,
  now: Date,
  newer = false,
): { text: string; caution: boolean } | null {
  const body = CERT_BODY[kind];
  if (!body || !check) return null;
  if (check.listing_status === "no_longer_listed") {
    const was = formatDay(expiresOn);
    return { text: `${body.name} no longer lists it${was ? ` (was valid until ${was})` : ""}`, caution: true };
  }
  const day = formatDay(check.checked_at);
  if (!check.checked_at || !day) return null;
  if (now.getTime() - Date.parse(check.checked_at) > body.slaHours * 3_600_000) {
    return { text: `last shown by ${body.name} ${day} · not re-checked since`, caution: true };
  }
  if (kind === "oeko_tex") return { text: `listed by ${body.name} on ${day}`, caution: false };
  if (!newer && certState(expiresOn, now) === "expired") {
    return { text: `${body.name} lists no newer certificate (checked ${formatDay(reads[kind]) ?? day})`, caution: false };
  }
  return { text: `checked with ${body.name} ${day}`, caution: false };
}

/** The words on a certificate's state badge. */
export function certStateLabel(c: Pick<CertModel, "state" | "daysLeft" | "expiresOn">): string {
  const day = formatDay(c.expiresOn);
  switch (c.state) {
    case "valid":
      return day ? `Valid to ${day}` : "Listed as valid";
    case "expiring":
      return day
        ? `Expires ${day} · ${c.daysLeft} ${c.daysLeft === 1 ? "day" : "days"}`
        : `Expires in ${c.daysLeft} days`;
    case "expired":
      return day ? `Expired ${day}` : "Expired";
  }
}

/** The short form on a card chip: `GOTS valid to 12 May 2027`, `WRAP expires in 11 days`, `WRAP expired 21 Jul 2026`. */
export function certChipLabel(c: Pick<CertModel, "scheme" | "state" | "daysLeft" | "expiresOn">): string {
  const day = formatDay(c.expiresOn);
  switch (c.state) {
    case "valid":
      return day ? `${c.scheme} valid to ${day}` : `${c.scheme} listed as valid`;
    case "expiring":
      // Four published certificates expire today; "expires in 0 days" is not
      // how anyone says that.
      if (c.daysLeft === 0) return `${c.scheme} expires today`;
      return `${c.scheme} expires in ${c.daysLeft} ${c.daysLeft === 1 ? "day" : "days"}`;
    case "expired":
      return day ? `${c.scheme} expired ${day}` : `${c.scheme} expired`;
  }
}

/** The shortest form, for a 22px table chip: `GOTS valid`, `WRAP 11 d`, `WRAP expired`. */
export function certTableLabel(c: Pick<CertModel, "scheme" | "state" | "daysLeft">): string {
  switch (c.state) {
    case "valid":
      return `${c.scheme} valid`;
    case "expiring":
      return `${c.scheme} ${c.daysLeft} d`;
    case "expired":
      return `${c.scheme} expired`;
  }
}

/**
 * Every value of the `cert_kind` enum, so no scheme can reach a buyer as the
 * database's own token. Production holds four of the fourteen today (GOTS,
 * OEKO_TEX, WRAP, SA8000); the other ten were rendering as "SEDEX_SMETA",
 * "ISO9001", "OTHER" and so on the moment a scraper filed one.
 */
const SCHEME_LABEL: Record<string, string> = {
  GOTS: "GOTS",
  WRAP: "WRAP",
  OEKO_TEX: "OEKO-TEX",
  "OEKO-TEX": "OEKO-TEX",
  SA8000: "SA8000",
  GRS: "GRS",
  RCS: "RCS",
  OCS: "OCS",
  BSCI: "BSCI",
  SEDEX_SMETA: "Sedex SMETA",
  BCI: "Better Cotton",
  FAIRTRADE: "Fairtrade",
  ISO9001: "ISO 9001",
  ISO14001: "ISO 14001",
  ISO45001: "ISO 45001",
  // The enum's own catch-all. "OTHER" on a certificate card says nothing; this
  // says what the row actually is — a certificate whose scheme was not named.
  OTHER: "Certificate",
};

/** `OEKO_TEX` → `OEKO-TEX`; unknown kinds render as stored. */
/**
 * The OEKO-TEX schemes production's `certifications.scope` holds, longest
 * first so "STANDARD 100" is not matched by a shorter prefix.
 * `select scope, count(*) … where kind = 'oeko_tex' group by 1` on 20 Sep 2026:
 * STANDARD 100 2,588 · STeP 190 · MADE IN GREEN 71 · ORGANIC COTTON 60 ·
 * ECO PASSPORT 13 · DETOX TO ZERO 1.
 */
const OEKO_SCHEMES = ["standard 100", "made in green", "organic cotton", "eco passport", "detox to zero", "step"] as const;

export function certScheme(kind: string, scope: string | null = null): string {
  const base = SCHEME_LABEL[kind] ?? SCHEME_LABEL[kind.toUpperCase()] ?? kind.toUpperCase();
  // WRAP stores its level in the scope ("Gold | Industries: …"); the artifact reads "WRAP Gold".
  if (base === "WRAP" && scope) {
    const level = /^(gold|platinum|silver)\b/i.exec(scope.trim());
    if (level && level[1]) return `WRAP ${level[1][0]!.toUpperCase()}${level[1].slice(1).toLowerCase()}`;
  }
  // OEKO-TEX runs six schemes and production holds five of them. Only
  // Standard 100 was named, so a STeP facility certificate and a MADE IN GREEN
  // product certificate both read as a bare "OEKO-TEX" on the card and the
  // table — 242 published records hold one that is not Standard 100.
  if (base === "OEKO-TEX" && scope) {
    const named = OEKO_SCHEMES.find((n) => new RegExp(`^\\s*(?:oeko-?tex\\s*)?${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(scope.trim()));
    if (named) return `OEKO-TEX ${named.replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/Step/, "STeP")}`;
  }
  return base;
}

export function certModel(
  raw: {
    kind: string;
    certificate_no: string | null;
    issuer: string | null;
    expires_on: string | null;
    scope: string | null;
    document_url: string | null;
  },
  today: Date,
): CertModel {
  const state = certState(raw.expires_on, today);
  return {
    kind: raw.kind,
    scheme: certScheme(raw.kind, raw.scope),
    number: raw.certificate_no,
    issuer: raw.issuer,
    scope: raw.scope,
    expiresOn: raw.expires_on,
    state,
    daysLeft: daysUntil(raw.expires_on, today),
    // GOTS drops an expired certificate from its list, and its public page with it.
    documentUrl: raw.kind.toLowerCase() === "gots" && state === "expired" ? null : publicPage(raw.document_url),
    markCode: raw.kind,
  };
}

/**
 * The id of a certificate's row on the record, so a link (the Compliance hub's
 * expired list) can land on that one row: `cert-gots-gots-27605`. Built from
 * what both ends hold — the scheme's code and the number, or the expiry date
 * when there is no number — the same pair the record keys its rows by.
 */
export function certRowId(kind: string, number: string | null, expiresOn: string | null): string {
  return `cert-${kind}-${number ?? expiresOn ?? ""}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "");
}

/** Certificates in the order a buyer needs them: expiring soonest, then valid, then expired. */
export function sortCerts(certs: readonly CertModel[]): CertModel[] {
  const rank: Record<CertState, number> = { expiring: 0, valid: 1, expired: 2 };
  return [...certs].sort(
    (a, b) => rank[a.state] - rank[b.state] || (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity) || a.scheme.localeCompare(b.scheme),
  );
}

/** "4 on file" / "1 on file". */
export function onFileLabel(n: number): string {
  return `${n} on file`;
}

/**
 * The tile's sub-line: every state that needs a look, soonest expiry first —
 * "1 expiring in 11 days · 1 expired" — and "all valid" when
 * none does. It used to return early on the expiring branch, so a record with
 * both an expiring and an expired certificate showed only the expiring one and
 * the expired certificate vanished from the card and the table.
 */
export function certTileSubline(certs: readonly CertModel[]): string | null {
  if (certs.length === 0) return null;
  const parts: string[] = [];
  const expiring = certs.filter((c) => c.state === "expiring");
  if (expiring.length) {
    const soonest = expiring.reduce((a, b) => ((a.daysLeft ?? 0) <= (b.daysLeft ?? 0) ? a : b));
    // `certChipLabel` says "expires today" at 0 days; this said "expiring in
    // 0 days" beside it. Four published certificates expire on the read date.
    parts.push(
      soonest.daysLeft === 0
        ? `${expiring.length} expiring today`
        : `${expiring.length} expiring in ${soonest.daysLeft} ${soonest.daysLeft === 1 ? "day" : "days"}`,
    );
  }
  const expired = certs.filter((c) => c.state === "expired").length;
  if (expired) parts.push(`${expired} expired`);
  return parts.length ? parts.join(" · ") : "all valid";
}

/**
 * RSC remediation status words for the five real states (spec §3).
 *
 * The register stores each state under several spellings, and the ones with
 * the rows are unspaced. Counted on production 19 Sep 2026 (active rows):
 * `behindschedule` 907 · `initialcompleted` 638 · `ontrack` 38 ·
 * `notfinalized` 36 · `notimplemented` 280 (all inactive today) · `` 97 ·
 * plus the spaced `Behind schedule` 10, `On track` 1, `Initial CAP Completed`
 * 2, `CAP not finalised/ N/A` 1. Matching only the spaced forms left
 * `ontrack` and `notfinalized` — 30 published records — rendering the raw
 * database token to a buyer, and the tone checks below reading them as fine.
 */
export function rscStatusWords(status: string | null | undefined): string | null {
  if (!status) return null;
  // Compare without spaces so "On track", "on track" and "ontrack" are one state.
  const s = status.toLowerCase().replace(/[^a-z]/g, "");
  if (s.includes("behind")) return "behind schedule";
  if (s.includes("ontrack")) return "on track";
  if (s.includes("notimplemented")) return "not implemented";
  if (s.includes("notfinal")) return "not finalised";
  if (s.includes("initial")) return "initial plan completed";
  return status;
}

/**
 * The five states, exactly as `rscStatusWords` returns them. A status the
 * register starts storing under a tenth spelling falls through to the raw
 * token, and `rscStatusUnmapped` is what a guard asserts against.
 */
export const RSC_STATUS_WORDS = ["behind schedule", "on track", "not implemented", "not finalised", "initial plan completed"] as const;

/** True when the stored status did not map to one of the five states. */
export function rscStatusUnmapped(status: string | null | undefined): boolean {
  const words = rscStatusWords(status);
  return words !== null && !(RSC_STATUS_WORDS as readonly string[]).includes(words);
}

/**
 * A remediation state a buyer should look at. "Not implemented" and "not
 * finalised" are as much a caution as "behind schedule"; the two tone checks
 * used to test `/behind|not implemented/i`, so `notfinalized` rendered in the
 * positive treatment.
 */
export function rscStatusNeedsLook(status: string | null | undefined): boolean {
  const words = rscStatusWords(status);
  return words === "behind schedule" || words === "not implemented" || words === "not finalised";
}

/**
 * Training status words. Production stores `completed` 923 · `yet to start`
 * 461 · `ongoing` 235 · `unknown` 1 (active rows, 19 Sep 2026).
 */
export function rscTrainingWords(status: string | null | undefined): string | null {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s.includes("complete")) return "training completed";
  if (s.includes("yet") || s.includes("not start")) return "training yet to start";
  if (s.includes("ongoing") || s.includes("progress")) return "training ongoing";
  if (s.includes("unknown")) return "training status not on file";
  return `training ${status.toLowerCase()}`;
}

/** Tokens that stay in capitals when a name is re-cased. */
// "CO" is not an initialism — 35 published all-caps names carry a standalone
// "CO." token and rendered as "Textile CO. Ltd".
const KEEP_UPPER = new Set(["BD", "UK", "USA", "EU", "LLC", "PLC", "INC", "JV", "EPZ", "RMG", "ETP", "ERP", "SA", "AG", "BV", "NV"]);

function caseWord(word: string): string {
  const upper = word.toUpperCase();
  if (KEEP_UPPER.has(upper)) return upper;
  return upper.charAt(0) + upper.slice(1).toLowerCase();
}

/**
 * The name as the dashboard shows it. A name stored in mixed case is shown
 * verbatim. A name stored in capitals (most register rows: "ABONI KNITWEAR
 * LTD.") is re-cased letter-run by letter-run, so brackets, hyphens, digits and
 * "(PVT)LTD." keep their shape ("(Unit-3, Textile)", "Al-Falah", "(Pvt)Ltd"),
 * dotted initials stay as filed ("G.A.B.", "D.H."), and the trailing period
 * after the legal suffix is dropped. Nothing is ever cut (spec §3).
 */
export function displayName(stored: string): string {
  const name = stored.trim().replace(/\s+/g, " ");
  if (/[a-z]/.test(name)) return name;
  const cased = name
    .split(" ")
    .map((token) => {
      // Dotted initials ("G.A.B.", "A.K.M.", "D.H") are filed that way; keep them.
      if (/^[A-Z](?:\.[A-Z])+\.?$/.test(token)) return token;
      return token.replace(/[A-Z][A-Z0-9]*/g, (run) => (/^\d/.test(run) ? run : caseWord(run)));
    })
    .join(" ");
  return cased.replace(/\b(Ltd|Limited|Inc|Plc|Co)\.$/, "$1");
}

/** Bracketed words that are part of a company's name, never a qualifier after it. */
const PART_OF_NAME = /^(?:bangladesh|bd|pvt\.?|private)$/i;

/**
 * A name's base and the qualifier filed after it, so a list can show the base
 * on one line and the qualifier on the next (the One-Line Name Rule, founder,
 * 29 Sep 2026). The qualifier is what tells sister factories apart: a unit
 * ("Unit-2", "Shafipur Unit"), a building ("Extension"), a division, a group
 * or a former name. Trailing bracketed groups are taken whole (brackets
 * dropped, inner spaces trimmed, several joined with " · ", also when "&" or a
 * comma joins them); a bare trailing "Unit-2" or "U-2" is one too. Never
 * split: "(Bangladesh)", "(BD)" and "(Pvt.)", a bracket in the middle of a
 * name, or brackets that do not balance. Nothing is dropped: base and
 * qualifier together are the whole name.
 */
export function splitQualifier(name: string): { base: string; qualifier: string | null } {
  const whole = name.trim().replace(/\s+/g, " ");
  let depth = 0;
  for (const ch of whole) {
    depth += ch === "(" ? 1 : ch === ")" ? -1 : 0;
    if (depth < 0) break;
  }
  if (depth !== 0) return { base: whole, qualifier: null };
  let base = whole;
  const groups: string[] = [];
  for (;;) {
    const m = /(?:\s*[&,]\s*|\s*)\(([^()]*)\)$/.exec(base);
    const inner = m?.[1]!.trim();
    const rest = m ? base.slice(0, m.index).trim() : "";
    if (!m || !inner || PART_OF_NAME.test(inner) || !rest) break;
    groups.unshift(inner);
    base = rest;
  }
  if (groups.length > 0) return { base: base.replace(/\s*[&,]$/, ""), qualifier: groups.join(" · ") };
  const unit = /^(.*\S)\s+((?:unit|u)[\s-]*\d+[a-z]?)$/i.exec(whole);
  return unit ? { base: unit[1]!, qualifier: unit[2]! } : { base: whole, qualifier: null };
}

/** The line under a name in a list: its qualifier, then what else the row says (type, place), joined with " · ". */
export function nameSecondLine(name: string, ...rest: (string | null | undefined)[]): string {
  return [splitQualifier(name).qualifier, ...rest].filter(Boolean).join(" · ");
}

/** Two-letter initials for the logo slot: `Aboni Knitwear Ltd` → `AK`. */
export function initials(name: string): string {
  const words = name
    .replace(/[()&,.-]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !/^(ltd|limited|co|inc|plc|pvt|private|the|and|of)$/i.test(w));
  const first = words[0]?.[0] ?? name[0] ?? "?";
  // 256 published records reduce to one non-stopword token ("ANABHIL & CO.
  // LTD."); the tile takes the word's second letter rather than showing one.
  const second = words[1]?.[0] ?? words[0]?.[1] ?? "";
  return (first + second).toUpperCase();
}

/** Every value of the `entity_type` enum; production holds three of the four. */
const ENTITY_LABEL: Record<string, string> = {
  factory: "Factory",
  buying_house: "Buying house",
  agent: "Agent",
  unknown: "Unknown type",
};

/** Plain company-type word. */
export function entityLabel(type: string | null | undefined): string {
  if (!type) return "Unknown type";
  // An unmapped type still reads as a type, not as a column value.
  const words = type.replace(/_/g, " ").trim();
  return ENTITY_LABEL[type] ?? (words ? words[0]!.toUpperCase() + words.slice(1) : "Unknown type");
}

/** "Savar, Dhaka" · "Gazipur" · null. City and district collapse when equal. */
export function placeLabel(city: string | null | undefined, district: string | null | undefined): string | null {
  const c = city?.trim() || null;
  const d = district?.trim() || null;
  if (c && d && c.toLowerCase() !== d.toLowerCase()) return `${c}, ${d}`;
  return c ?? d;
}

/** The year from an established date; null when the date is missing. */
export function establishedYearOf(iso: string | null | undefined): string | null {
  const d = dayOf(iso);
  if (d === null) return null;
  return String(new Date(d).getUTCFullYear());
}
