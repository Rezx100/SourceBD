// The words of the Products list (Paper `10 · Products`, `11 · Products`), kept out of React so a
// test reads them. A product is the buyer's own record: nothing here is shown to a supplier until
// it goes out as an RFQ. Paper's HS code and RFQs columns are not here: `buyer_product_list` returns
// neither, and the list does not guess them. The category stands where the HS code would.

import { formatCount, formatDay } from "@/lib/dashboard/facts";

export type ProductStatus = "draft" | "active" | "archived";

/** One row of `buyer_product_list()`. Numbers may arrive as text from a `numeric` column. */
export type ProductRow = {
  id: string;
  name: string;
  product_number: string | null;
  category: string | null;
  status: ProductStatus;
  price_usd: number | string | null;
  moq: number | string | null;
  first_image: string | null;
  updated_at: string;
};

export const PRODUCT_TABS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "draft", label: "Draft" },
  { key: "archived", label: "Archived" },
] as const;
export type ProductTab = (typeof PRODUCT_TABS)[number]["key"];

export function parseTab(v: unknown): ProductTab {
  const one = Array.isArray(v) ? v[0] : v;
  return PRODUCT_TABS.some((t) => t.key === one) ? (one as ProductTab) : "all";
}

export const tabHref = (key: ProductTab) => (key === "all" ? "/app/products" : `/app/products?status=${key}`);

export const STATUS_LABEL: Record<ProductStatus, string> = { draft: "Draft", active: "Active", archived: "Archived" };

export const filterRows = (rows: readonly ProductRow[], tab: ProductTab) => (tab === "all" ? [...rows] : rows.filter((r) => r.status === tab));

/** The count a tab carries; null when the list could not be read, so no tab says "0". */
export const tabCount = (rows: readonly ProductRow[] | null, tab: ProductTab): number | null => (rows ? filterRows(rows, tab).length : null);

export function productsCaption(rows: readonly ProductRow[] | null): string {
  if (rows === null) return "Your product count could not be read";
  return `${formatCount(rows.length)} ${rows.length === 1 ? "product" : "products"} · only you see these`;
}

export const PRODUCTS_ERROR_TITLE = "We couldn't load your products.";
export const PRODUCTS_ERROR_BODY = "The product list did not answer in time. Nothing you saved is lost.";

export const num = (v: number | string | null): number | null => (v === null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

/** "US$4.20 per piece"; a price under a cent keeps its four digits. */
export function priceWords(v: number | string | null): string | null {
  const n = num(v);
  if (n === null) return null;
  const digits = Math.abs(n) > 0 && Math.abs(n) < 0.01 ? 4 : 2;
  return `US$${new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: digits }).format(n)} per piece`;
}

/** "3,000 pieces", "1 piece". */
export function moqWords(v: number | string | null): string | null {
  const n = num(v);
  if (n === null) return null;
  return `${formatCount(n)} ${n === 1 ? "piece" : "pieces"}`;
}

/** "Style NW-701 · Knit clothing", or whichever half there is; null when neither. */
export function styleLine(r: Pick<ProductRow, "product_number" | "category">): string | null {
  const parts = [r.product_number ? `Style ${r.product_number}` : null, r.category];
  const line = parts.filter(Boolean).join(" · ");
  return line || null;
}

export const updatedWords = (iso: string): string => formatDay(iso) ?? "Not dated";

/** The phone row's last line: "Updated 26 Sep 2026". */
export const phoneUpdated = (iso: string) => `Updated ${updatedWords(iso)}`;

export const addHref = "/app/products/new";
export const openHref = (id: string) => `/app/products/${encodeURIComponent(id)}`;
export const rfqHref = (id: string) => `/app/rfqs/new?product=${encodeURIComponent(id)}`;

/** What Restore goes back to: an archived product returns as a draft, to be looked at before it is sent. */
export const RESTORED_STATUS: ProductStatus = "draft";

export function statusChangeWords(name: string, to: ProductStatus): string {
  return to === "archived" ? `Archived ${name}.` : to === "active" ? `${name} is active.` : `Restored ${name} as a draft.`;
}

export const savedWords = "Product saved.";

export function deleteTitle(name: string): string {
  return `Delete “${name}”?`;
}
export const DELETE_BODY = "It is removed from your products for good, with its size chart and materials. To keep it out of the way and bring it back later, archive it instead.";
