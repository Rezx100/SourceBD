// What the New order page says and posts (Paper `10 · New order`, `· choose a supplier inline`):
// the suppliers worth offering first (the ones the buyer asked for a price), the order's value as
// they type, and the body `order_create` takes. Pure, so a test pins each sentence.

import { placeLine, type RfqDoc } from "@/components/rfqs/doc";
import { bestQuote, money, perUnit, priceWords, quantityWords, type QuoteLite } from "@/components/rfqs/words";
import { formatDay } from "@/lib/dashboard/facts";

export const INCOTERMS = ["FOB", "CIF", "EXW", "DDP", "DAP"] as const;
export const UNITS = ["pcs", "sets", "pairs", "dozens", "kg", "m"] as const;
export const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "BDT"] as const;
export const SHIP_TO = ["United Kingdom", "United States", "Germany", "France", "Netherlands", "Italy", "Spain", "Canada", "Australia"] as const;

export type ChooserRow = { id: string; slug: string; name: string; line: string };

/**
 * The suppliers of the buyer's recent RFQs, newest first, each once: "Quoted US$8.55 per piece for
 * hoodies · Factory · Savar, Dhaka", or "RFQ sent 18 Jul 2026, no reply yet" when it has not
 * answered. `docs` are `rfq_get` documents, newest RFQ first.
 */
export function chooserRows(docs: readonly RfqDoc[]): ChooserRow[] {
  const seen = new Set<string>();
  const out: ChooserRow[] = [];
  for (const d of docs) {
    for (const t of d.targets) {
      if (seen.has(t.slug)) continue;
      seen.add(t.slug);
      const q = d.quotes.find((x) => x.supplier_id === t.id && (x.status === "submitted" || x.status === "accepted"));
      const first = q ? `Quoted ${priceWords(q.unit_price, q.currency, d.quantity_unit)} for ${d.product_title}` : `RFQ sent ${formatDay(d.created_at) ?? "—"}, no reply yet`;
      out.push({ id: t.id, slug: t.slug, name: t.company_name, line: [first, placeLine(t.entity_type, t.city, t.district)].join(" · ") });
    }
  }
  return out;
}

/** The "Faster: accept a quote" card: an open RFQ with quotes waiting, and its best price. */
export function acceptHint(docs: readonly RfqDoc[]): { id: string; title: string; waiting: number; best: string | null } | null {
  for (const d of docs) {
    if (d.status !== "open") continue;
    const live = d.quotes.filter((q) => q.status === "submitted");
    if (live.length === 0) continue;
    const lite: QuoteLite[] = live.map((q) => ({ rfq_id: d.id, supplier_id: q.supplier_id, unit_price: q.unit_price, currency: q.currency, moq: q.moq, status: q.status }));
    const best = bestQuote({ id: d.id, status: "open", currency: d.currency } as never, lite);
    return { id: d.id, title: d.product_title, waiting: live.length, best: best ? priceWords(best.unit_price, best.currency, d.quantity_unit) : null };
  }
  return null;
}

/** "Order value": quantity times price, or null until both are numbers. */
export function orderValue(quantity: string, price: string, currency: string): string | null {
  const q = Number(quantity);
  const p = Number(price);
  if (!(q > 0) || !price.trim() || !(p >= 0)) return null;
  return money(Math.round(q * p * 100) / 100, currency);
}

/** "20,000 pieces at US$4.20 per piece, FOB Chattogram". */
export function valueLine(f: { quantity: string; unit: string; price: string; currency: string; incoterm: string; originPort: string }): string | null {
  const q = Number(f.quantity);
  const p = Number(f.price);
  if (!(q > 0) || !f.price.trim() || !(p >= 0)) return null;
  const terms = [f.incoterm, f.incoterm && f.originPort ? f.originPort : null].filter(Boolean).join(" ");
  return `${quantityWords(q, f.unit)} at ${money(p, f.currency)} per ${perUnit(f.unit)}${terms ? `, ${terms}` : ""}`;
}

export type OrderFields = {
  title: string;
  quantity: string;
  unit: string;
  price: string;
  currency: string;
  po: string;
  incoterm: string;
  originPort: string;
  destinationPort: string;
  shipTo: string;
  shipBy: string;
  deliverBy: string;
  notes: string;
};

/** What is still required before Create order. */
export function orderMissing(f: Pick<OrderFields, "title" | "quantity" | "unit">): string[] {
  const out: string[] = [];
  if (!f.title.trim()) out.push("a product");
  if (!(Number(f.quantity) > 0)) out.push("a quantity");
  if (!f.unit.trim()) out.push("a unit");
  return out;
}

/** The body `order_create` takes, from the fields as typed: an accepted quote, or a supplier. */
export function orderPayload(f: OrderFields, seed: { quoteId: string } | { supplierId: string }): Record<string, unknown> {
  const p: Record<string, unknown> = { action: "create", currency: f.currency.trim().toUpperCase() || "USD" };
  if ("quoteId" in seed) p.accepted_quote_id = seed.quoteId;
  else p.supplier_id = seed.supplierId;
  if (f.title.trim()) p.product_title = f.title.trim();
  if (f.quantity.trim()) p.quantity = Number(f.quantity);
  if (f.unit.trim()) p.quantity_unit = f.unit.trim();
  if (f.price.trim()) p.unit_price = Number(f.price);
  if (f.po.trim()) p.po_number = f.po.trim();
  if (f.incoterm.trim()) p.incoterm = f.incoterm.trim();
  if (f.originPort.trim()) p.origin_port = f.originPort.trim();
  if (f.destinationPort.trim()) p.destination_port = f.destinationPort.trim();
  if (f.shipTo.trim()) p.ship_to_country = f.shipTo.trim();
  if (f.shipBy.trim()) p.target_ship_date = f.shipBy.trim();
  if (f.deliverBy.trim()) p.target_delivery_date = f.deliverBy.trim();
  if (f.notes.trim()) p.notes = f.notes.trim();
  return p;
}
