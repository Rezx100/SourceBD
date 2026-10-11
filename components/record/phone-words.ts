// The words of the record on a phone (Paper page 35, the supplier drawer; page 36, the export line):
// the three status rows under the name and their short forms on the stuck strip, the RSC buildings
// worst first, the customs tiles, where the exports go, and the customs shipments of one HS line.
// Customs figures are per supplier and per market only: nothing here splits them by HS code, and a
// figure the records do not hold (a yearly change, a buyer's share) is never made up. Pure.

import type { CertRowData } from "@/components/patterns";
import { certWords, rankCerts } from "@/components/patterns/words";
import { customsWindow, daysUntil, formatDay, formatUsdShort, tidyBuyer, type VolzaExports, type VolzaMarketName, type VolzaShipment } from "@/lib/dashboard/facts";
import type { SupplierSheetModel } from "@/lib/dashboard/models";
import { SANCTIONS_MAX_AGE_MS, certRows, needsLook } from "./words";

export type Tone = "caution" | "sanction" | null;
export type StatusRow = { key: "safety" | "certificates" | "sanctions"; label: string; value: string; sub: string | null; short: string; tone: Tone };

/** One RSC record on the Safety tab: the company's own, or one of its buildings'. */
export type RscCard = {
  name: string;
  ref: string | null;
  progress: number | null;
  status: string | null;
  training: string | null;
  readDate: string | null;
  links: { label: string; href: string | null }[];
};

export const rscBehind = (c: Pick<RscCard, "status">) => /behind/i.test(c.status ?? "");

/** The record's own RSC row and its buildings' rows, behind schedule first, then the least fixed. */
export function rscCards(model: Pick<SupplierSheetModel, "name" | "rsc" | "rscBuildingBlocks">): RscCard[] {
  const own: RscCard[] = model.rsc ? [{ ...model.rsc, name: model.name }] : [];
  const buildings: RscCard[] = model.rscBuildingBlocks.map((b) => ({ ...b, ref: null }));
  return [...own, ...buildings].sort((a, b) => Number(rscBehind(b)) - Number(rscBehind(a)) || (a.progress ?? 101) - (b.progress ?? 101));
}

const NUM = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
/** "Four" up to nine, then the figure. */
export const countWord = (n: number) => NUM[n] ?? n.toLocaleString("en-GB");

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Safety, Certificates and Sanctions under the name, each with the words the stuck strip says. */
export function phoneStatus(model: SupplierSheetModel, today: Date): StatusRow[] {
  const cards = rscCards(model);
  const behind = cards.filter(rscBehind);
  const worst = cards[0] ?? null;
  const safety: StatusRow = !worst
    ? { key: "safety", label: "Safety", value: "Not in RSC", sub: model.rscBuildings.length ? "its buildings have a record" : null, short: "Not in RSC", tone: null }
    : {
        key: "safety",
        label: "Safety",
        value: behind.length ? "Behind schedule" : worst.status ? cap(worst.status) : "In the RSC programme",
        sub: cards.length > 1 ? `worst of ${cards.length} buildings` : worst.progress !== null ? `${worst.progress}% of issues fixed` : null,
        short: behind.length > 1 ? `${behind.length} behind` : behind.length ? "RSC behind" : "In RSC",
        tone: behind.length ? "caution" : null,
      };

  const ranked = rankCerts(model.certs, today);
  const first = ranked[0] ?? null;
  const n = model.certs.length;
  let certificates: StatusRow;
  if (!first) {
    certificates = { key: "certificates", label: "Certificates", value: "None on file", sub: null, short: "No certificates", tone: null };
  } else {
    const scheme = first.c.scheme.split(" ")[0]!;
    const days = daysUntil(first.c.expiresOn, today);
    const expired = ranked.filter((r) => r.w.state === "expired").length;
    if (first.w.state === "expired") {
      certificates = { key: "certificates", label: "Certificates", value: `${scheme} expired`, sub: expired > 1 ? `${expired} of ${n} expired` : `latest lapse of ${n}`, short: `${scheme} expired`, tone: "caution" };
    } else if (first.w.state === "expiring" && days !== null) {
      const ends = days === 0 ? "ends today" : `ends in ${days} ${days === 1 ? "day" : "days"}`;
      certificates = { key: "certificates", label: "Certificates", value: `${scheme} ${ends}`, sub: `soonest of ${n}`, short: `${scheme} ${days} ${days === 1 ? "day" : "days"}`, tone: "caution" };
    } else {
      certificates = { key: "certificates", label: "Certificates", value: `${n} on file`, sub: "none expiring", short: `${n} ${n === 1 ? "certificate" : "certificates"}`, tone: null };
    }
  }

  let sanctions: StatusRow;
  if (model.sanctioned) {
    const list = model.sanctions[0]?.list ?? "sanctions list";
    sanctions = { key: "sanctions", label: "Sanctions", value: `On the ${list}`, sub: model.sanctions[0]?.screenedOn ? `checked ${model.sanctions[0].screenedOn}` : null, short: "Sanctioned", tone: "sanction" };
  } else {
    const day = formatDay(model.sanctionsReadAt);
    const stale = day !== null && today.getTime() - Date.parse(model.sanctionsReadAt!) > SANCTIONS_MAX_AGE_MS;
    sanctions = { key: "sanctions", label: "Sanctions", value: "Not listed", sub: day ? `lists read ${day.replace(/ \d{4}$/, "")}${stale ? " · not re-read since" : ""}` : null, short: "Not listed", tone: stale ? "caution" : null };
  }
  return [safety, certificates, sanctions];
}

/** Whole days from a date to today, or null. */
export const daysSince = (iso: string | null | undefined, today: Date): number | null => {
  const d = daysUntil(iso, today);
  return d === null ? null : -d;
};

/** The customs window ends this many days ago, when that is more than a month: the records are behind. */
export function recordsEnd(v: Pick<VolzaExports, "window_end">, today: Date): number | null {
  const d = daysSince(v.window_end, today);
  return d !== null && d > 30 ? d : null;
}

/** "2 years" for a whole number of years in the window, else its months. */
export function windowSpan(v: Pick<VolzaExports, "window_start" | "window_end">): string {
  const a = new Date(`${v.window_start.slice(0, 10)}T00:00:00Z`);
  const b = new Date(`${v.window_end.slice(0, 10)}T00:00:00Z`);
  const months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth() + 1;
  if (!(months > 0)) return customsWindow(v);
  return months % 12 === 0 ? `${months / 12} ${months === 12 ? "year" : "years"}` : `${months} months`;
}

export type Tile = { label: string; value: string; sub: string | null };

const SHORT: Record<VolzaMarketName, string> = { "United Kingdom": "the UK", "United States": "the US", EU: "the EU", Canada: "Canada" };
const place = (raw: string | null | undefined) => (raw && raw !== "Not Available" ? raw : null);

/** "Mens knitted polo to the United States": a shipment in a few words. */
export function shipmentLine(s: VolzaShipment): string {
  const t = (s.product_description ?? "").replace(/\s+/g, " ").trim();
  const upper = (t.match(/[A-Z]/g) ?? []).length > (t.match(/[a-z]/g) ?? []).length;
  const what = t ? cap(upper ? t.toLowerCase() : t) : "Garments";
  const to = place(s.destination_country);
  return to ? `${what} to ${to}` : what;
}

/** The Overview's four tiles: value, shipments a month, buyers, and the stored shipment (latest only when 0140 says so). */
export function customsTiles(v: VolzaExports, today: Date): Tile[] {
  const tiles: Tile[] = [];
  if (v.fob_usd !== null) tiles.push({ label: `Export value, ${windowSpan(v)}`, value: formatUsdShort(v.fob_usd), sub: "Free on board, every line together" });
  const a = new Date(`${v.window_start.slice(0, 10)}T00:00:00Z`);
  const b = new Date(`${v.window_end.slice(0, 10)}T00:00:00Z`);
  const months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth() + 1;
  if (months > 0 && v.shipments / months >= 1.5) {
    tiles.push({ label: "Shipments a month", value: Math.round(v.shipments / months).toLocaleString("en-GB"), sub: `${v.shipments.toLocaleString("en-GB")} in all` });
  } else {
    tiles.push({ label: "Shipments", value: v.shipments.toLocaleString("en-GB"), sub: `in ${windowSpan(v)}` });
  }
  if (v.buyers !== null) tiles.push({ label: "Buyers", value: v.buyers.toLocaleString("en-GB"), sub: "named on the records" });
  const s = v.top_record ?? v.top_shipments[0] ?? null;
  if (s) {
    const latest = v.record_sort === "date";
    const day = formatDay(s.shipment_date?.slice(0, 10));
    const ago = daysSince(s.shipment_date, today);
    if (latest && day) tiles.push({ label: "Latest shipment", value: day.replace(/ \d{4}$/, ""), sub: `${shipmentLine(s)}${ago !== null ? `, ${ago} ${ago === 1 ? "day" : "days"} ago` : ""}` });
    else if (!latest && s.trade_value_usd !== null) tiles.push({ label: "Biggest shipment", value: formatUsdShort(s.trade_value_usd), sub: [shipmentLine(s), day].filter(Boolean).join(", ") });
  }
  return tiles;
}

export type MarketShare = { name: string; shipments: number; buyers: number | null; value: string | null; pct: number | null };

/** Where it goes: each market by value, then the rest of the world (what the total leaves over). */
export function marketShares(v: VolzaExports): MarketShare[] {
  const m = v.markets;
  if (!m) return [];
  const total = v.fob_usd;
  const rows: MarketShare[] = (Object.keys(m) as VolzaMarketName[])
    .filter((k) => (m[k]?.shipments ?? 0) > 0)
    .map((k) => {
      const x = m[k]!;
      return { name: k === "EU" ? "European Union" : k, shipments: x.shipments, buyers: x.buyers, value: x.fob_usd !== null ? formatUsdShort(x.fob_usd) : null, pct: total && x.fob_usd !== null ? Math.round((100 * x.fob_usd) / total) : null };
    })
    .sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0) || b.shipments - a.shipments);
  const known = Object.values(m).reduce((s, x) => s + (x?.fob_usd ?? 0), 0);
  const ships = v.shipments - Object.values(m).reduce((s, x) => s + (x?.shipments ?? 0), 0);
  if (total && ships > 0 && total - known > 0) rows.push({ name: "Rest of the world", shipments: ships, buyers: null, value: formatUsdShort(total - known), pct: Math.round((100 * (total - known)) / total) });
  return rows;
}

export type LineShipment = { market: string; buyer: string | null; what: string; code: string; day: string | null; value: string | null };

/** The top shipment to each market whose HS code is this line's: the only per-line customs figures there are. */
export function lineShipments(v: VolzaExports, hs: string): LineShipment[] {
  const m = v.markets ?? {};
  return (Object.keys(m) as VolzaMarketName[])
    .map((k) => ({ k, s: m[k]?.top ?? null }))
    .filter((x): x is { k: VolzaMarketName; s: VolzaShipment } => Boolean(x.s?.hsn_code?.startsWith(hs)))
    .sort((a, b) => (b.s.trade_value_usd ?? 0) - (a.s.trade_value_usd ?? 0))
    .map(({ k, s }) => ({
      market: SHORT[k],
      buyer: tidyBuyer(s.buyer_name),
      what: shipmentLine(s),
      code: `${s.hsn_code!.slice(0, 4)}.${s.hsn_code!.slice(4, 6)}`,
      day: formatDay(s.shipment_date?.slice(0, 10)),
      value: s.trade_value_usd !== null ? `US$${Math.round(s.trade_value_usd).toLocaleString("en-GB")}` : null,
    }));
}

/* ------------------------------------------------------------ needs a look */

/** "8 Oct", with the year only when it is not this year's. */
export function shortDay(iso: string | null | undefined, today: Date): string | null {
  const day = formatDay(iso);
  if (!day) return null;
  const year = ` ${today.getUTCFullYear()}`;
  return day.endsWith(year) ? day.slice(0, -year.length) : day;
}

/** One card under "Needs a look", worst first: the buildings behind on repairs, each certificate that lapsed or is about to, a stale sanctions read. */
export type LookCard = {
  key: string;
  kind: "safety" | "certificate" | "sanctions";
  /** The tab the card opens. */
  tab: "safety" | "certificates" | "sources";
  tag: string;
  title: string;
  progress: { label: string; pct: number } | null;
  /** The days left, set large. */
  figure: { n: number; words: string } | null;
  body: string | null;
  foot: string | null;
  footCaution: boolean;
};

export function lookCards(model: SupplierSheetModel, today: Date): LookCard[] {
  const out: LookCard[] = [];
  const cards = rscCards(model);
  const behind = cards.filter(rscBehind);
  const worst = behind[0];
  if (worst) {
    const many = cards.length > 1;
    out.push({
      key: "safety",
      kind: "safety",
      tab: "safety",
      tag: behind.length > 1 ? `Safety · ${behind.length} of ${cards.length} buildings` : many ? `Safety · ${worst.name}` : "Safety · RSC",
      title: behind.length > 1 ? `${countWord(behind.length)} buildings are behind on repairs` : many ? "One building is behind on repairs" : "Behind schedule on safety repairs",
      progress: worst.progress !== null ? { label: behind.length > 1 ? `Worst: ${worst.name}` : "Issues fixed", pct: worst.progress } : null,
      figure: null,
      body: worst.training ? `Worker safety ${worst.training}.` : null,
      foot: worst.readDate ? `Read ${worst.readDate}` : null,
      footCaution: false,
    });
  }
  for (const c of needsLook(certRows(model, today), today)) {
    const w = certWords(c.expiresOn, today, c.delistedOn);
    const days = daysUntil(c.expiresOn, today);
    out.push({
      key: `cert-${c.scheme}-${c.number ?? ""}-${c.expiresOn ?? ""}`,
      kind: "certificate",
      tab: "certificates",
      tag: `Certificate · ${c.scheme}`,
      title: w.label,
      progress: null,
      figure: w.state === "expiring" && days !== null && days > 0 ? { n: days, words: days === 1 ? "day left" : "days left" } : null,
      body: null,
      foot: c.check ? cap(c.check.text) : null,
      footCaution: Boolean(c.check?.caution),
    });
  }
  const read = model.sanctionsReadAt;
  const age = read ? today.getTime() - Date.parse(read) : 0;
  if (!model.sanctioned && read && age > SANCTIONS_MAX_AGE_MS) {
    const days = Math.floor(age / 86_400_000);
    out.push({
      key: "sanctions",
      kind: "sanctions",
      tab: "sources",
      tag: "Sanctions · freshness",
      title: `The sanctions check is ${days} ${days === 1 ? "day" : "days"} old`,
      progress: null,
      figure: null,
      body: `Not listed when the lists were last read on ${shortDay(read, today)}.`,
      foot: null,
      footCaution: false,
    });
  }
  return out;
}

/* ------------------------------------------------------------ certificates */

export type PhoneCert = CertRowData & { scope: string | null };
/** One card on the Certificates tab: a certificate, or every undated listing of one scheme together (OEKO-TEX publishes no end date). */
export type CertGroup = { scheme: string; state: ReturnType<typeof certWords>["state"]; label: string; listed: boolean; rows: PhoneCert[] };

export function certGroups(model: SupplierSheetModel, today: Date): CertGroup[] {
  const rows: PhoneCert[] = certRows(model, today).map((r, i) => ({ ...r, scope: model.certs[i]?.scope ?? null }));
  const out: CertGroup[] = [];
  for (const { c, w } of rankCerts(rows, today)) {
    const listed = !c.expiresOn && !c.delistedOn;
    const held = listed ? out.find((g) => g.listed && g.scheme === c.scheme) : undefined;
    if (held) held.rows.push(c);
    else out.push({ scheme: c.scheme, state: w.state, label: w.label, listed, rows: [c] });
  }
  return out;
}

/* --------------------------------------------------------- sanctions lists */

// The daily lists turn caution once a read is two days old; ILAB is weekly and the WRO list is a 2024 snapshot, so neither does.
const LISTS: { code: string; label: string; daily: boolean }[] = [
  { code: "ofac_sdn", label: "US Treasury (OFAC)", daily: true },
  { code: "ilab_tvpra", label: "US Labor (ILAB)", daily: false },
  { code: "eu_sanctions", label: "European Union", daily: true },
  { code: "uk_ofsi", label: "UK (OFSI)", daily: true },
  { code: "us_wro", label: "US withhold orders (WRO)", daily: false },
];

export type ListRead = { label: string; day: string; old: boolean };

/** Each sanctions list with the day it was last read in full. A list with no read on file is left out: nothing is said about it. */
export function sanctionListRows(model: Pick<SupplierSheetModel, "sanctionLists">, today: Date): ListRead[] {
  const reads = model.sanctionLists ?? [];
  return LISTS.flatMap((l) => {
    const at = reads.find((r) => r.list === l.code)?.last_read ?? null;
    const day = shortDay(at, today);
    return at && day ? [{ label: l.label, day, old: l.daily && today.getTime() - Date.parse(at) > SANCTIONS_MAX_AGE_MS }] : [];
  });
}

export const UFLPA_LABEL = "US forced labour (UFLPA)";

/**
 * The record's UFLPA line: "No link found · not a clearance · read 8 Oct", the day from the list's own
 * last full read. Null when no read is on file, so the record never says the list was not read. A
 * sanctioned record says only when the list was read: its matches are listed above the line.
 */
export function uflpaLine(model: Pick<SupplierSheetModel, "sanctioned" | "sanctionLists">, today: Date): string | null {
  const day = shortDay(model.sanctionLists?.find((r) => r.list === "uflpa")?.last_read, today);
  if (!day) return null;
  return model.sanctioned ? `read ${day}` : `No link found · not a clearance · read ${day}`;
}

/* ------------------------------------------------------------- no customs */

/**
 * What the Exports tab says with no customs record to draw. Null (say nothing) when the record has one
 * that the reader's plan does not include: the Recent shipments section says that. Otherwise the read
 * only tells us no matched record is on file, so the words claim no more: not that it was looked up,
 * not that the supplier does not export.
 */
export const NO_CUSTOMS = {
  title: "We have no customs records for this supplier yet",
  body: "That says nothing about whether it exports; it only means we have no receipt to show.",
  epbTitle: "Registered as an exporter with EPB",
  epbBody: "Ask for its export history in your RFQ.",
} as const;

export function noCustoms(model: Pick<SupplierSheetModel, "volza" | "shipments">): boolean {
  return !model.volza && model.shipments?.state !== "upgrade";
}
