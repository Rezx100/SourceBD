// The product form's pure half: the fixed category list, the values the form
// holds, the variant matrix, validation, and the payload `POST /api/v1/products`
// takes. No React, so `node --test` drives it directly
// (`components/product-form-model.test.ts`).
//
// Product truth: a product is the buyer's own record. It carries no score and
// no supplier contact value; nothing here reads a supplier at all.

export const PRODUCT_CATEGORIES = [
  "Knit apparel",
  "Woven apparel",
  "Denim",
  "Outerwear",
  "Underwear & sleepwear",
  "Socks & hosiery",
  "Accessories",
  "Home textiles",
  "Other",
] as const;

export const PRODUCT_STATUSES = ["draft", "active", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export type MediaKind = "image" | "tech_pack";
/** A file on the product. The form draws `image`s; any other kind the row holds is kept as it is. */
export type ProductMedia = { url: string; kind: string };
export type ProductOption = { name: string; values: string[] };
/** One point of measure. Text, not numbers: a tolerance is often written "1/4". */
export type SizeRow = { code: string; description: string; tol_minus: string; tol_plus: string; base: string };
/** `color`, the column's key in 0106; the buyer reads "Colour". */
export type BomRow = { part: string; material: string; qty: string; color: string; notes: string };

/** A column of an editable table: the header, the words a screen reader hears, an example, and a width. */
export type RowColumn<K extends string> = { key: K; label: string; full: string; placeholder: string; width?: string };

export const SIZE_COLUMNS: readonly RowColumn<keyof SizeRow>[] = [
  { key: "code", label: "Code", full: "Code", placeholder: "A", width: "w-20" },
  { key: "description", label: "Description", full: "Description", placeholder: "Chest, 2 cm below armhole" },
  { key: "tol_minus", label: "Tol −", full: "Tolerance minus", placeholder: "0.5", width: "w-24" },
  { key: "tol_plus", label: "Tol +", full: "Tolerance plus", placeholder: "0.5", width: "w-24" },
  { key: "base", label: "Base", full: "Base measurement", placeholder: "52", width: "w-24" },
];

export const BOM_COLUMNS: readonly RowColumn<keyof BomRow>[] = [
  { key: "part", label: "Part", full: "Part", placeholder: "Body fabric" },
  { key: "material", label: "Material", full: "Material", placeholder: "Single jersey, 180 gsm" },
  { key: "qty", label: "Qty", full: "Quantity", placeholder: "1.2 m", width: "w-24" },
  { key: "color", label: "Colour", full: "Colour", placeholder: "Navy", width: "w-28" },
  { key: "notes", label: "Notes", full: "Notes", placeholder: "Enzyme wash" },
];

export const emptySizeRow = (): SizeRow => ({ code: "", description: "", tol_minus: "", tol_plus: "", base: "" });
export const emptyBomRow = (): BomRow => ({ part: "", material: "", qty: "", color: "", notes: "" });

/** What the form holds: numbers stay text until the payload, so a half-typed "12." is not lost. */
export type ProductValues = {
  id: string | null;
  name: string;
  product_number: string;
  customer_product_number: string;
  description: string;
  price_usd: string;
  moq: string;
  main_material: string;
  category: string;
  tags: string[];
  media: ProductMedia[];
  options: ProductOption[];
  size_chart: SizeRow[];
  bom: BomRow[];
  tech_pack_url: string;
  status: ProductStatus;
};

export function emptyProduct(): ProductValues {
  return {
    id: null,
    name: "",
    product_number: "",
    customer_product_number: "",
    description: "",
    price_usd: "",
    moq: "",
    main_material: "",
    category: "",
    tags: [],
    media: [],
    options: [],
    size_chart: [emptySizeRow()],
    bom: [emptyBomRow()],
    tech_pack_url: "",
    status: "draft",
  };
}

/** Trimmed, empties dropped, repeats (any case) dropped: "28, 30, 30 " → ["28", "30"]. */
export function cleanValues(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const v = raw.trim();
    if (!v || seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase());
    out.push(v);
  }
  return out;
}

export const VARIANT_CAP = 500;

/**
 * Every combination of the options' values, first option varying slowest
 * (Waist 28 · Mid-wash, Waist 28 · Black, Waist 30 · Mid-wash …). An option
 * with no values contributes nothing; a nameless one is "Option N". `total`
 * is the full count even when `rows` stops at `cap`, so the form can say how
 * many it left out.
 */
export function variantMatrix(
  options: readonly ProductOption[],
  cap: number = VARIANT_CAP,
): { options: ProductOption[]; columns: string[]; rows: string[][]; total: number } {
  const used = options
    .map((o, i) => ({ name: o.name.trim() || `Option ${i + 1}`, values: cleanValues(o.values) }))
    .filter((o) => o.values.length > 0);
  if (used.length === 0) return { options: [], columns: [], rows: [], total: 0 };
  const total = used.reduce((n, o) => n * o.values.length, 1);
  // Mixed-radix counting: row k's digit for option i is its value index.
  const rows = Array.from({ length: Math.min(total, cap) }, (_, k) => {
    const row: string[] = [];
    for (let i = used.length - 1, r = k; i >= 0; i--) {
      const vs = used[i]!.values;
      row[i] = vs[r % vs.length]!;
      r = Math.floor(r / vs.length);
    }
    return row;
  });
  return { options: used, columns: used.map((o) => o.name), rows, total };
}

export type ProductErrors = Partial<Record<"name" | "price_usd" | "moq", string>>;

/** The fields a save refuses on, in the buyer's words. Empty object = fine. */
export function validateProduct(v: Pick<ProductValues, "name" | "price_usd" | "moq">): ProductErrors {
  const e: ProductErrors = {};
  if (!v.name.trim()) e.name = "Give the product a name.";
  if (v.price_usd.trim()) {
    const n = Number(v.price_usd);
    if (!Number.isFinite(n) || n < 0) e.price_usd = "Enter a price of 0 or more, in US dollars.";
  }
  if (v.moq.trim()) {
    const n = Number(v.moq);
    if (!Number.isInteger(n) || n < 0) e.moq = "Enter a whole number of pieces.";
  }
  return e;
}

const text = (s: string): string | null => s.trim() || null;
const num = (s: string): number | null => (s.trim() ? Number(s) : null);
const trimRow = <T extends Record<string, string>>(r: T): T =>
  Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.trim()])) as T;
const filled = (r: Record<string, string>) => Object.values(r).some(Boolean);

/**
 * The body of `{ action: "upsert", product }` in 0106's shape: trimmed, typed,
 * empty rows dropped, the variants as `{options, rows}` with each row keyed by
 * option name. Call after `validateProduct`.
 */
export function toPayload(v: ProductValues, status: ProductStatus) {
  const m = variantMatrix(v.options);
  return {
    ...(v.id ? { id: v.id } : {}),
    name: v.name.trim(),
    product_number: text(v.product_number),
    customer_product_number: text(v.customer_product_number),
    description: text(v.description),
    price_usd: num(v.price_usd),
    moq: num(v.moq),
    main_material: text(v.main_material),
    category: text(v.category),
    tags: cleanValues(v.tags),
    media: v.media,
    variants: { options: m.options, rows: m.rows.map((r) => Object.fromEntries(m.columns.map((c, i) => [c, r[i]!]))) },
    size_chart: v.size_chart.map(trimRow).filter(filled),
    bom: v.bom.map(trimRow).filter(filled),
    tech_pack_url: text(v.tech_pack_url),
    status,
  };
}
export type ProductPayload = ReturnType<typeof toPayload>;

const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : "");
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

/** `buyer_product_get`'s row → the form's values. Anything missing or malformed reads as empty, never invented. */
export function fromProduct(raw: unknown): ProductValues {
  const p = rec(raw);
  const blank = emptyProduct();
  const status = PRODUCT_STATUSES.find((s) => s === p.status) ?? "draft";
  const sizeChart = list(p.size_chart).map((r) => {
    const o = rec(r);
    return { code: str(o.code), description: str(o.description), tol_minus: str(o.tol_minus), tol_plus: str(o.tol_plus), base: str(o.base) };
  });
  const bom = list(p.bom).map((r) => {
    const o = rec(r);
    return { part: str(o.part), material: str(o.material), qty: str(o.qty), color: str(o.color), notes: str(o.notes) };
  });
  return {
    id: str(p.id) || null,
    name: str(p.name),
    product_number: str(p.product_number),
    customer_product_number: str(p.customer_product_number),
    description: str(p.description),
    price_usd: str(p.price_usd),
    moq: str(p.moq),
    main_material: str(p.main_material),
    category: str(p.category),
    tags: list(p.tags).map(str).filter(Boolean),
    media: list(p.media)
      .map(rec)
      .filter((m) => typeof m.url === "string" && m.url && typeof m.kind === "string")
      .map((m) => ({ url: m.url as string, kind: m.kind as string })),
    options: list(rec(p.variants).options).map((o) => ({ name: str(rec(o).name), values: list(rec(o).values).map(str).filter(Boolean) })),
    size_chart: sizeChart.length ? sizeChart : blank.size_chart,
    bom: bom.length ? bom : blank.bom,
    tech_pack_url: str(p.tech_pack_url),
    status,
  };
}

/**
 * The route's own sentence, when it gave one: `/api/v1/products` answers a
 * field it refuses with a plain sentence ("Give the product a name.") and an
 * RPC failure with a function name plus `detail` — never shown to a buyer.
 */
export function routeSentence(json: unknown): string | null {
  const j = rec(json);
  const e = typeof j.error === "string" ? j.error.trim() : "";
  return e && j.detail === undefined && e.endsWith(".") ? e : null;
}

/** A file's own name from its storage URL, for the tech pack row: `…/tech-pack%20v2.pdf?t=1` → `tech-pack v2.pdf`. */
export function fileNameOf(url: string): string {
  const last = url.split("?")[0]!.split("/").pop() || url;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}
