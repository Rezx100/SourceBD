// What the RFQ composer asks and says (Paper `10`/`11` · RFQ composer): the fields' choices, the
// template, what is still missing before Send, the sentence under the buttons, how a refused
// send is put, and which of the suppliers to list by name. Pure, so a test pins each sentence;
// the composer (`composer.tsx`) only draws and posts.

import type { SourceMarkModel } from "@/lib/dashboard/source-tiers";
import type { TierRank } from "@/lib/design/tokens";

/** A supplier this RFQ goes to. Facts only; never a contact value. */
export type ComposerTarget = {
  id: string;
  slug: string;
  name: string;
  initials: string;
  tier: TierRank;
  marks: SourceMarkModel[];
  place: string | null;
  type: string;
  sanctioned: boolean;
  sanctionSample?: boolean;
};

/** What the composer starts with: the line a buyer arrived from, or one of their own products. */
export type ComposerPrefill = {
  title?: string | null;
  description?: string | null;
  quantity?: string | null;
  unit?: string | null;
  targetPrice?: string | null;
  currency?: string | null;
  shipTo?: string | null;
  shipBy?: string | null;
  hs?: string | null;
  productId?: string | null;
  /** A saved draft's own message and questions; without them the workspace template and questions fill in. */
  message?: string | null;
  questions?: string[] | null;
};

/** The buyer's workspace, for the template's variables and the default questions. Null facts are named as missing, never invented. */
export type ComposerWorkspace = {
  companyName: string | null;
  userName: string | null;
  website: string | null;
  questions: string[];
  emailTemplate: string | null;
};

export const UNITS = ["pcs", "sets", "pairs", "dozens", "kg", "m"] as const;
export const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "BDT"] as const;
export const SHIP_TO = ["United Kingdom", "United States", "Germany", "France", "Netherlands", "Italy", "Spain", "Canada", "Australia"] as const;

/** The most suppliers one RFQ can go to (`rfq_create` refuses more). */
export const MAX_TARGETS = 50;
/** Up to this many suppliers are listed by name in the form; more are summarised with "Review all". */
export const LISTED_TARGETS = 5;
export const MAX_QUESTIONS = 20;

/** The five questions a first RFQ asks when the workspace has set none. */
export const DEFAULT_QUESTIONS = [
  "Unit price at this quantity, FOB Chattogram",
  "Minimum order quantity per colour",
  "Sample lead time and cost",
  "Which certificate scope this line ships under",
  "Payment terms you can offer",
] as const;

export const DEFAULT_TEMPLATE =
  "Dear {{supplier}},\n\nWe read your record on SourceBD and would like a quotation for the line below.\n\n{{product}}\n\nPlease answer the questions under the product. Reply inside SourceBD.\n\n{{user}}\n{{company}}\n{{website}}";

/** The workspace facts the template fills in; a missing one is named in brackets, never invented. */
export type TemplateVars = { supplier: string; product: string; user: string | null; company: string | null; website: string | null };

export function fillTemplate(template: string, vars: TemplateVars): { text: string; missing: string[] } {
  const missing: string[] = [];
  const pick = (v: string | null, label: string) => {
    if (v && v.trim()) return v.trim();
    missing.push(label);
    return `[${label}]`;
  };
  const text = template
    .replaceAll("{{supplier}}", vars.supplier)
    .replaceAll("{{product}}", vars.product)
    .replaceAll("{{user}}", pick(vars.user, "your name"))
    .replaceAll("{{company}}", pick(vars.company, "company name"))
    .replaceAll("{{website}}", pick(vars.website, "website"));
  return { text, missing };
}

/** `a`, `a and b`, `a, b and c`. */
export function listAnd(items: string[]): string {
  return items.length < 2 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/** What is still required before Send, as the field's own name. */
export function missingFields(v: { title: string; quantity: string; unit: string; targets: number }): string[] {
  const out: string[] = [];
  if (!v.title.trim()) out.push("product title");
  if (!(Number(v.quantity) >= 1)) out.push("quantity");
  if (!v.unit.trim()) out.push("unit");
  if (v.targets === 0) out.push("a supplier");
  return out;
}

/** The gaps `fillTemplate` leaves in brackets: a message that still holds one would reach a supplier reading "[website]". */
export function leftoverPlaceholders(message: string): string[] {
  return ["your name", "company name", "website"].filter((label) => message.includes(`[${label}]`));
}

/** "Add a quantity and your website to send.": what the footer says while Send waits. */
export function neededWords(missing: string[]): string {
  const words = missing.map((m) => {
    if (m === "quantity") return "a quantity";
    if (m === "product title") return "a product";
    if (m === "unit") return "a unit";
    if (m === "a supplier") return "a supplier";
    if (m === "website in the message") return "your website";
    if (m === "your name in the message") return "your name";
    if (m === "company name in the message") return "your company name";
    return m;
  });
  return `Add ${listAnd(words)} to send.`;
}

export type ComposerCopy = { sends: string; send: string };

/** "Sends to 1 supplier: Aboni Knitwear Ltd." and the Send button's own words. */
export function sendWords(targets: readonly Pick<ComposerTarget, "name">[]): ComposerCopy {
  const n = targets.length;
  if (n === 0) return { sends: "Add a supplier to send this RFQ.", send: "Send RFQ" };
  if (n === 1) {
    const name = targets[0]!.name;
    return { sends: `Sends to 1 supplier: ${name}${name.endsWith(".") ? "" : "."}`, send: "Send RFQ" };
  }
  return { sends: `Sends to ${n} suppliers.`, send: `Send to ${n} suppliers` };
}

/** "Aboni Knitwear Ltd., S M Knitwears Limited and 48 more". */
export function targetSummary(targets: readonly Pick<ComposerTarget, "name">[]): string {
  const names = targets.slice(0, 2).map((t) => t.name);
  const more = targets.length - names.length;
  return more > 0 ? `${names.join(", ")} and ${more} more` : listAnd(names);
}

/** "47 factories, 3 buying houses": the types of the suppliers, in words. */
export function typeCounts(targets: readonly Pick<ComposerTarget, "type">[]): string {
  const by = new Map<string, number>();
  for (const t of targets) by.set(t.type, (by.get(t.type) ?? 0) + 1);
  const plural = (type: string, n: number) => {
    const w = type.toLowerCase();
    if (n === 1) return `1 ${w}`;
    return `${n} ${w === "factory" ? "factories" : w === "buying house" ? "buying houses" : w.endsWith("s") ? w : `${w}s`}`;
  };
  return [...by.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => plural(t, n)).join(", ");
}

/** The sentence for a refused send: the server's own reason where it gave one, in plain words otherwise. */
export function refusalWords(status: number, json: Record<string, unknown> | null): string {
  const detail = typeof json?.detail === "string" ? json.detail : typeof json?.error === "string" ? json.error : null;
  if (status === 0) return "Could not reach SourceBD: no connection. Your draft is still here; try again.";
  if (status === 401 || status === 403) return "Sign in with a buyer account to send an RFQ.";
  if (status === 429) return "Too many RFQs in the last minute. Wait a minute and send again.";
  if (detail && /not published|sanction/i.test(detail)) return "One of these suppliers cannot receive an RFQ any more. Remove it and send again.";
  return detail ? `Could not send: ${detail}` : "Could not send this RFQ. Nothing was sent; try again in a moment.";
}

export type ComposerFields = {
  title: string;
  description: string;
  quantity: string;
  unit: string;
  targetPrice: string;
  currency: string;
  shipTo: string;
  shipBy: string;
  message: string;
  questions: string[];
  targetIds: string[];
  productId?: string | null;
};

/** The body `rfq_create` and `rfq_draft_save` take, from the fields as typed. */
export function buildPayload(f: ComposerFields): Record<string, unknown> {
  const p: Record<string, unknown> = {
    product_title: f.title.trim(),
    product_description: f.description.trim() || undefined,
    quantity: Number(f.quantity),
    quantity_unit: f.unit.trim(),
    currency: f.currency,
    target_supplier_ids: f.targetIds,
    message: f.message.trim() || undefined,
    questions: f.questions,
  };
  if (f.targetPrice.trim()) p.target_unit_price = Number(f.targetPrice);
  if (f.shipTo.trim()) p.ship_to_country = f.shipTo.trim();
  if (f.shipBy.trim()) p.ship_by = f.shipBy.trim();
  if (f.productId) p.product_id = f.productId;
  return p;
}

/**
 * What the composer holds after the server resolved a pick: the resolved suppliers, or, when the
 * check failed or left nobody (all of them unlisted since), what the buyer already had.
 */
export function afterPick<T>(current: T[], resolved: { targets: T[] | null; note: string | null }): { targets: T[]; note: string | null } {
  if (resolved.targets && resolved.targets.length > 0) return { targets: resolved.targets, note: resolved.note };
  if (resolved.targets) return { targets: current, note: `${resolved.note ?? "None of those suppliers is listed any more."} Your suppliers are unchanged.` };
  return { targets: current, note: resolved.note };
}
