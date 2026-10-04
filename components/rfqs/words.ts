// The words and sums of the buyer's RFQ pages (Paper `10`/`11` · RFQs, quotes, orders), in one
// place so the list, the pane, the full page and the phone cannot say one thing three ways.
// Pure: no React, no data access, so a test can pin every rule a buyer reads.

import { usd } from "@/components/patterns/words";
import { daysUntil, formatDay, splitQualifier } from "@/lib/dashboard/facts";

export type RfqStatus = "open" | "accepted" | "closed" | "cancelled";
export type QuoteStatus = "submitted" | "accepted" | "rejected" | "withdrawn";

/** What `rfq_list` returns per RFQ (target price, currency and accepted quote included). */
export type RfqRow = {
  id: string;
  product_title: string;
  quantity: number;
  quantity_unit: string;
  target_unit_price: number | null;
  currency: string;
  ship_by: string | null;
  status: RfqStatus;
  accepted_quote_id: string | null;
  target_supplier_count: number;
  quote_count: number;
  viewer_role: "buyer" | "supplier" | "both";
  created_at: string;
  updated_at: string;
};

/** What `rfq_draft_list()` returns per draft. */
export type DraftRow = {
  id: string;
  payload: { product_title?: unknown; quantity?: unknown; quantity_unit?: unknown; target_unit_price?: unknown; currency?: unknown; ship_by?: unknown } | null;
  target_supplier_ids: string[] | null;
  updated_at: string;
};

/** The columns of `rfq_quotes` the list reads to find the best quote (the buyer's RLS lets them). */
export type QuoteLite = { rfq_id: string; supplier_id: string; unit_price: number; moq: number | null; status: QuoteStatus };

/** What the list needs of an order: which RFQ it came from and its PO number. */
export type OrderLite = { id: string; rfq_id: string | null; po_number: string | null };

// ---- tabs ----

export const RFQ_TABS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "waiting", label: "Waiting" },
  { key: "quoted", label: "Quoted" },
  { key: "accepted", label: "Accepted" },
  { key: "closed", label: "Closed" },
] as const;
export type RfqTab = (typeof RFQ_TABS)[number]["key"];

/** Open with no quote is waiting, open with quotes is quoted; a cancelled or closed RFQ is closed. */
export function tabOf(r: Pick<RfqRow, "status" | "quote_count">): Exclude<RfqTab, "all" | "draft"> {
  if (r.status === "accepted") return "accepted";
  if (r.status === "closed" || r.status === "cancelled") return "closed";
  return r.quote_count > 0 ? "quoted" : "waiting";
}

/** `?status=`: today's links used `open` and `drafts`, and still open the right tab. */
export function parseRfqTab(v: unknown): RfqTab {
  if (v === "open") return "waiting";
  if (v === "drafts") return "draft";
  return RFQ_TABS.some((t) => t.key === v) ? (v as RfqTab) : "all";
}

export type RfqSort = "recent" | "ship_by";
export const parseRfqSort = (v: unknown): RfqSort => (v === "ship_by" ? "ship_by" : "recent");

/** The list at a tab and sort, with an RFQ open beside it or not. Close is this without `open`. */
export function rfqsHref(tab: RfqTab, open?: string | null, sort: RfqSort = "recent"): string {
  const q = new URLSearchParams();
  if (tab !== "all") q.set("status", tab);
  if (sort !== "recent") q.set("sort", sort);
  if (open) q.set("open", open);
  const s = q.toString();
  return s ? `/app/rfqs?${s}` : "/app/rfqs";
}

// ---- words ----

/** `pcs` is how the unit is stored; the buyer reads "pieces". Anything else is printed as entered. */
export function unitWords(unit: string): string {
  const u = unit.trim();
  return /^(pcs?|pieces?)$/i.test(u) ? "pieces" : u;
}

/** "piece", "set": the unit a price is per. */
export function perUnit(unit: string): string {
  const u = unitWords(unit);
  if (u === "pieces") return "piece";
  return /^[a-z]+s$/i.test(u) && u.length > 3 ? u.slice(0, -1) : u;
}

const n = (v: number) => new Intl.NumberFormat("en-GB", { maximumFractionDigits: 4 }).format(v);

/** "10,000 pieces". */
export const quantityWords = (qty: number, unit: string) => `${n(qty)} ${unitWords(unit)}`;

/** US$8.55 for dollars, `EUR 8.55` for any other code. */
export function money(v: number, currency: string): string {
  if (currency === "USD") return usd(v);
  return `${currency} ${new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)}`;
}

/** "US$8.55 per piece". */
export const priceWords = (v: number, currency: string, unit: string) => `${money(v, currency)} per ${perUnit(unit)}`;

/** "target US$8.90 per piece", or "no target price". */
export const targetWords = (target: number | null, currency: string, unit: string) =>
  target === null ? "no target price" : `target ${priceWords(target, currency, unit)}`;

/** A quote against the target, in the buyer's words: "US$0.35 under target", "On target". */
export function versus(price: number, target: number | null, currency: string): { words: string; over: boolean } | null {
  if (target === null) return null;
  const d = Math.round((price - target) * 100) / 100;
  if (d === 0) return { words: "On target", over: false };
  return { words: `${money(Math.abs(d), currency)} ${d < 0 ? "under" : "over"} target`, over: d > 0 };
}

/** "US$0.35 under", the short form a quotes table column uses once its head says "vs US$8.90 target". */
export function versusShort(price: number, target: number | null, currency: string): string | null {
  const v = versus(price, target, currency);
  return v ? v.words.replace(/ target$/, "") : null;
}

/** Counts as the list writes them: "3 suppliers", "1 supplier". */
export const suppliersWords = (count: number) => `${count} ${count === 1 ? "supplier" : "suppliers"}`;
export const quotesWords = (count: number) => `${count} ${count === 1 ? "quote" : "quotes"}`;

/** "46 suppliers have not replied", "1 supplier has not replied", or null when everyone has. */
export function notRepliedWords(targets: number, quotes: number): string | null {
  const left = Math.max(0, targets - quotes);
  if (left === 0) return null;
  return `${left} ${left === 1 ? "supplier has" : "suppliers have"} not replied`;
}

/** "Aboni Knitwear" for "Aboni Knitwear Ltd.": the name a sentence uses. */
export function shortName(name: string): string {
  const base = splitQualifier(name).base;
  return base.replace(/[\s,]+(ltd|limited|co|inc|plc|pvt|private limited)\.?$/i, "").trim() || base;
}

// ---- ship-by ----

/** Within this many days, an open RFQ's ship-by date says how close it is. */
export const SHIP_BY_NEAR_DAYS = 30;

/** "in 12 days" in caution while an open RFQ's ship-by is within 30 days; "3 days ago" once it has passed. Otherwise nothing. */
export function shipByWords(shipBy: string | null, today: Date, openRfq: boolean): string | null {
  if (!openRfq) return null;
  const d = daysUntil(shipBy, today);
  if (d === null) return null;
  if (d < 0) return `${-d} ${d === -1 ? "day" : "days"} ago`;
  if (d === 0) return "today";
  return d <= SHIP_BY_NEAR_DAYS ? `in ${d} ${d === 1 ? "day" : "days"}` : null;
}

/** True when a lead time started today ends after the ship-by date: "Misses ship-by". */
export function missesShipBy(leadTimeDays: number | null, shipBy: string | null, today: Date): boolean {
  if (leadTimeDays === null) return false;
  const d = daysUntil(shipBy, today);
  return d !== null && leadTimeDays > d;
}

/** "60 days ends after 15 Oct 2026". */
export const shipByMissWords = (leadTimeDays: number, shipBy: string) => `${leadTimeDays} days ends after ${formatDay(shipBy)}`;

/** The total a quote comes to: the price for the quantity wanted, or the MOQ when it is higher. */
export function quoteTotal(price: number, quantity: number, moq: number | null): number {
  return Math.round(price * Math.max(quantity, moq ?? 0) * 100) / 100;
}

/** Quotes that still count (not withdrawn, not turned down) sort first, cheapest first; the rest follow. */
export function sortQuotes<T extends { status: QuoteStatus; unit_price: number }>(quotes: readonly T[]): T[] {
  const live = (q: T) => (q.status === "submitted" || q.status === "accepted" ? 0 : 1);
  return [...quotes].sort((a, b) => live(a) - live(b) || (a.status === "accepted" ? -1 : 0) - (b.status === "accepted" ? -1 : 0) || a.unit_price - b.unit_price);
}

// ---- the list ----

export type ChipTone = "quoted" | "waiting" | "accepted" | "draft" | "closed";
export type ListBest = { price: string; versus: string | null; over: boolean; supplier: string | null };
export type ListItem = {
  kind: "rfq" | "draft";
  id: string;
  tab: Exclude<RfqTab, "all">;
  title: string;
  /** "10,000 pieces · target US$8.90 per piece" */
  detail: string;
  suppliers: string;
  chip: { tone: ChipTone; label: string };
  /** The line under the chip: who has not replied, the order, when a draft was saved. */
  chipNote: string | null;
  best: ListBest | null;
  /** "10,000 pieces" */
  qty: string;
  /** The second line of a row beside a pane: "10,000 pieces · best US$8.55 per piece, US$0.35 under target". */
  paneLine: string;
  /** The phone row's lines under the price: who it went to, the quantity and target. */
  phoneLines: string[];
  /** "Best price has MOQ 30,000 sets, above your 24,000": caution on the phone row. */
  moqNote: string | null;
  /** "Not sent yet" and "No quotes yet" when there is no best. */
  bestEmpty: string;
  shipBy: { date: string | null; near: string | null };
  sent: string | null;
  /** A buyer sees an RFQ they received as a supplier marked as such. */
  asSupplier: boolean;
  quantity: number;
  unit: string;
  shipByIso: string | null;
  sortKey: number;
};

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null);

export type ListInput = {
  rows: readonly RfqRow[];
  drafts: readonly DraftRow[];
  /** Null when the quotes could not be read: a row with quotes says to open it, never "No quotes yet". */
  quotes: readonly QuoteLite[] | null;
  /** Supplier names by id, for the best quote's "· Aboni Knitwear". */
  names: ReadonlyMap<string, string>;
  orders: readonly OrderLite[];
  today: Date;
};

function paneLine(r: RfqRow, tab: ListItem["tab"], best: QuoteLite | null, v: ReturnType<typeof versus>, names: ReadonlyMap<string, string>): string {
  const qty = quantityWords(r.quantity, r.quantity_unit);
  const who = best && names.get(best.supplier_id) ? shortName(names.get(best.supplier_id)!) : null;
  if (tab === "quoted" && best) return `${qty} · best ${priceWords(best.unit_price, r.currency, r.quantity_unit)}${v ? `, ${v.words}` : ""}`;
  if (tab === "accepted" && best) return `${qty} · ${who ? `${who} at ` : ""}${priceWords(best.unit_price, r.currency, r.quantity_unit)}`;
  if (tab === "waiting") return r.target_supplier_count === 1 ? `${qty} · sent to 1 supplier ${formatDay(r.created_at) ?? ""}`.trim() : `${qty} · ${r.quote_count} of ${r.target_supplier_count} replied`;
  if (tab === "closed") return `${qty} · ${r.status === "cancelled" ? "cancelled" : "closed"}, sent ${formatDay(r.created_at) ?? "—"}`;
  return qty;
}

function phoneLines(r: RfqRow, tab: ListItem["tab"], best: QuoteLite | null, names: ReadonlyMap<string, string>, order: OrderLite | undefined): string[] {
  const qty = quantityWords(r.quantity, r.quantity_unit);
  const who = best && names.get(best.supplier_id) ? shortName(names.get(best.supplier_id)!) : null;
  if (tab === "accepted") return [`${who ? `${who} at ` : ""}${best ? priceWords(best.unit_price, r.currency, r.quantity_unit) : "the accepted quote"} · ${order ? "order started" : "no order yet"}`];
  if (best) return [["Sent to " + suppliersWords(r.target_supplier_count), who ? `best from ${who}` : null, qty].filter(Boolean).join(" · ")];
  return [`${r.quote_count === 0 ? "No quotes yet · s" : "S"}ent to ${suppliersWords(r.target_supplier_count)} on ${formatDay(r.created_at) ?? "—"}`, `${qty} · ${targetWords(r.target_unit_price, r.currency, r.quantity_unit)}`];
}

/** The chip an RFQ wears: its status, and how many quotes are in while it is open. */
export function chipFor(status: RfqStatus, quotes: number): { tone: ChipTone; label: string } {
  if (status === "accepted") return { tone: "accepted", label: "Accepted" };
  if (status === "closed" || status === "cancelled") return { tone: "closed", label: status === "cancelled" ? "Cancelled" : "Closed" };
  return quotes > 0 ? { tone: "quoted", label: quotesWords(quotes) } : { tone: "waiting", label: "Waiting for quotes" };
}

/** The cheapest quote that still counts; an accepted RFQ's best is the quote that was accepted. */
export function bestQuote(row: RfqRow, quotes: readonly QuoteLite[] | null): QuoteLite | null {
  if (quotes === null) return null;
  const mine = quotes.filter((q) => q.rfq_id === row.id && (q.status === "submitted" || q.status === "accepted"));
  const accepted = row.status === "accepted" ? mine.find((q) => q.status === "accepted") : undefined;
  if (accepted) return accepted;
  return mine.reduce<QuoteLite | null>((best, q) => (best === null || q.unit_price < best.unit_price ? q : best), null);
}

/** Every RFQ and draft of the buyer as list items, in the order the list opens in (newest first). */
export function buildListItems({ rows, drafts, quotes, names, orders, today }: ListInput): ListItem[] {
  const items: ListItem[] = [];
  for (const r of rows) {
    const tab = tabOf(r);
    const best = bestQuote(r, quotes);
    const v = best ? versus(best.unit_price, r.target_unit_price, r.currency) : null;
    const order = r.status === "accepted" ? orders.find((o) => o.rfq_id === r.id) : undefined;
    const open = r.status === "open";
    const chip = chipFor(r.status, r.quote_count);
    const chipNote =
      tab === "accepted"
        ? order
          ? order.po_number
            ? `Order ${order.po_number} started`
            : "Order started"
          : "No order yet"
        : tab === "quoted"
          ? notRepliedWords(r.target_supplier_count, r.quote_count)
          : tab === "waiting"
            ? `${r.quote_count} of ${r.target_supplier_count} replied`
            : null;
    items.push({
      kind: "rfq",
      id: r.id,
      tab,
      title: r.product_title,
      detail: `${quantityWords(r.quantity, r.quantity_unit)} · ${targetWords(r.target_unit_price, r.currency, r.quantity_unit)}`,
      suppliers: suppliersWords(r.target_supplier_count),
      chip,
      chipNote,
      best: best
        ? { price: priceWords(best.unit_price, r.currency, r.quantity_unit), versus: v?.words ?? null, over: v?.over ?? false, supplier: names.get(best.supplier_id) ? shortName(names.get(best.supplier_id)!) : null }
        : null,
      qty: quantityWords(r.quantity, r.quantity_unit),
      paneLine: paneLine(r, tab, best, v, names),
      phoneLines: phoneLines(r, tab, best, names, order),
      moqNote: best && best.moq !== null && best.moq > r.quantity ? `Best price has MOQ ${quantityWords(best.moq, r.quantity_unit)}, above your ${n(r.quantity)}` : null,
      bestEmpty: quotes === null && r.quote_count > 0 ? "Open to compare" : "No quotes yet",
      shipBy: { date: formatDay(r.ship_by), near: shipByWords(r.ship_by, today, open) },
      sent: formatDay(r.created_at),
      asSupplier: r.viewer_role !== "buyer",
      quantity: r.quantity,
      unit: r.quantity_unit,
      shipByIso: r.ship_by,
      sortKey: Date.parse(r.created_at) || 0,
    });
  }
  for (const d of drafts) {
    const p = d.payload ?? {};
    const qty = num(p.quantity);
    const unit = typeof p.quantity_unit === "string" && p.quantity_unit.trim() ? p.quantity_unit : "pcs";
    const cur = typeof p.currency === "string" && p.currency ? p.currency : "USD";
    const target = num(p.target_unit_price);
    const title = typeof p.product_title === "string" && p.product_title.trim() ? p.product_title.trim() : "Untitled draft";
    const count = d.target_supplier_ids?.length ?? 0;
    const ship = typeof p.ship_by === "string" && p.ship_by ? p.ship_by : null;
    items.push({
      kind: "draft",
      id: d.id,
      tab: "draft",
      title,
      detail: `${qty === null ? "No quantity yet" : quantityWords(qty, unit)} · ${targetWords(target, cur, unit)}`,
      suppliers: suppliersWords(count),
      chip: { tone: "draft", label: "Draft" },
      chipNote: `Saved ${formatDay(d.updated_at) ?? "—"}`,
      best: null,
      qty: qty === null ? "No quantity yet" : quantityWords(qty, unit),
      paneLine: `${qty === null ? "No quantity yet" : quantityWords(qty, unit)} · saved ${formatDay(d.updated_at) ?? "—"}`,
      phoneLines: [`${suppliersWords(count)} · saved ${formatDay(d.updated_at) ?? "—"}`, `${qty === null ? "No quantity yet" : quantityWords(qty, unit)} · ${targetWords(target, cur, unit)}`],
      moqNote: null,
      bestEmpty: "Not sent yet",
      shipBy: { date: formatDay(ship), near: null },
      sent: null,
      asSupplier: false,
      quantity: qty ?? 0,
      unit,
      shipByIso: ship,
      sortKey: Date.parse(d.updated_at) || 0,
    });
  }
  return items.sort((a, b) => b.sortKey - a.sortKey);
}

/** The items under a tab, in the chosen sort (ship-by soonest first, undated last). */
export function itemsFor(items: readonly ListItem[], tab: RfqTab, sort: RfqSort): ListItem[] {
  const shown = items.filter((i) => tab === "all" || i.tab === tab);
  if (sort === "recent") return shown;
  return [...shown].sort((a, b) => {
    const x = a.shipByIso ? Date.parse(a.shipByIso) : Infinity;
    const y = b.shipByIso ? Date.parse(b.shipByIso) : Infinity;
    return x - y;
  });
}

export const countOf = (items: readonly ListItem[], tab: RfqTab) => items.filter((i) => tab === "all" || i.tab === tab).length;

/** "6 RFQs · 5 sent · 7 quotes received": the page's caption. A draft is not an RFQ yet. */
export function listCaption(rows: readonly RfqRow[], drafts: readonly DraftRow[]): string {
  const sent = rows.filter((r) => r.viewer_role !== "supplier");
  const quotes = sent.reduce((t, r) => t + (Number.isFinite(r.quote_count) ? r.quote_count : 0), 0);
  const total = rows.length + drafts.length;
  return `${total} ${total === 1 ? "RFQ" : "RFQs"} · ${sent.length} sent · ${quotes} ${quotes === 1 ? "quote" : "quotes"} received`;
}
