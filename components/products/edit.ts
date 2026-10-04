// The product editor's own words, out of React (Paper `10 · Product editor`, `· New product`): which
// fields changed (the bar at the foot names them), which buttons the foot has for a product in each
// state, which sections open, and what a refused save or upload says. The values and the payload are
// `components/product-form-model.ts`, tested on their own.

import { toPayload, type ProductStatus, type ProductValues } from "@/components/product-form-model";
import { styleLine, updatedWords } from "./words";

/** The sections the left navigation lists, in Paper's order. HS code is not here: a product holds no HS code. */
export const SECTIONS = [
  { id: "basics", label: "Basics" },
  { id: "options", label: "Options" },
  { id: "size-chart", label: "Size chart" },
  { id: "materials", label: "Materials" },
  { id: "images", label: "Images" },
  { id: "tech-pack", label: "Tech pack" },
] as const;
export type SectionId = (typeof SECTIONS)[number]["id"];
export type Optional = Exclude<SectionId, "basics">;

/** Paper's "Add when you're ready": what a section says about itself while it is shut. */
export const OPTIONAL_LINES: Record<Optional, string> = {
  options: "Options, such as colour and size",
  "size-chart": "Size chart",
  materials: "Materials",
  images: "Images",
  "tech-pack": "Tech pack",
};

const filledRow = (r: Record<string, string>) => Object.values(r).some((x) => x.trim());

/** Does this section hold anything? Rows the buyer has not typed in do not count. */
export function hasContent(v: ProductValues, section: Optional): boolean {
  switch (section) {
    case "options":
      return v.options.some((o) => o.name.trim() || o.values.length > 0);
    case "size-chart":
      return v.size_chart.some(filledRow);
    case "materials":
      return v.bom.some(filledRow);
    case "images":
      return v.media.some((m) => m.kind === "image");
    case "tech-pack":
      return v.tech_pack_url.trim() !== "";
  }
}

/** A saved product opens every section; a new one opens only the ones it already holds. */
export function openSections(v: ProductValues): Record<Optional, boolean> {
  const saved = v.id !== null;
  const open = (s: Optional) => saved || hasContent(v, s);
  return { options: open("options"), "size-chart": open("size-chart"), materials: open("materials"), images: open("images"), "tech-pack": open("tech-pack") };
}

const FIELDS: readonly [label: string, key: keyof ProductValues][] = [
  ["Name", "name"],
  ["Style number", "product_number"],
  ["Customer product number", "customer_product_number"],
  ["Description", "description"],
  ["Target price", "price_usd"],
  ["MOQ", "moq"],
  ["Main material", "main_material"],
  ["Category", "category"],
  ["Tags", "tags"],
  ["Options", "options"],
  ["Size chart", "size_chart"],
  ["Materials", "bom"],
  ["Images", "media"],
  ["Tech pack", "tech_pack_url"],
];

/** The fields that differ from what was opened, as Paper names them; compared as they would be sent, so a trailing space or an empty row is not a change. */
export function changedLabels(initial: ProductValues, now: ProductValues): string[] {
  const a = toPayload(initial, initial.status) as Record<string, unknown>;
  const b = toPayload(now, initial.status) as Record<string, unknown>;
  const key = (k: keyof ProductValues): string[] => (k === "options" ? ["variants"] : k === "bom" ? ["bom"] : k === "media" ? ["media"] : [k]);
  return FIELDS.filter(([, k]) => key(k).some((p) => JSON.stringify(a[p]) !== JSON.stringify(b[p]))).map(([label]) => label);
}

export type FootButton = { label: string; saves: ProductStatus | null; primary: boolean };

/**
 * The buttons at the foot. A new product saves as a draft or goes live; a draft can be saved or made
 * active; an active or archived product keeps its status when saved (it is archived and restored from the
 * list). `saves: null` is Discard. A product nothing has changed in has no bar, except a draft, which can
 * always be made active.
 */
export function footButtons(status: ProductStatus, isNew: boolean, dirty: boolean): FootButton[] {
  if (isNew) return [{ label: "Save draft", saves: "draft", primary: false }, { label: "Make active", saves: "active", primary: true }];
  const discard: FootButton = { label: "Discard", saves: null, primary: false };
  if (status === "draft") return dirty ? [discard, { label: "Save changes", saves: "draft", primary: false }, { label: "Make active", saves: "active", primary: true }] : [{ label: "Make active", saves: "active", primary: true }];
  return dirty ? [discard, { label: "Save changes", saves: status, primary: true }] : [];
}

export const NEW_TITLE = "New product";
export const NEW_CAPTION = "Only the name is required. Add the rest now or later. Only you can see your products.";
export const NAME_NEEDED = "Add a name to save";
export const FIX_FIELDS = "Fix the fields marked above";

/** "Style NW-702 · updated 26 Sep 2026 · only you see this product". */
export function editLine(v: Pick<ProductValues, "product_number" | "category">, updatedAt: string | null): string {
  return [styleLine({ product_number: v.product_number || null, category: null }), updatedAt ? `updated ${updatedWords(updatedAt)}` : null, "only you see this product"].filter(Boolean).join(" · ");
}

/** The route's own sentence where it gave one; plain words otherwise. Never a status code. */
export function refusal(status: number, said: string | null, what: "save" | "upload"): string {
  if (status === 0) return "Could not reach SourceBD — no connection. Your product is still here; try again.";
  if (status === 401 || status === 403) return `Sign in with a buyer account to ${what === "save" ? "save products" : "upload files"}.`;
  if (status === 404) return "This product no longer exists — it may have been deleted in another tab.";
  if (status === 413) return "That file is too large to upload. Files can be 10 MB at most.";
  if (status === 429) return "Too many requests in a minute. Wait a moment and try again.";
  if (said) return said;
  return what === "save" ? "Could not save this product. Nothing was lost; try again in a moment." : "Could not upload that file. Try again in a moment.";
}
