// /api/v1/rfqs — Buyer composes an RFQ, suppliers submit quotes, buyer
// accepts one. Spec B7 + Spec S4 (supplier-side surfaces).
//
// Endpoints:
//   GET  /api/v1/rfqs?status=open                → { rfqs: [...] }
//   GET  /api/v1/rfqs?id=<uuid>                  → { rfq:  {...} }
//   POST /api/v1/rfqs
//     { action: "create", ... }                  → { rfq_id }     (buyer/admin)
//     { action: "submit_quote", rfq_id, ... }    → { quote_id }   (supplier/admin)
//     { action: "accept_quote", quote_id }       → { ok: true }   (buyer/admin)
//
// Auth: any authenticated user may hit GET + POST; per-action role gates
// below mirror the S3 messages handler (read symmetric, writes gated by
// the action's authoring side). RPCs are SECURITY DEFINER and re-enforce
// the role check + RLS visibility — this handler is a thin input
// validator that forwards to them.

import { NextResponse } from "next/server";

import { getServerRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_TITLE = 200;
const MAX_DESC = 4000;
const MAX_NOTES = 4000;
const MAX_TARGETS = 50;

async function requireAnyAuth() {
  const role = await getServerRole();
  if (role !== "buyer" && role !== "supplier" && role !== "admin") {
    return {
      role: null,
      error: NextResponse.json({ error: "unauthorised" }, { status: 401 }),
    } as const;
  }
  return { role, error: null } as const;
}

function errStatus(message: string): number {
  if (/not authenticated/i.test(message)) return 401;
  if (/is not a (buyer|supplier)/i.test(message)) return 403;
  if (/does not own|no claimed supplier/i.test(message)) return 403;
  if (/not found/i.test(message)) return 404;
  return 400;
}

export async function GET(req: Request) {
  const gate = await requireAnyAuth();
  if (gate.error) return gate.error;
  const supabase = await createSupabaseServerClient();

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (id) {
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "invalid id" }, { status: 400 });
    }
    const { data, error } = await supabase.rpc("rfq_get", { p_id: id });
    if (error) {
      return NextResponse.json(
        { error: "rfq_get failed", detail: error.message },
        { status: errStatus(error.message) },
      );
    }
    if (data == null) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({ rfq: data });
  }

  const statusRaw = url.searchParams.get("status");
  const status =
    statusRaw && ["open", "accepted", "closed", "cancelled"].includes(statusRaw)
      ? statusRaw
      : null;
  const { data, error } = await supabase.rpc("rfq_list", { p_status: status });
  if (error) {
    return NextResponse.json(
      { error: "rfq_list failed", detail: error.message },
      { status: errStatus(error.message) },
    );
  }
  return NextResponse.json({ rfqs: data ?? [] });
}

export async function POST(req: Request) {
  const gate = await requireAnyAuth();
  if (gate.error) return gate.error;
  const supabase = await createSupabaseServerClient();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "body must be an object" }, { status: 400 });
  }
  const obj = body as Record<string, unknown>;
  const action = obj.action;

  if (action === "create") {
    if (gate.role !== "buyer" && gate.role !== "admin") {
      return NextResponse.json({ error: "buyer only" }, { status: 403 });
    }
    const title = typeof obj.product_title === "string" ? obj.product_title.trim() : "";
    if (!title) {
      return NextResponse.json({ error: "product_title is required" }, { status: 400 });
    }
    if (title.length > MAX_TITLE) {
      return NextResponse.json(
        { error: `product_title exceeds ${MAX_TITLE}` },
        { status: 400 },
      );
    }
    const desc =
      typeof obj.product_description === "string"
        ? obj.product_description.trim()
        : "";
    if (desc.length > MAX_DESC) {
      return NextResponse.json(
        { error: `product_description exceeds ${MAX_DESC}` },
        { status: 400 },
      );
    }
    const quantityNum = Number(obj.quantity);
    if (!Number.isFinite(quantityNum) || quantityNum <= 0) {
      return NextResponse.json({ error: "quantity must be > 0" }, { status: 400 });
    }
    const unit = typeof obj.quantity_unit === "string" ? obj.quantity_unit.trim() : "";
    if (!unit) {
      return NextResponse.json(
        { error: "quantity_unit is required" },
        { status: 400 },
      );
    }
    if (!Array.isArray(obj.target_supplier_ids) || obj.target_supplier_ids.length === 0) {
      return NextResponse.json(
        { error: "target_supplier_ids is required" },
        { status: 400 },
      );
    }
    if (obj.target_supplier_ids.length > MAX_TARGETS) {
      return NextResponse.json(
        { error: `target_supplier_ids exceeds ${MAX_TARGETS}` },
        { status: 400 },
      );
    }
    for (const sid of obj.target_supplier_ids) {
      if (typeof sid !== "string" || !UUID_RE.test(sid)) {
        return NextResponse.json(
          { error: "invalid supplier id in target_supplier_ids" },
          { status: 400 },
        );
      }
    }
    let targetUnitPrice: number | null = null;
    if (obj.target_unit_price != null && obj.target_unit_price !== "") {
      const v = Number(obj.target_unit_price);
      if (!Number.isFinite(v) || v <= 0) {
        return NextResponse.json(
          { error: "target_unit_price must be > 0" },
          { status: 400 },
        );
      }
      targetUnitPrice = v;
    }
    let currency: string | null = null;
    if (typeof obj.currency === "string" && obj.currency.trim().length > 0) {
      const cur = obj.currency.trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(cur)) {
        return NextResponse.json(
          { error: "currency must be a 3-letter code" },
          { status: 400 },
        );
      }
      currency = cur;
    }
    let shipToCountry: string | null = null;
    if (typeof obj.ship_to_country === "string" && obj.ship_to_country.trim()) {
      shipToCountry = obj.ship_to_country.trim().slice(0, 64);
    }
    let shipBy: string | null = null;
    if (typeof obj.ship_by === "string" && obj.ship_by.trim()) {
      const d = new Date(obj.ship_by);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "invalid ship_by" }, { status: 400 });
      }
      shipBy = obj.ship_by.trim();
    }

    const payload: Record<string, unknown> = {
      product_title: title,
      product_description: desc || null,
      quantity: quantityNum,
      quantity_unit: unit,
      target_supplier_ids: obj.target_supplier_ids,
    };
    if (targetUnitPrice != null) payload.target_unit_price = targetUnitPrice;
    if (currency != null) payload.currency = currency;
    if (shipToCountry != null) payload.ship_to_country = shipToCountry;
    if (shipBy != null) payload.ship_by = shipBy;

    const { data, error } = await supabase.rpc("rfq_create", { p_input: payload });
    if (error) {
      return NextResponse.json(
        { error: "rfq_create failed", detail: error.message },
        { status: errStatus(error.message) },
      );
    }
    return NextResponse.json({ rfq_id: data });
  }

  if (action === "submit_quote") {
    if (gate.role !== "supplier" && gate.role !== "admin") {
      return NextResponse.json({ error: "supplier only" }, { status: 403 });
    }
    const rfqId = obj.rfq_id;
    if (typeof rfqId !== "string" || !UUID_RE.test(rfqId)) {
      return NextResponse.json({ error: "invalid rfq_id" }, { status: 400 });
    }
    const unitPriceNum = Number(obj.unit_price);
    if (!Number.isFinite(unitPriceNum) || unitPriceNum <= 0) {
      return NextResponse.json({ error: "unit_price must be > 0" }, { status: 400 });
    }
    let currency: string | null = null;
    if (typeof obj.currency === "string" && obj.currency.trim().length > 0) {
      const cur = obj.currency.trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(cur)) {
        return NextResponse.json(
          { error: "currency must be a 3-letter code" },
          { status: 400 },
        );
      }
      currency = cur;
    }
    let leadTime: number | null = null;
    if (obj.lead_time_days != null && obj.lead_time_days !== "") {
      const n = Number(obj.lead_time_days);
      if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
        return NextResponse.json(
          { error: "lead_time_days must be a non-negative integer" },
          { status: 400 },
        );
      }
      leadTime = n;
    }
    let moq: number | null = null;
    if (obj.moq != null && obj.moq !== "") {
      const n = Number(obj.moq);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json({ error: "moq must be >= 0" }, { status: 400 });
      }
      moq = n;
    }
    let validUntil: string | null = null;
    if (typeof obj.valid_until === "string" && obj.valid_until.trim()) {
      const d = new Date(obj.valid_until);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "invalid valid_until" }, { status: 400 });
      }
      validUntil = obj.valid_until.trim();
    }
    let notes: string | null = null;
    if (typeof obj.notes === "string" && obj.notes.trim()) {
      const t = obj.notes.trim();
      if (t.length > MAX_NOTES) {
        return NextResponse.json(
          { error: `notes exceeds ${MAX_NOTES}` },
          { status: 400 },
        );
      }
      notes = t;
    }

    const payload: Record<string, unknown> = { unit_price: unitPriceNum };
    if (currency != null) payload.currency = currency;
    if (leadTime != null) payload.lead_time_days = leadTime;
    if (moq != null) payload.moq = moq;
    if (validUntil != null) payload.valid_until = validUntil;
    if (notes != null) payload.notes = notes;

    const { data, error } = await supabase.rpc("rfq_quote_submit", {
      p_rfq_id: rfqId,
      p_input: payload,
    });
    if (error) {
      return NextResponse.json(
        { error: "rfq_quote_submit failed", detail: error.message },
        { status: errStatus(error.message) },
      );
    }
    return NextResponse.json({ quote_id: data });
  }

  if (action === "accept_quote") {
    if (gate.role !== "buyer" && gate.role !== "admin") {
      return NextResponse.json({ error: "buyer only" }, { status: 403 });
    }
    const quoteId = obj.quote_id;
    if (typeof quoteId !== "string" || !UUID_RE.test(quoteId)) {
      return NextResponse.json({ error: "invalid quote_id" }, { status: 400 });
    }
    const { error } = await supabase.rpc("rfq_quote_accept", {
      p_quote_id: quoteId,
    });
    if (error) {
      return NextResponse.json(
        { error: "rfq_quote_accept failed", detail: error.message },
        { status: errStatus(error.message) },
      );
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
