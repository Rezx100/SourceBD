// The words of the supplier record (B4c, Paper `10 · Record pane`, `Record full page`, `11 ·
// Record`): the tabs and their counts, the five-cell summary, the first line under the name, what
// "needs a look", and how a fact says where it came from. Everything is worked out from the
// record's own model, so nothing here can say more than the registers filed: where the model
// carries no figure the cell says so, and says nothing about a date it does not hold. Pure.

import type { CertRowData } from "@/components/patterns";
import { certWords } from "@/components/patterns/words";
import { certRowId } from "@/lib/dashboard/facts";
import type { FactRow, SupplierSheetModel } from "@/lib/dashboard/models";

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
  value: string;
  /** What the value's colour and glyph say: a problem is never colour alone. */
  tone?: "danger" | "caution" | "sanction";
  sub: string | null;
};

const namesOf = (names: string[]): string => (names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);

/** The summary strip. Nothing is scored: each cell is a count or a state the registers hold. */
export function summaryCells(model: SupplierSheetModel, today: Date): SummaryCell[] {
  const hit = model.sanctions[0] ?? null;
  const list = hit?.list ?? "sanctions list";
  const sanctions: SummaryCell = model.sanctioned
    ? { key: "sanctions", label: "Sanctions", value: `On the ${list}`, tone: "sanction", sub: `From the ${list}${hit?.screenedOn ? ` · checked ${hit.screenedOn}` : ""}` }
    : { key: "sanctions", label: "Sanctions", value: "Not listed", sub: null };

  const states = model.certs.map((c) => ({ c, w: certWords(c.expiresOn, today) }));
  const expired = states.filter((s) => s.w.state === "expired");
  const expiring = states.filter((s) => s.w.state === "expiring");
  const problems = expired.length ? expired : expiring;
  const certificates: SummaryCell =
    model.certs.length === 0
      ? { key: "certificates", label: "Certificates", value: "None found", sub: model.certsEmptyChip }
      : {
          key: "certificates",
          label: "Certificates",
          value: expired.length ? `${model.certs.length} · ${expired.length} expired` : expiring.length ? `${model.certs.length} · ${expiring.length} expiring` : String(model.certs.length),
          tone: expired.length ? "danger" : expiring.length ? "caution" : undefined,
          sub: problems.length ? namesOf([...new Set(problems.map((p) => p.c.scheme))]) : namesOf([...new Set(model.certs.map((c) => c.scheme))]),
        };

  const rsc: SummaryCell = model.rsc
    ? { key: "rsc", label: "RSC", value: "Covered", sub: model.rsc.progress !== null ? `${model.rsc.progress}% fixed` : model.rsc.status }
    : { key: "rsc", label: "RSC", value: "Not covered", sub: model.rscBuildings.length > 0 ? "its buildings have a record" : "no RSC record" };

  const w = fact(model, "Workers");
  const workers: SummaryCell = w?.value
    ? { key: "workers", label: "Workers", value: `${w.value} workers`, sub: w.note ?? (w.marks?.length ? `from ${w.marks.map((m) => m.label).join(", ")}` : null) }
    : { key: "workers", label: "Workers", value: "Not published", sub: "ask in your RFQ" };

  const one = model.sources.length === 1 ? model.sources[0]! : null;
  const sources: SummaryCell = {
    key: "sources",
    label: "Sources",
    value: `${model.sourceCount} ${model.sourceCount === 1 ? "source" : "sources"}`,
    sub: one ? [one.mark.label, one.readDate].filter(Boolean).join(" · ") : model.readDate ? `read ${model.readDate}` : null,
  };
  return [sanctions, certificates, rsc, workers, sources];
}

/** The certificates as the certificate table takes them; OEKO-TEX has a label check, not a certificate. */
export function certRows(model: SupplierSheetModel): CertRowData[] {
  return model.certs.map((c) => ({
    scheme: c.scheme,
    number: c.number,
    issuer: c.issuer,
    expiresOn: c.expiresOn,
    documentUrl: c.documentUrl,
    documentLabel: /oeko/i.test(c.scheme) ? "Open label check" : undefined,
    anchor: certRowId(c.kind, c.number, c.expiresOn),
  }));
}

/** Certificates a buyer should look at first: expired, then expiring. A valid or undated one is on the Certificates tab. */
export function needsLook(rows: CertRowData[], today: Date): CertRowData[] {
  const state = (r: CertRowData) => certWords(r.expiresOn, today).state;
  return [...rows.filter((r) => state(r) === "expired"), ...rows.filter((r) => state(r) === "expiring")];
}

/** The facts the Overview lists: the record's own, in its order, under the words Paper uses. */
const LABEL: Record<string, string> = { Established: "Founded", Registers: "Memberships", "Capacity, as filed": "Capacity", "Factory address": "Address" };

export type KeyFact = { label: string; values: { text: string; mono: boolean; mark?: string }[]; source: string | null; empty: string | null };

export function keyFacts(model: SupplierSheetModel): KeyFact[] {
  // Rows that only say "not on file" are left out when they are extras: Paper's almost-empty record lists what it has and the few a buyer asks for.
  const optional = new Set(["Registered name", "Parent group", "EPZ zone", "Women · men", "Sewing machines", "Capacity, as filed"]);
  const rows = model.facts.filter((f) => !(f.label === "Registered name" && f.value?.trim().toLowerCase() === model.name.trim().toLowerCase()) && !(optional.has(f.label) && !f.value && !f.items?.length));
  const out: KeyFact[] = rows.map((f) => {
    const from = f.marks?.length ? `From ${f.marks.map((m) => m.label).join(", ")}` : f.pendingSource ? "Source not linked yet" : null;
    const source = [from, f.note ?? null].filter(Boolean).join(" · ") || null;
    const values = f.items?.length
      ? f.items.map((i) => ({ text: [i.label, i.code].filter(Boolean).join(" reg. no. "), mono: Boolean(i.code), mark: i.mark?.code }))
      : f.value
        ? [{ text: f.value, mono: Boolean(f.code) }]
        : [];
    return {
      label: LABEL[f.label] ?? f.label,
      values,
      source: values.length ? source : null,
      empty: values.length ? null : [f.empty ?? "Not on file", f.checked ?? null].filter(Boolean).join(" · "),
    };
  });
  // What it makes and exports is on the Products tab; the Overview says so only when there is nothing to open.
  const p = model.products;
  if (p.productListCount === 0) out.push({ label: "Products", values: [], source: null, empty: "Not published. Ask in your RFQ." });
  if (p.lines === 0) out.push({ label: "Exports", values: [], source: null, empty: p.linesUnknown ? "The export lines could not be read." : p.onEpb ? "On the EPB exporter register · no lines on file" : "Not on the EPB exporter list" });
  const lists = model.products.buyerLists;
  out.push({
    label: "Brand supplier lists",
    values: lists.length ? [{ text: lists.join(", "), mono: false }] : [],
    source: lists.length ? "From the brands' disclosure lists" : null,
    empty: lists.length ? null : model.products.buyerListsEmpty,
  });
  return out;
}

/** "24 Jul 2026" to the UTC day it names, for the 90-day test; null when it is not a date. */
export function dayOfWords(words: string | null): string | null {
  if (!words) return null;
  const t = Date.parse(`${words} UTC`);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/** A register read more than 90 days ago is stale: its date turns caution, with a clock and in words. */
export function isStale(readDate: string | null, today: Date): boolean {
  const iso = dayOfWords(readDate);
  return iso !== null && (today.getTime() - Date.parse(iso)) / 86_400_000 > 90;
}
