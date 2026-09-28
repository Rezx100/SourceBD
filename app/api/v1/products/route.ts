// /api/v1/products — the buyer's own product base (migration 0106).
//
// GET                                         → { products: [...] }  buyer_product_list
// GET    ?id=<uuid>                           → { product }  | 404    buyer_product_get
// POST   { action: "upsert", product: {...} } → { id }               buyer_product_upsert
// POST   { action: "set_status", id, status } → { ok: true } | 404   buyer_product_set_status
// DELETE ?id=<uuid>                           → { ok: true } | 404   buyer_product_delete
//
// Auth + ownership: 401 without a session. Every RPC is SECURITY DEFINER and
// scoped to auth.uid(), so another buyer's id is "not found". This handler
// checks the shape first (400 with a plain sentence) and the RPC checks it
// again. Every response passes through stripContactKeys.

import { NextResponse } from "next/server";

import { stripContactKeys } from "@/lib/strip-contact-keys";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Obj = Record<string, unknown>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const URL_RE = /^https?:\/\/\S+$/i;
const STATUSES = ["draft", "active", "archived"];
const MEDIA_KINDS = ["image", "video", "model", "tech_pack"];
const MAX_BYTES = 256 * 1024;

const TEXT_FIELDS: Record<string, [label: string, max: number]> = {
  name: ["The name", 200],
  product_number: ["The product number", 64],
  customer_product_number: ["The customer's product number", 64],
  description: ["The description", 8000],
  main_material: ["The main material", 200],
  category: ["The category", 80],
};
const NUMBER_FIELDS: Record<string, string> = { price_usd: "The price", moq: "The MOQ" };
const PRODUCT_KEYS = new Set([
  "id",
  ...Object.keys(TEXT_FIELDS),
  ...Object.keys(NUMBER_FIELDS),
  "tags",
  "media",
  "variants",
  "size_chart",
  "bom",
  "tech_pack_url",
  "status",
]);

const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

function statusFor(message: string): number {
  if (/not authenticated/i.test(message)) return 401;
  if (/not found/i.test(message)) return 404;
  return 400;
}

async function requireAuth() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? supabase : null;
}

/** Rows of plain named values: the size chart, the bill of materials, variant rows. */
function rowsError(value: unknown, label: string, max: number): string | null {
  if (value == null) return null;
  if (!Array.isArray(value) || value.length > max) return `The ${label} can hold up to ${max} rows.`;
  for (const row of value) {
    if (!isObj(row) || Object.keys(row).length > 30) return `Each row of the ${label} must be a set of named values.`;
    for (const [key, v] of Object.entries(row)) {
      const plain = v === null || ["string", "number", "boolean"].includes(typeof v);
      if (key.length > 64 || !plain || String(v).length > 500) {
        return `Each value in the ${label} must be text or a number of 500 characters or fewer.`;
      }
    }
  }
  return null;
}

/** The first thing wrong with a product, as a sentence, or null. */
function productError(p: Obj): string | null {
  if (p.id != null && (typeof p.id !== "string" || !UUID_RE.test(p.id))) return "That product id is not valid.";
  if ((p.id == null || "name" in p) && (typeof p.name !== "string" || !p.name.trim())) {
    return "Give the product a name.";
  }
  for (const [key, [label, max]] of Object.entries(TEXT_FIELDS)) {
    const v = p[key];
    if (v == null) continue;
    if (typeof v !== "string") return `${label} must be text.`;
    if (v.trim().length > max) return `${label} must be ${max} characters or fewer.`;
  }
  for (const [key, label] of Object.entries(NUMBER_FIELDS)) {
    const v = p[key];
    if (v == null || v === "") continue;
    const n = typeof v === "number" || typeof v === "string" ? Number(v) : Number.NaN;
    if (!Number.isFinite(n) || n < 0) return `${label} must be a number of 0 or more.`;
  }
  if (p.tags != null) {
    if (!Array.isArray(p.tags) || p.tags.some((t) => typeof t !== "string" || t.trim().length > 40)) {
      return "Tags must be a list of words of 40 characters or fewer.";
    }
    if (p.tags.filter((t) => (t as string).trim()).length > 20) return "A product can have up to 20 tags.";
  }
  if (p.media != null) {
    if (!Array.isArray(p.media) || p.media.length > 20) return "A product can hold up to 20 files.";
    for (const m of p.media) {
      if (!isObj(m) || typeof m.url !== "string" || !URL_RE.test(m.url) || m.url.length > 1000) {
        return "Each file needs a web address starting with http:// or https://.";
      }
      if (!MEDIA_KINDS.includes(m.kind as string)) return "Each file must be an image, a video, a 3D model or a tech pack.";
    }
  }
  if (p.variants != null) {
    if (!isObj(p.variants)) return "Variants must be a set of options and rows.";
    const options = p.variants.options ?? [];
    if (!Array.isArray(options) || options.length > 10) return "A product can have up to 10 variant options.";
    for (const o of options) {
      const values = isObj(o) ? o.values : null;
      if (!isObj(o) || typeof o.name !== "string" || !o.name.trim() || o.name.trim().length > 60) {
        return "Each variant option needs a name of 60 characters or fewer.";
      }
      if (!Array.isArray(values) || values.length > 100 || values.some((v) => typeof v !== "string" || v.length > 80)) {
        return "Each variant option can list up to 100 values of 80 characters or fewer.";
      }
    }
    const rows = rowsError(p.variants.rows, "variants", 500);
    if (rows) return rows;
  }
  const chart = rowsError(p.size_chart, "size chart", 60) ?? rowsError(p.bom, "bill of materials", 100);
  if (chart) return chart;
  if (p.tech_pack_url != null && p.tech_pack_url !== "") {
    if (typeof p.tech_pack_url !== "string" || !URL_RE.test(p.tech_pack_url) || p.tech_pack_url.length > 1000) {
      return "The tech pack must be a web address starting with http:// or https://.";
    }
  }
  if (p.status != null && !STATUSES.includes(p.status as string)) return "Status must be draft, active or archived.";
  if (JSON.stringify(p).length > MAX_BYTES) return "This product is too large to save. Keep it under 256 KB.";
  return null;
}

export async function GET(req: Request) {
  const supabase = await requireAuth();
  if (!supabase) return bad("unauthorised", 401);

  const id = new URL(req.url).searchParams.get("id");
  if (id !== null) {
    if (!UUID_RE.test(id)) return bad("That product id is not valid.");
    const { data, error } = await supabase.rpc("buyer_product_get", { p_id: id });
    if (error) {
      return NextResponse.json({ error: "buyer_product_get failed", detail: error.message }, { status: statusFor(error.message) });
    }
    if (data == null) return bad("not found", 404);
    return NextResponse.json({ product: stripContactKeys(data) });
  }

  const { data, error } = await supabase.rpc("buyer_product_list");
  if (error) {
    return NextResponse.json({ error: "buyer_product_list failed", detail: error.message }, { status: statusFor(error.message) });
  }
  return NextResponse.json({ products: stripContactKeys(data ?? []) });
}

export async function POST(req: Request) {
  const supabase = await requireAuth();
  if (!supabase) return bad("unauthorised", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad("invalid JSON");
  }
  if (!isObj(body)) return bad("body must be an object");

  if (body.action === "upsert") {
    if (!isObj(body.product)) return bad("Send the product to save.");
    const problem = productError(body.product);
    if (problem) return bad(problem);
    const product = Object.fromEntries(Object.entries(body.product).filter(([key]) => PRODUCT_KEYS.has(key)));
    const { data, error } = await supabase.rpc("buyer_product_upsert", { p_input: product });
    if (error) {
      return NextResponse.json({ error: "buyer_product_upsert failed", detail: error.message }, { status: statusFor(error.message) });
    }
    return NextResponse.json({ id: data });
  }

  if (body.action === "set_status") {
    if (typeof body.id !== "string" || !UUID_RE.test(body.id)) return bad("That product id is not valid.");
    if (!STATUSES.includes(body.status as string)) return bad("Status must be draft, active or archived.");
    const { error } = await supabase.rpc("buyer_product_set_status", { p_id: body.id, p_status: body.status });
    if (error) {
      return NextResponse.json({ error: "buyer_product_set_status failed", detail: error.message }, { status: statusFor(error.message) });
    }
    return NextResponse.json({ ok: true });
  }

  return bad("unknown action; expected one of upsert|set_status");
}

export async function DELETE(req: Request) {
  const supabase = await requireAuth();
  if (!supabase) return bad("unauthorised", 401);

  const id = new URL(req.url).searchParams.get("id");
  if (!id || !UUID_RE.test(id)) return bad("That product id is not valid.");
  const { error } = await supabase.rpc("buyer_product_delete", { p_id: id });
  if (error) {
    return NextResponse.json({ error: "buyer_product_delete failed", detail: error.message }, { status: statusFor(error.message) });
  }
  return NextResponse.json({ ok: true });
}
