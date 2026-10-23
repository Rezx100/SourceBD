// The words of the record on a desktop (Paper page 37, the full page and the pane beside the results):
// the nine sections and their counts, the export grid's four worked-out figures, the Checks rows, the
// certificate and safety tables, and the short forms the head carries. It reads the same model the
// phone reads and reuses the phone's wording wherever the two say the same thing; nothing here changes
// what the phone draws. A certificate that has ended is not counted, not in Checks and not in the head:
// its end date is our arithmetic on the last register read, which may predate it. Pure.

import { certShort } from "@/components/patterns/words";
import { customsWindow, daysUntil, formatDay, formatUsdShort, initials, type Buyer, type VolzaExports, type VolzaMarketName } from "@/lib/dashboard/facts";
import type { LocationRow, SupplierSheetModel } from "@/lib/dashboard/models";
import { certGroups, lookCards, phoneStatus, rscBehind, rscCards, shortDay, windowSpan, type CertGroup, type RscCard, type StatusRow, type Tone } from "./phone-words";
import { keyFacts, siteCards, staleWords, type KeyFact, type Membership, type SiteCard, type TabId } from "./words";

/** The sections, in page order. `tab` is the `?tab=` a link to the section carries: the seven the address already knows. */
export const SECTIONS = [
  { id: "overview", label: "Overview", tab: "overview" },
  { id: "exports", label: "Exports", tab: "exports" },
  { id: "products", label: "Products", tab: "products" },
  { id: "certificates", label: "Certificates", tab: "certificates" },
  { id: "checks", label: "Checks", tab: "certificates" },
  { id: "safety", label: "Safety", tab: "safety" },
  { id: "sites", label: "Sites", tab: "sites" },
  { id: "sources", label: "Sources", tab: "sources" },
  { id: "contact", label: "Contact", tab: "sources" },
] as const satisfies readonly { id: string; label: string; tab: TabId }[];
export type SectionId = (typeof SECTIONS)[number]["id"];

const n = (x: number) => x.toLocaleString("en-GB");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The record without the certificates that have ended: what the head, the count and Checks are worked out from. */
export function heldToday(model: SupplierSheetModel): SupplierSheetModel {
  const certs = model.certs.filter((c) => c.state !== "expired");
  return certs.length === model.certs.length ? model : { ...model, certs };
}

/** The count beside a section's name, or null: a section that holds nothing says no number. */
export function sectionCount(model: SupplierSheetModel, id: SectionId): number | null {
  const count =
    id === "certificates" ? heldToday(model).certs.length : id === "safety" ? rscCards(model).length : id === "sites" ? model.locations.length : id === "sources" ? model.sources.length : 0;
  return count > 0 ? count : null;
}

/** Safety, Certificates and Sanctions in a few words each; a sanctioned record leads with the sanction. */
export function headStatuses(model: SupplierSheetModel, today: Date): StatusRow[] {
  const rows = phoneStatus(heldToday(model), today);
  return model.sanctioned ? [...rows.filter((r) => r.key === "sanctions"), ...rows.filter((r) => r.key !== "sanctions")] : rows;
}

/** "Factory · founded 2015" and "Bhaluka, Mymensingh", apart: the page's head gives each its own glyph. */
export function headFacts(model: SupplierSheetModel): { type: string | null; buyingHouse: boolean; place: string | null } {
  const type = model.meta[0]?.text ?? null;
  const year = model.facts.find((f) => f.label === "Established")?.value ?? null;
  const parent = model.facts.find((f) => f.label === "Parent group")?.value ?? null;
  return {
    type: [type, year ? `founded ${year}` : null, parent ? `part of ${parent}` : null].filter(Boolean).join(" · ") || null,
    buyingHouse: /buying/i.test(type ?? ""),
    place: model.meta.find((m) => m.icon === "address")?.text ?? null,
  };
}

/* ---------------------------------------------------------- the export grid */

export type BarPart = { share: number; tone: "ink" | "ink-2" | "line-strong" | "sunken" };
export type ExportTile = { key: "value" | "typical" | "buyers" | "market"; label: string; value: string; bar: BarPart[] | null; sub: string | null };

const MARKETS: VolzaMarketName[] = ["EU", "United States", "United Kingdom", "Canada"];
const THE: Record<VolzaMarketName, string> = { "United Kingdom": "the UK", "United States": "the US", EU: "the EU", Canada: "Canada" };
const SHORT: Record<VolzaMarketName, string> = { "United Kingdom": "UK", "United States": "US", EU: "EU", Canada: "Canada" };

/** 27,059.6 is 27,000: a typical shipment is said to two figures, never to the dollar. */
function twoFigures(x: number): number {
  if (!(x > 0)) return 0;
  const step = 10 ** Math.max(0, Math.floor(Math.log10(x)) - 1);
  return Math.round(x / step) * step;
}

const two = (share: number): BarPart[] => [
  { share, tone: "ink-2" },
  { share: 100 - share, tone: "sunken" },
];

/**
 * The four tiles, each a figure worked out from the customs record, a bar that shows it and a few words.
 * `rank` is the share of exporters on record this one is bigger than (0 to 100), or null until it is read:
 * the first tile is then the value alone. `market` is the reader's own market, or null when it is not
 * known: the third tile then drops "N in the UK" and the fourth names the biggest market instead.
 * Unit prices are never printed.
 */
export function exportTiles(v: VolzaExports, { rank = null, market = null }: { rank?: number | null; market?: VolzaMarketName | null } = {}): ExportTile[] {
  const tiles: ExportTile[] = [];
  if (v.fob_usd !== null) {
    const pct = rank === null ? null : Math.max(0, Math.min(99, Math.round(rank)));
    tiles.push({ key: "value", label: `Export value, ${windowSpan(v)}`, value: formatUsdShort(v.fob_usd), bar: pct !== null ? two(pct) : null, sub: pct !== null && pct > 0 ? `Bigger than ${pct}% of exporters on record` : null });
    if (v.shipments > 0) {
      const small = v.small_orders && v.small_orders.of > 0 ? v.small_orders : null;
      const under = small ? Math.round((100 * small.shipments) / small.of) : null;
      tiles.push({
        key: "typical",
        label: "Typical shipment",
        value: `US$${n(twoFigures(v.fob_usd / v.shipments))}`,
        bar: under !== null ? two(under) : null,
        sub: small && under !== null ? `${under}% under ${n(small.under_pcs)} pieces` : `${n(v.shipments)} ${v.shipments === 1 ? "shipment" : "shipments"}`,
      });
    }
  } else {
    tiles.push({ key: "value", label: `Shipments, ${windowSpan(v)}`, value: n(v.shipments), bar: null, sub: null });
  }

  const m = v.markets ?? null;
  // Biggest by value first, so the two market bars read in one order.
  const held = m ? MARKETS.filter((k) => (m[k]?.shipments ?? 0) > 0).sort((a, b) => (m[b]!.fob_usd ?? 0) - (m[a]!.fob_usd ?? 0)) : [];
  const own = market && m?.[market] ? market : null;

  if (v.buyers !== null) {
    const split = held.filter((k) => (m![k]!.buyers ?? 0) > 0);
    const rest = v.buyers - split.reduce((s, k) => s + m![k]!.buyers!, 0);
    const bar: BarPart[] = split.map((k) => ({ share: m![k]!.buyers!, tone: k === own ? "ink" : "line-strong" }));
    if (rest > 0) bar.push({ share: rest, tone: "line-strong" });
    const mine = own ? (m![own]!.buyers ?? 0) : 0;
    const each = v.buyers > 0 && v.shipments > 0 ? Math.round(v.shipments / v.buyers) : 0;
    tiles.push({
      key: "buyers",
      label: "Buyers",
      value: n(v.buyers),
      bar: bar.length > 1 ? bar : null,
      sub: [mine > 0 ? `${n(mine)} in ${THE[own!]}` : null, each > 0 ? `${n(each)} ${each === 1 ? "shipment" : "shipments"} each` : null].filter(Boolean).join(" · ") || null,
    });
  }

  const total = v.fob_usd;
  const valued = held.filter((k) => m![k]!.fob_usd !== null);
  const about = own ?? valued[0] ?? null;
  if (about && m) {
    const x = m[about]!;
    const known = valued.reduce((s, k) => s + m[k]!.fob_usd!, 0);
    const bar: BarPart[] = valued.map((k) => ({ share: m[k]!.fob_usd!, tone: k === about ? "ink" : "line-strong" }));
    if (total && total - known > 0) bar.push({ share: total - known, tone: "line-strong" });
    const share = total && x.fob_usd !== null ? Math.round((100 * x.fob_usd) / total) : null;
    const words = [share !== null ? `${share}% of exports` : null, `${n(x.shipments)} ${x.shipments === 1 ? "shipment" : "shipments"}`].filter(Boolean).join(" · ");
    if (own && x.shipments === 0) tiles.push({ key: "market", label: `Ships to ${THE[own]}`, value: "No shipments", bar: null, sub: `in ${customsWindow(v)}` });
    else if (own) tiles.push({ key: "market", label: `Ships to ${THE[own]}`, value: x.fob_usd !== null ? formatUsdShort(x.fob_usd) : n(x.shipments), bar: bar.length > 1 ? bar : null, sub: words });
    else tiles.push({ key: "market", label: "Biggest market", value: SHORT[about], bar: bar.length > 1 ? bar : null, sub: words });
  }
  return tiles;
}

/** "Customs records, Sep 2024 – Aug 2026 · latest on record 30 Aug · read 11 Oct". Never "last shipped"; the window's end already says how far the records reach. */
export function customsFootLine(v: VolzaExports, today: Date): string {
  const stored = v.top_record ?? v.top_shipments[0] ?? null;
  const latest = v.record_sort === "date" ? shortDay(stored?.shipment_date?.slice(0, 10), today) : null;
  const read = shortDay(v.fetched_at, today);
  return [`Customs records, ${customsWindow(v)}`, latest ? `latest on record ${latest}` : null, read ? `read ${read}` : null].filter(Boolean).join(" · ");
}

/** The one line that opens the Exports section: what the figure is, and of what. */
export function exportsLead(v: VolzaExports): string {
  const ships = `${n(v.shipments)} ${v.shipments === 1 ? "shipment" : "shipments"}`;
  return v.fob_usd !== null ? `${formatUsdShort(v.fob_usd)} free on board across ${ships}, every product line together.` : `${ships} on record, every product line together.`;
}

/* ------------------------------------------------------------------ checks */

export type CheckRow = {
  key: string;
  kind: StatusRow["key"];
  /** The section the row opens. */
  section: SectionId;
  /** Nothing to look at: one quiet line. */
  quiet: boolean;
  tone: Tone;
  tag: string;
  title: string;
  body: string | null;
  figure: { pct: number; words: string } | { n: number; words: string } | null;
  foot: string | null;
  footCaution: boolean;
};

const OPENS: Record<StatusRow["key"], SectionId> = { safety: "safety", certificates: "certificates", sanctions: "sources" };

/**
 * Safety, Certificates and Sanctions, each said once: the full row with its figure when it needs a look,
 * one quiet line when it does not. `looks` is how many need a look ("3 need a look").
 */
export function checkRows(model: SupplierSheetModel, today: Date): { rows: CheckRow[]; looks: number } {
  const held = heldToday(model);
  const looks = lookCards(held, today);
  const cards = rscCards(model);
  const rows = headStatuses(model, today).flatMap((s): CheckRow[] => {
    const mine = looks.filter((c) => (c.kind === "certificate" ? "certificates" : c.kind) === s.key);
    if (mine.length > 0) {
      return mine.map((c) => ({
        key: c.key,
        kind: s.key,
        section: OPENS[s.key],
        quiet: false,
        tone: "caution",
        tag: c.tag,
        title: c.title,
        // "Worst: Unit 2. Worker safety training yet to start.": the bar's own label is the building it is of.
        body: [c.progress && /^Worst: /.test(c.progress.label) ? `${c.progress.label}.` : null, c.body].filter(Boolean).join(" ") || null,
        figure: c.progress ? { pct: c.progress.pct, words: "of issues fixed" } : c.figure,
        foot: c.foot,
        footCaution: c.footCaution,
      }));
    }
    const worst = s.key === "safety" ? (cards[0] ?? null) : null;
    return [
      {
        key: s.key,
        kind: s.key,
        section: OPENS[s.key],
        quiet: s.tone !== "sanction",
        tone: s.tone === "sanction" ? "sanction" : null,
        tag: s.label,
        title: s.value,
        // The figure says the percentage; the line under the title does not repeat it.
        body: worst && worst.progress !== null && cards.length === 1 ? null : s.sub ? cap(s.sub) : null,
        figure: worst && worst.progress !== null ? { pct: worst.progress, words: "of issues fixed" } : null,
        foot: null,
        footCaution: false,
      },
    ];
  });
  return { rows, looks: looks.length };
}

/* ------------------------------------------------------------ certificates */

export type CertLine = {
  key: string;
  /** The row's id, so a link from the Compliance pages lands on it. */
  anchor: string | null;
  scheme: string;
  /** What the state column says, and whether it is a pill: a pill only ever means "this needs a look". */
  state: string;
  look: boolean;
  until: string | null;
  issuer: string | null;
  checked: string | null;
  /** Under the day: "108 days ago" when the check is late, "before it ended" for one that has ended since. */
  checkedNote: string | null;
  doc: { href: string; label: "Certificate" | "Listing" } | null;
  numberLabel: string;
  numbers: string[];
  /**
   * The desktop's State column, the state and its end date said once (founder's video, 23 Oct 2026): "Exp 20 Jan
   * 2027", "Listed", "No longer listed", "Ended 4 Apr 2026". The phone keeps `state` and `until`.
   */
  expiry: string;
  /**
   * The desktop's Last checked pill: how long ago the issuer last showed it, the day for its title, and its tone:
   * listed when checked, no longer listed, or a certificate that has ended. Null when it was never checked.
   */
  ago: { words: string; day: string; tone: "listed" | "dropped" | "ended" } | null;
};

/** "WRAP" issued by WRAP says nothing: the issuer is named only when it is someone other than the scheme. */
export const issuedBy = (c: Pick<CertLine, "issuer" | "scheme">) => (c.issuer && c.issuer.split(/\s+/)[0]!.toLowerCase() !== c.scheme.split(/\s+/)[0]!.toLowerCase() ? c.issuer : null);

function certLine(g: CertGroup, model: SupplierSheetModel, today: Date, ended: boolean): CertLine {
  const c = g.rows[0]!;
  const kind = model.certs.find((x) => x.scheme === c.scheme && x.number === c.number)?.kind ?? "";
  const check = model.certChecks?.certs.find((k) => k.kind === kind && k.certificate_no === c.number) ?? null;
  const at = check?.checked_at ?? null;
  const late = at && c.check?.caution ? Math.floor((today.getTime() - Date.parse(at)) / 86_400_000) : null;
  const numbers = g.rows.flatMap((r) => (r.number ? [r.number] : []));
  const gots = /^gots/i.test(g.scheme);
  const word = g.listed ? "Listing" : gots ? "Licence" : "Certificate";
  const state = ended ? `Ended ${formatDay(c.expiresOn) ?? ""}`.trim() : g.listed ? (g.rows.length > 1 ? `${g.rows.length} listings` : "Listed") : certShort(c.expiresOn, today, c.delistedOn);
  const until = formatDay(c.expiresOn);
  const ago = at ? Math.max(0, Math.floor((today.getTime() - Date.parse(at)) / 86_400_000)) : null;
  return {
    key: `${g.scheme}-${c.number ?? ""}-${c.expiresOn ?? ""}`,
    anchor: c.anchor ?? null,
    scheme: g.scheme,
    state,
    expiry: ended || g.listed || c.delistedOn || !until ? state : daysUntil(c.expiresOn, today) === 0 ? "Expires today" : `Exp ${until}`,
    ago: at && ago !== null ? { words: ago === 0 ? "Today" : `${ago} ${ago === 1 ? "day" : "days"} ago`, day: formatDay(at) ?? "", tone: ended ? "ended" : c.delistedOn ? "dropped" : "listed" } : null,
    look: !ended && g.state !== "valid",
    until,
    issuer: c.issuer,
    checked: shortDay(at, today),
    checkedNote: ended && at && c.expiresOn && at.slice(0, 10) < c.expiresOn.slice(0, 10) ? "before it ended" : late !== null && late > 0 ? `${late} ${late === 1 ? "day" : "days"} ago` : null,
    doc: c.documentUrl ? { href: c.documentUrl, label: gots && !g.listed ? "Certificate" : "Listing" } : null,
    numberLabel: numbers.length > 1 ? `${word}s` : word,
    numbers,
  };
}

/**
 * The certificate table: those held today, soonest expiry first, then the ones that have ended in a group
 * of their own that is not counted. A certificate its body stopped listing while it is in date stays in the
 * table with its pill: the register said so, which an end date worked out from an old read does not.
 */
export function certTable(model: SupplierSheetModel, today: Date): { held: CertLine[]; ended: CertLine[]; count: number } {
  const groups = certGroups(model, today);
  // Ended by its own date, the same test `heldToday` makes; one its body stopped listing while in date is still held.
  const isEnded = (g: CertGroup) => (daysUntil(g.rows[0]!.expiresOn, today) ?? 0) < 0;
  const held = groups.filter((g) => !isEnded(g));
  return {
    held: held.map((g) => certLine(g, model, today, false)),
    ended: groups.filter(isEnded).map((g) => certLine(g, model, today, true)),
    count: held.reduce((s, g) => s + g.rows.length, 0),
  };
}

/* ------------------------------------------------------------------ safety */

const REPORT: Record<string, string> = { CAP: "Action plan" };

export type SafetyLine = {
  key: string;
  name: string;
  ref: string | null;
  status: string | null;
  behind: boolean;
  progress: number | null;
  training: string | null;
  /** "good" once completed, "look" while it has not started; anything else is plain. */
  trainingTone: "good" | "look" | null;
  read: string | null;
  reports: { label: string; href: string; plan: boolean }[];
  missing: string | null;
};

/** The RSC buildings as table rows, worst first (the phone's order). */
export function safetyLines(model: SupplierSheetModel, today: Date): SafetyLine[] {
  return rscCards(model).map((c: RscCard, i) => {
    const training = c.training ? cap(c.training.replace(/^training /, "")) : null;
    const absent = c.links.filter((l) => !l.href).map((l) => (REPORT[l.label] ?? l.label).toLowerCase());
    return {
      key: `${c.name}-${i}`,
      name: c.name,
      ref: c.ref,
      status: c.status ? cap(c.status) : null,
      behind: rscBehind(c),
      progress: c.progress,
      training,
      trainingTone: training && /complete/i.test(training) ? "good" : training && /yet|not start/i.test(training) ? "look" : null,
      read: dayOnly(c.readDate, today),
      reports: c.links.flatMap((l) => (l.href ? [{ label: REPORT[l.label] ?? l.label, href: l.href, plan: l.label === "CAP" }] : [])),
      missing: absent.length ? `No ${absent.join(", ")} report on the register` : null,
    };
  });
}

/** "2 buildings in the RSC programme. 2 behind schedule. Worst first." */
export function safetyLead(lines: readonly SafetyLine[]): string | null {
  if (lines.length < 2) return null;
  const behind = lines.filter((l) => l.behind).length;
  return `${lines.length} buildings in the RSC programme.${behind ? ` ${behind} behind schedule.` : ""} Worst first.`;
}

/* ---------------------------------------------------------------- overview */

export type FactCell = { label: string; value: string; from: string | null; empty: boolean };
export type MemberTile = Membership & { title: string; read: string | null; stale: string | null; href: string | null };
export type BuyerTile = Buyer & { letters: string; read: string | null; href: string | null };

const NOT_CELLS = new Set(["Memberships", "Brand supplier lists", "Buyers in shipment records"]);

const sourceOf = (model: SupplierSheetModel, code: string | null) => (code ? (model.sources.find((s) => s.mark.code === code || s.mark.label === code) ?? null) : null);
/** "24 Jul" for a day this year, "24 Jul 2025" for any other: a bare day and month must not make an old read look recent. */
function dayOnly(words: string | null, today: Date): string | null {
  if (!words) return null;
  const year = ` ${today.getUTCFullYear()}`;
  return words.endsWith(year) ? words.slice(0, -year.length) : words;
}

/** Key facts as cells: what it is, the figure, who filed it. Memberships and buyers have their own tiles. */
export function factCells(model: SupplierSheetModel): FactCell[] {
  return keyFacts(model)
    .filter((f: KeyFact) => !NOT_CELLS.has(f.label))
    .map((f) => ({ label: f.label, value: f.values.length ? f.values.map((x) => x.text).join(", ") : (f.empty ?? ""), from: f.source, empty: f.values.length === 0 }));
}

/** The registers it is a member of: the register's mark, the membership, its number, when it was read. */
export function memberTiles(model: SupplierSheetModel, today: Date): MemberTile[] {
  const members = keyFacts(model).find((f) => f.label === "Memberships")?.values.flatMap((x) => (x.membership ? [x.membership] : [])) ?? [];
  return members.map((m) => {
    const s = sourceOf(model, m.mark);
    const stale = staleWords(s?.readDate ?? null, today);
    return { ...m, title: [m.name, m.qualifier].filter(Boolean).join(" "), read: stale ? null : dayOnly(s?.readDate ?? null, today), stale, href: s?.mark.href ?? null };
  });
}

/** Who buys from it, one tile each: the brand's own list where it names the supplier, else the customs record. */
export function buyerTiles(model: SupplierSheetModel, buyers: readonly Buyer[], today: Date): BuyerTile[] {
  return buyers.map((b) => {
    const s = b.listed ? sourceOf(model, b.name) : null;
    return { ...b, letters: initials(b.name), read: dayOnly(s?.readDate ?? null, today), href: s?.mark.href ?? null };
  });
}

/**
 * The trade body the product names were filed with, and when it was read. The record does not say which
 * register filed them, so a body is named only when it is the one trade body the record holds; with
 * several, or none, the heading says "As filed" and no more.
 */
export function filedWith(model: SupplierSheetModel, today: Date): { body: string | null; read: string | null } {
  const held = ["BGMEA", "BKMEA", "BGAPMEA", "BTMA"].flatMap((code) => sourceOf(model, code) ?? []);
  const s = held.length === 1 ? held[0]! : null;
  return { body: s?.mark.label ?? null, read: dayOnly(s?.readDate ?? null, today) };
}

/* ------------------------------------------------------------------- sites */

export type SiteLine = Pick<SiteCard, "n" | "kind" | "address" | "pin"> & { site: string; /** What kind of office the registers call it ("registered and mailing"), or null. */ detail: string | null; from: string | null; approx: boolean };

/** The premises as table rows, numbered as the map's pins are (`siteCards`: pinned ones first). */
export function siteLines(locations: readonly LocationRow[]): SiteLine[] {
  // The same order `siteCards` puts them in, to read each row's registers beside its card.
  const ordered = [...locations].sort((a, b) => Number(Boolean(b.pin)) - Number(Boolean(a.pin)));
  return siteCards(locations).map((c, i) => {
    const l = ordered[i]!;
    const office = c.kind === "office";
    return { n: c.n, kind: c.kind, address: c.address, pin: c.pin, site: office ? "Office" : "Factory", detail: office && l.kind !== "Address" ? l.kind.toLowerCase().replace(/ · /g, " and ").replace(/ ?office$/, "") || null : null, from: l.marks.map((m) => m.label).join(", ") || null, approx: c.kind === "factory-approx" };
  });
}
