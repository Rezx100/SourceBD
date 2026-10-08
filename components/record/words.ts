// The words of the supplier record (B4c, Paper `10 · Record pane`, `Record full page`, `11 ·
// Record`): the tabs and their counts, the five-cell summary, the first line under the name, what
// "needs a look", and how a fact says where it came from. Everything is worked out from the
// record's own model, so nothing here can say more than the registers filed: where the model
// carries no figure the cell says so, and says nothing about a date it does not hold. Pure.

import type { CertRowData } from "@/components/patterns";
import { ABSENT, SITE_WORDS, rankCerts, isApproximate, type SiteKind } from "@/components/patterns/words";
import { certCheckLine, certRowId, formatDay } from "@/lib/dashboard/facts";
import type { CertState } from "@/components/kit";
import type { FactRow, LocationRow, ProductSheetModel, SitePin, SupplierSheetModel } from "@/lib/dashboard/models";
import type { SourceMarkModel } from "@/lib/dashboard/source-tiers";

export const TABS = [
  { id: "overview", label: "Overview" },
  { id: "certificates", label: "Certificates" },
  { id: "safety", label: "Safety" },
  { id: "sites", label: "Sites" },
  { id: "sources", label: "Sources" },
  { id: "products", label: "Products" },
] as const;
export type TabId = (typeof TABS)[number]["id"];

/** `?tab=` as the page reads it: anything that is not a tab is the Overview. */
export function parseTab(raw: string | string[] | null | undefined): TabId {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return TABS.find((t) => t.id === v)?.id ?? "overview";
}

/**
 * The section a reader is in, as the tabs mark it while the record scrolls: the first section (in
 * page order) crossing the reading band under the sticky tabs; at the very foot, the last one (a
 * short last section never reaches the band); with nothing in the band, wherever they were.
 */
export function sectionInView<T>(order: readonly T[], inBand: ReadonlySet<T>, atEnd: boolean, prev: T): T {
  if (atEnd && order.length > 0) return order[order.length - 1]!;
  return order.find((id) => inBand.has(id)) ?? prev;
}

/** `?site=` as the page reads it: a whole number from 1, or null. */
export function parseSite(raw: string | string[] | null | undefined): number | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v && /^[1-9]\d{0,2}$/.test(v) ? Number(v) : null;
}

/** The count a tab carries, or null: a tab that holds nothing says no number rather than "0". */
export function tabCount(model: SupplierSheetModel, id: TabId): number | null {
  const n =
    id === "certificates"
      ? model.certs.length
      : id === "sites"
        ? model.locations.length
        : id === "sources"
          ? model.sources.length
          : id === "products"
            ? model.products.lines || model.products.productListCount
            : 0;
  return n > 0 ? n : null;
}

const fact = (model: SupplierSheetModel, label: string): FactRow | undefined => model.facts.find((f) => f.label === label);

/** One name however it is cased, spaced or punctuated: "ABONI KNITWEAR LTD." is "Aboni Knitwear Ltd". */
export function sameName(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  return norm(a) === norm(b);
}

/** The facts the first line under the name says; Key facts starts after them. */
const SUBLINE_FACTS = new Set(["Type", "Parent group", "Established"]);

/** "Factory · Savar, Dhaka · founded 1985 · part of Babylon Group": only what the record holds. */
export function recordSubline(model: SupplierSheetModel): string {
  const type = model.meta[0]?.text ?? null;
  const place = model.meta.find((m) => m.icon === "address")?.text ?? null;
  const year = fact(model, "Established")?.value ?? null;
  const parent = fact(model, "Parent group")?.value ?? null;
  return [type, place, year ? `founded ${year}` : null, parent ? `part of ${parent}` : null].filter(Boolean).join(" · ");
}

export type SummaryCell = {
  key: "sanctions" | "certificates" | "rsc" | "workers" | "sources";
  label: string;
  /** The figure or state; `ABSENT.dash` for nothing on file, with `valueWords` for a screen reader. */
  value: string;
  valueWords?: string;
  /** What the value's colour and glyph say: a problem is never colour alone. A date that passed is caution, never danger. */
  tone?: "caution" | "sanction";
  /** With `caution`: the date has passed (the XCircle), not only approaches (the clock). */
  lapsed?: boolean;
  /** The value opens something: the Sources cell is a link to the Sources tab (the aside no longer repeats the list). */
  href?: string;
  /** The line under the value carries a defined word ("100% fixed"): the glossary term `Define` explains it with. */
  subTerm?: string;
  sub: string | null;
};

const namesOf = (names: string[]): string => (names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);

/** Spec-etl-freshness §3: the lists are read daily; past 48 hours the cell says when, not that it is current. */
export const SANCTIONS_MAX_AGE_MS = 48 * 3600 * 1000;

/** "Not listed" is what we found on the lists we read, so it always carries when we read them (never "clear"). */
function notListed(readAt: string | null, today: Date): SummaryCell {
  const cell: SummaryCell = { key: "sanctions", label: "Sanctions", value: "Not listed", sub: null };
  if (!readAt) return cell;
  const day = formatDay(readAt);
  if (!day) return cell;
  return today.getTime() - new Date(readAt).getTime() > SANCTIONS_MAX_AGE_MS
    ? { ...cell, tone: "caution", sub: `lists last read ${day} · not re-read since` }
    : { ...cell, sub: `on the lists read ${day}` };
}

/** The summary strip. Nothing is scored: each cell is a count or a state the registers hold. */
export function summaryCells(model: SupplierSheetModel, today: Date): SummaryCell[] {
  const hit = model.sanctions[0] ?? null;
  const list = hit?.list ?? "sanctions list";
  const sanctions: SummaryCell = model.sanctioned
    ? { key: "sanctions", label: "Sanctions", value: `On the ${list}`, tone: "sanction", sub: `From the ${list}${hit?.screenedOn ? ` · checked ${hit.screenedOn}` : ""}` }
    : notListed(model.sanctionsReadAt, today);

  // Ranked worst first, so the strip names the same first scheme "Needs a look" and every list lead with.
  const ranked = rankCerts(model.certs, today);
  const expired = ranked.filter((s) => s.w.state === "expired");
  const expiring = ranked.filter((s) => s.w.state === "expiring");
  const problems = expired.length ? expired : expiring;
  const certificates: SummaryCell =
    model.certs.length === 0
      ? { key: "certificates", label: "Certificates", value: ABSENT.dash, valueWords: ABSENT.certificates, sub: model.certsEmptyChip }
      : {
          key: "certificates",
          label: "Certificates",
          value: expired.length ? `${model.certs.length} · ${expired.length} expired` : expiring.length ? `${model.certs.length} · ${expiring.length} expiring` : String(model.certs.length),
          tone: expired.length || expiring.length ? "caution" : undefined,
          lapsed: expired.length > 0,
          sub: problems.length ? namesOf([...new Set(problems.map((p) => p.c.scheme))]) : namesOf([...new Set(model.certs.map((c) => c.scheme))]),
        };

  const rsc: SummaryCell = model.rsc
    ? { key: "rsc", label: "RSC", value: "Covered", sub: model.rsc.progress !== null ? `${model.rsc.progress}% fixed` : model.rsc.status, subTerm: model.rsc.progress !== null ? "fixed" : undefined }
    : { key: "rsc", label: "RSC", value: "Not covered", sub: model.rscBuildings.length > 0 ? "its buildings have a record" : "no RSC record" };

  const w = fact(model, "Workers");
  const workers: SummaryCell = w?.value
    ? { key: "workers", label: "Workers", value: w.value, sub: w.note ?? (w.marks?.length ? `from ${w.marks.map((m) => m.label).join(", ")}` : null) }
    : { key: "workers", label: "Workers", value: ABSENT.dash, valueWords: ABSENT.published, sub: `${ABSENT.published} · ask in your RFQ` };

  const one = model.sources.length === 1 ? model.sources[0]! : null;
  const sources: SummaryCell = {
    key: "sources",
    label: "Sources",
    value: String(model.sourceCount),
    sub: one ? [one.mark.label, one.readDate].filter(Boolean).join(" · ") : model.readDate ? `read ${model.readDate}` : null,
  };
  return [sanctions, certificates, rsc, workers, sources];
}

/** The certificates as the certificate table takes them; OEKO-TEX has a label check, not a certificate. */
export function certRows(model: SupplierSheetModel, now: Date = new Date()): CertRowData[] {
  const checks = model.certChecks;
  return model.certs.map((c) => {
    const check = checks?.certs.find((k) => k.kind === c.kind && k.certificate_no === c.number);
    const newer = model.certs.some((o) => o !== c && o.kind === c.kind && (o.expiresOn ?? "") > (c.expiresOn ?? ""));
    const delisted = check?.listing_status === "no_longer_listed";
    const line = checks ? certCheckLine(c.kind, c.expiresOn, check, checks.reads, now, newer) : null;
    // A GOTS link is the directory's page for the supplier, which errors once GOTS stops listing it. So it is
    // linked only on a check that is in date and found it listed: never expired, delisted, overdue or unread.
    const gots = c.kind.toLowerCase() === "gots";
    const gotsOpen = line !== null && !line.caution && c.state !== "expired";
    return {
      delistedOn: delisted ? (check?.delisted_at ?? now.toISOString()) : null,
      check: line,
      scheme: c.scheme,
      number: c.number,
      issuer: c.issuer,
      expiresOn: c.expiresOn,
      documentUrl: gots && !gotsOpen ? null : c.documentUrl,
      documentLabel: gots ? "Open on GOTS" : undefined,
      anchor: certRowId(c.kind, c.number, c.expiresOn),
    };
  });
}

/** Certificates a buyer should look at first: expired (the latest lapse leading), then expiring (the soonest), in `rankCerts`'s one order. A valid or undated one is on the Certificates tab. */
export function needsLook(rows: CertRowData[], today: Date): CertRowData[] {
  return rankCerts(rows, today)
    .filter((r) => r.w.state === "expired" || r.w.state === "expiring")
    .map((r) => r.c);
}

/** The facts the Overview lists: the record's own, in its order, under the words Paper uses. */
const LABEL: Record<string, string> = { Established: "Founded", Registers: "Memberships", "Capacity, as filed": "Capacity", "Factory address": "Address" };

/** One registration as its line draws it: the register's mark and short name, then its number. */
export type Membership = { mark: string | null; name: string; qualifier: string | null; number: string | null };

export type KeyFact = {
  label: string;
  values: { text: string; mono: boolean; membership?: Membership }[];
  source: string | null;
  /** The record holds the fact but no register is linked to it: the pending mark, never a sentence. */
  pending: boolean;
  empty: string | null;
};

/** "Source pending · 3": the one legend under Key facts, or null when every fact names its register. */
export function pendingLegend(facts: readonly KeyFact[]): string | null {
  const n = facts.filter((f) => f.pending).length;
  return n > 0 ? `Source pending · ${n}` : null;
}

/** "BGMEA General" is the register and the class of member; "EPB Reg" is the register alone ("Reg" says nothing beside a number). */
function membership(i: NonNullable<FactRow["items"]>[number]): Membership {
  const short = i.mark?.label ?? "";
  const own = short !== "" && i.label.toLowerCase().startsWith(short.toLowerCase());
  const rest = own ? i.label.slice(short.length).trim().replace(/^reg\.?$/i, "") : "";
  return { mark: i.mark?.code ?? null, name: own ? short : i.label, qualifier: rest || null, number: i.code };
}

export function keyFacts(model: SupplierSheetModel): KeyFact[] {
  // Rows that only say "not on file" are left out when they are extras: Paper's almost-empty record lists what it has and the few a buyer asks for.
  const optional = new Set(["Registered name", "Parent group", "EPZ zone", "Women · men", "Sewing machines", "Capacity, as filed"]);
  // The address is the Sites tab's: one clean address per premises. The Overview prints the register's
  // own ALL-CAPS text only when there is no site to show there (RC-09).
  const sited = model.locations.length > 0;
  // The Type fact is "Factory · Dyeing, Knit": the subline said "Factory", so only the factory types stay, under their own label.
  const type = model.meta[0]?.text ?? null;
  const rows = model.facts
    .map((f) => (f.label === "Type" && f.value && type && f.value.startsWith(`${type} · `) ? { ...f, label: "Factory types", value: f.value.slice(type.length + 3) } : f))
    .filter(
    (f) =>
      !(f.label === "Registered name" && f.value && sameName(f.value, model.name)) &&
      !(optional.has(f.label) && !f.value && !f.items?.length) &&
      !(sited && f.label === "Factory address") &&
      // The subline said these (type · place · founded · group): Key facts starts at what it did not say.
      !(SUBLINE_FACTS.has(f.label) && f.value),
  );
  const out: KeyFact[] = rows.map((f) => {
    // A list of registrations names its register on every line, so "From EPB, BGMEA" under it would say it twice.
    const from = f.items?.length ? null : f.marks?.length ? `From ${f.marks.map((m) => m.label).join(", ")}` : null;
    const source = [from, f.note ?? null].filter(Boolean).join(" · ") || null;
    const values = f.items?.length
      ? f.items.map((i) => ({ text: [i.label, i.code].filter(Boolean).join(" reg. no. "), mono: Boolean(i.code), membership: membership(i) }))
      : f.value
        ? [{ text: f.value, mono: Boolean(f.code) }]
        : [];
    return {
      label: LABEL[f.label] ?? f.label,
      values,
      source: values.length ? source : null,
      pending: values.length > 0 && !f.items?.length && !f.marks?.length && Boolean(f.pendingSource),
      empty: values.length ? null : [f.empty ?? ABSENT.onFile, f.checked ?? null].filter(Boolean).join(" · "),
    };
  });
  // What it makes and exports is on the Products tab; the Overview says so only when there is nothing to open.
  const p = model.products;
  if (p.productListCount === 0) out.push({ label: "Products", values: [], source: null, pending: false, empty: "Not published. Ask in your RFQ." });
  if (p.lines === 0) out.push({ label: "Exports", values: [], source: null, pending: false, empty: p.linesUnknown ? "The export lines could not be read." : p.onEpb ? "On the EPB exporter register · no lines on file" : "Not on the EPB exporter list" });
  const lists = model.products.buyerLists;
  out.push({
    label: "Brand supplier lists",
    values: lists.length ? [{ text: lists.join(", "), mono: false }] : [],
    source: lists.length ? "From the brands' disclosure lists" : null,
    pending: false,
    empty: lists.length ? null : model.products.buyerListsEmpty,
  });
  return out;
}

const joined = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

/** One site as the Sites tab draws it: the card and, when the cache holds one, its pin. */
export type SiteCard = {
  n: number;
  kind: SiteKind;
  /** The kind line over the address: "Factory · pinned to the address", "Office · mailing address". */
  words: string;
  address: string;
  note: string;
  pin: SitePin | null;
};

/**
 * The premises as cards, pinned ones first so that a card's number is its pin's number on the map.
 * A site is "approximate" by the one rule in `isApproximate` (confidence below 70, or none). Where the
 * pins were not read at all, no card says anything about a pin. One address per premises: the registry's
 * other spellings are never printed (RC-09).
 */
export function siteCards(locations: readonly LocationRow[]): SiteCard[] {
  const read = locations.some((l) => l.pin !== undefined);
  const ordered = [...locations].sort((a, b) => Number(Boolean(b.pin)) - Number(Boolean(a.pin)));
  return ordered.map((l, i) => {
    const office = l.office ?? /registered|office|mailing/i.test(l.kind);
    const from = l.marks.length ? `From ${joined(l.marks.map((m) => m.label))}` : "From the record's own address";
    const approx = Boolean(l.pin) && !office && isApproximate(l.pin!.confidencePct);
    const kind: SiteKind = office ? "office" : approx ? "factory-approx" : "factory-exact";
    const detail = l.kind.toLowerCase().replace(/ · /g, " and ");
    return {
      n: i + 1,
      kind,
      words: office
        ? l.kind === "Address" ? "Office" : `Office · ${detail}`
        : !read
          ? l.kind
          : l.pin
            ? SITE_WORDS[kind]
            : "Factory · not pinned yet",
      address: l.address,
      note: approx ? "The pin marks the area, not the building." : from,
      pin: l.pin ?? null,
    };
  });
}

/** "2 factory sites and 1 office": what the tab holds, in words. */
export function siteSummary(cards: readonly SiteCard[]): string {
  const offices = cards.filter((c) => c.kind === "office").length;
  const factories = cards.length - offices;
  return joined([factories ? `${factories} factory ${factories === 1 ? "site" : "sites"}` : "", offices ? `${offices} ${offices === 1 ? "office" : "offices"}` : ""].filter(Boolean));
}

/** "24 Jul 2026" to the UTC day it names, for the 90-day test; null when it is not a date. */
export function dayOfWords(words: string | null): string | null {
  if (!words) return null;
  const t = Date.parse(`${words} UTC`);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/** A register read more than 90 days ago is stale: its date turns caution, with an hourglass and in words. */
export function isStale(readDate: string | null, today: Date): boolean {
  return staleWords(readDate, today) !== null;
}

/**
 * "read 102 days ago" for a register read more than 90 days ago, else null. Its own words and glyph (the
 * hourglass), so the clock keeps one meaning on the record: a certificate that expires soon.
 */
export function staleWords(readDate: string | null, today: Date): string | null {
  const iso = dayOfWords(readDate);
  if (iso === null) return null;
  const days = Math.floor((today.getTime() - Date.parse(iso)) / 86_400_000);
  return days > 90 ? `read ${days} days ago` : null;
}

/* ------------------------------------------------------------------- a line */

/** The caption every single photo carries: it is the catalogue's, never the supplier's own product. */
export const PHOTO_CAPTION = "Illustrative photo, keyed to the HS code";

/**
 * What the line says it is, over its heading. "EPB export line" is a claim about this record's EPB
 * page, so a heading the record does not export gets the plain wording, and a read that failed says so.
 */
export function lineEyebrow(model: Pick<ProductSheetModel, "hs" | "exported" | "linesUnknown">): string {
  return `HS ${model.hs}${model.exported ? " · EPB export line" : model.linesUnknown ? " · EPB lines could not be read" : " · not on this record's EPB page"}`;
}

/** One fact of a line as the fact list draws it. */
export type LineFact = {
  label: string;
  values: { text: string; mono: boolean; href: string | null }[];
  /** The registers it is from, linked where the record carries the page. */
  marks: SourceMarkModel[];
  /** The payload does not attribute the fact to a register yet. */
  pending: boolean;
  note: string | null;
  /** What the certified scope's certificate is doing: a state and its words. */
  badge: { state: CertState; label: string } | null;
  /** In place of a value: what is missing, then why, then what was checked. */
  empty: string | null;
};

/** The line's facts, in the model's order. A missing value says so in words; nothing is left out. */
export function lineFacts(facts: readonly FactRow[]): LineFact[] {
  return facts.map((f) => {
    const values = f.items?.length
      ? f.items.map((i) => ({ text: [i.label, i.code].filter(Boolean).join(" reg. no. "), mono: Boolean(i.code), href: null }))
      : f.value
        ? [{ text: f.value, mono: Boolean(f.code), href: f.href ?? null }]
        : [];
    const badge = f.badge ? { state: f.badge.tone === "positive" ? ("valid" as const) : f.badge.tone === "type" ? ("none" as const) : /^expired/i.test(f.badge.label) ? ("expired" as const) : ("expiring" as const), label: f.badge.label } : null;
    return {
      label: f.label,
      values,
      marks: f.marks ?? [],
      pending: Boolean(f.pendingSource) && !(f.marks && f.marks.length > 0),
      note: f.note ?? null,
      badge,
      empty: values.length ? null : [f.empty ?? ABSENT.onFile, f.note ?? null, f.checked ?? null].filter(Boolean).join(" · "),
    };
  });
}
