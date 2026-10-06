// The RFQ as the pane and the page draw it: what `rfq_get` returns, and the rows a buyer reads
// out of it (a quote against the target, against the quantity, against the ship-by date; the
// suppliers that have not replied). Pure, so a test can pin every sentence a buyer reads.

import { formatDay } from "@/lib/dashboard/facts";
import {
  chipFor,
  money,
  missesShipBy,
  perUnit,
  priceWords,
  quantityWords,
  quoteTotal,
  quotesWords,
  shipByMissWords,
  sortQuotes,
  suppliersWords,
  targetWords,
  versusShort,
  type ChipTone,
  type QuoteStatus,
  type RfqStatus,
} from "./words";

export type RfqDoc = {
  id: string;
  product_title: string;
  product_description: string | null;
  quantity: number;
  quantity_unit: string;
  target_unit_price: number | null;
  currency: string;
  ship_to_country: string | null;
  ship_by: string | null;
  status: RfqStatus;
  accepted_quote_id: string | null;
  message?: string | null;
  questions?: string[] | null;
  created_at: string;
  updated_at: string;
  viewer_role: "buyer" | "supplier" | "both";
  targets: { id: string; slug: string; company_name: string; entity_type: string; city: string | null; district: string | null }[];
  quotes: {
    id: string;
    supplier_id: string;
    supplier_slug: string;
    supplier_name: string;
    supplier_entity_type: string;
    unit_price: number;
    currency: string;
    lead_time_days: number | null;
    moq: number | null;
    valid_until: string | null;
    notes: string | null;
    status: QuoteStatus;
    created_at: string;
    updated_at: string;
  }[];
  thread_id: string | null;
};

const entityLabel = (et: string) => (et === "factory" ? "Factory" : et === "buying_house" ? "Buying house" : "Supplier");

/** "Factory · Savar, Dhaka". */
export function placeLine(entityType: string, city: string | null, district: string | null): string {
  const place = [city, district].filter(Boolean).join(", ");
  return [entityLabel(entityType), place || null].filter(Boolean).join(" · ");
}

export type QuoteModel = {
  id: string;
  slug: string;
  supplier: string;
  place: string;
  status: QuoteStatus;
  /** "US$8.55" and the unit it is per. */
  price: string;
  perUnit: string;
  /** "US$0.35 under", null without a target. */
  versus: string | null;
  /** "3,000 pieces" and, when above the quantity, "Above 10,000". */
  moq: string | null;
  moqWarn: string | null;
  /** "MOQ 12,000 pieces, above your 10,000" */
  moqSentence: string | null;
  lead: string | null;
  /** "60 days ends after 15 Oct 2026" when the lead time misses ship-by. */
  missWords: string | null;
  valid: string | null;
  total: string;
  notes: string | null;
  /** What the confirm dialog repeats. */
  summary: { price: string; quantity: string; total: string; lead: string | null };
  cautions: string[];
};

export type NoReplyModel = { id: string; slug: string; supplier: string; place: string; sent: string };

export type DetailModel = {
  title: string;
  chip: { tone: ChipTone; label: string };
  /** Under the title, line one. */
  facts: string;
  factsPane: string;
  /** Line two: when it was sent and to whom. */
  sentLine: string;
  sentLinePane: string;
  /** "Quotes · 2" */
  quotesTitle: string;
  notReplied: string | null;
  sortWords: string;
  targetHead: string | null;
  quotes: QuoteModel[];
  noReply: NoReplyModel[];
  /** What the footer under the table explains. */
  footnote: string;
  canAccept: boolean;
  /** The viewer is the RFQ's buyer (a supplier sees quotes but never the buyer's actions). */
  isBuyer: boolean;
};

/** Everything the quotes panel and the header say, from the document and today's date. */
export function detailModel(rfq: RfqDoc, today: Date): DetailModel {
  const isBuyer = rfq.viewer_role === "buyer" || rfq.viewer_role === "both";
  const quotes: QuoteModel[] = sortQuotes(rfq.quotes, rfq.currency).map((q) => {
    const same = q.currency === rfq.currency;
    const miss = missesShipBy(q.lead_time_days, rfq.ship_by, today);
    const above = q.moq !== null && q.moq > rfq.quantity;
    const total = quoteTotal(q.unit_price, rfq.quantity, q.moq);
    const cautions: string[] = [];
    if (miss && q.lead_time_days !== null && rfq.ship_by) cautions.push(`The ${q.lead_time_days}-day lead time ends after your ship-by date, ${formatDay(rfq.ship_by)}.`);
    if (above && q.moq !== null) cautions.push(`Their MOQ, ${quantityWords(q.moq, rfq.quantity_unit)}, is above your ${quantityWords(rfq.quantity, rfq.quantity_unit)}.`);
    return {
      id: q.id,
      slug: q.supplier_slug,
      supplier: q.supplier_name,
      place: placeLine(q.supplier_entity_type, null, null),
      status: q.status,
      price: money(q.unit_price, q.currency),
      perUnit: perUnit(rfq.quantity_unit),
      // A quote in another currency is not set against the target: the numbers are not comparable.
      versus: same ? versusShort(q.unit_price, rfq.target_unit_price, q.currency) : null,
      moq: q.moq === null ? null : quantityWords(q.moq, rfq.quantity_unit),
      moqWarn: above && q.moq !== null ? `Above ${new Intl.NumberFormat("en-GB").format(rfq.quantity)}` : null,
      moqSentence: above && q.moq !== null ? `MOQ ${quantityWords(q.moq, rfq.quantity_unit)}, above your ${new Intl.NumberFormat("en-GB").format(rfq.quantity)}` : null,
      lead: q.lead_time_days === null ? null : `${q.lead_time_days} ${q.lead_time_days === 1 ? "day" : "days"}`,
      missWords: miss && q.lead_time_days !== null && rfq.ship_by ? shipByMissWords(q.lead_time_days, rfq.ship_by) : null,
      valid: formatDay(q.valid_until),
      total: money(total, q.currency),
      notes: q.notes,
      summary: {
        price: priceWords(q.unit_price, q.currency, rfq.quantity_unit),
        quantity: quantityWords(rfq.quantity, rfq.quantity_unit),
        total: money(total, q.currency),
        lead: q.lead_time_days === null ? null : `${q.lead_time_days} days`,
      },
      cautions,
    };
  });
  // A supplier that has a quote on file has replied; every other target is quiet.
  const replied = new Set(rfq.quotes.map((q) => q.supplier_id));
  const noReply: NoReplyModel[] = rfq.targets
    .filter((t) => !replied.has(t.id))
    .map((t) => ({ id: t.id, slug: t.slug, supplier: t.company_name, place: placeLine(t.entity_type, t.city, t.district), sent: formatDay(rfq.created_at) ?? "—" }));
  // Place for a quote row comes from the target list, which carries city and district.
  for (const q of quotes) {
    const t = rfq.targets.find((x) => x.slug === q.slug);
    if (t) q.place = placeLine(t.entity_type, t.city, t.district);
  }
  const live = rfq.quotes.filter((q) => q.status === "submitted" || q.status === "accepted").length;
  const waitingOn = Math.max(0, rfq.targets.length - rfq.quotes.length);
  const sent = formatDay(rfq.created_at) ?? "—";
  const to = rfq.ship_to_country ? `to ${/^(united|netherlands)/i.test(rfq.ship_to_country) ? "the " : ""}${rfq.ship_to_country}` : null;
  const lines = [quantityWords(rfq.quantity, rfq.quantity_unit), targetWords(rfq.target_unit_price, rfq.currency, rfq.quantity_unit), rfq.ship_by ? `ship by ${formatDay(rfq.ship_by)}` : null];
  return {
    title: rfq.product_title,
    chip: chipFor(rfq.status, live),
    facts: [...lines, to].filter(Boolean).join(" · "),
    factsPane: lines.filter(Boolean).join(" · "),
    sentLine: `Sent ${sent} to ${suppliersWords(rfq.targets.length)}, each on their own`,
    sentLinePane: [`Sent ${sent} to ${suppliersWords(rfq.targets.length)}`, to].filter(Boolean).join(" · "),
    quotesTitle: `Quotes · ${rfq.quotes.length}`,
    notReplied: waitingOn === 0 ? null : `${waitingOn} ${waitingOn === 1 ? "supplier has" : "suppliers have"} not replied`,
    sortWords: rfq.target_unit_price === null ? "Cheapest first" : "Best against your target first",
    targetHead: rfq.target_unit_price === null ? null : `vs ${money(rfq.target_unit_price, rfq.currency)} target`,
    quotes,
    noReply,
    footnote: `Total is for your quantity, or the MOQ when it is higher.${rfq.ship_by && rfq.quotes.some((q) => missesShipBy(q.lead_time_days, rfq.ship_by, today)) ? ` Misses ship-by means the lead time ends after ${formatDay(rfq.ship_by)}.` : ""}`,
    canAccept: isBuyer && rfq.status === "open",
    isBuyer,
  };
}

/** Other RFQs of the buyer, as the full page's side column lists them: "Hoodies, 12,000 pieces · waiting for quotes · sent 18 Jul 2026". */
export function otherRfqLine(r: { product_title: string; quantity: number; quantity_unit: string; status: RfqStatus; quote_count: number; created_at: string }): string {
  const state = r.status === "accepted" ? "accepted" : r.status === "open" ? (r.quote_count > 0 ? quotesWords(r.quote_count) : "waiting for quotes") : r.status;
  return `${r.product_title}, ${quantityWords(r.quantity, r.quantity_unit)} · ${state} · sent ${formatDay(r.created_at) ?? "—"}`;
}

