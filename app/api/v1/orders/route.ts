// /api/v1/orders — Manual order tracking (Spec B8).
//
// Endpoints:
//   GET  /api/v1/orders?status=in_production    → { orders: [...] }
//   GET  /api/v1/orders?id=<uuid>               → { order:  {...} }
//   POST /api/v1/orders
//     { action: "create", ...inputs }           → { order_id }
//     { action: "update", order_id, patch:{...} } → { ok: true }
//     { action: "add_milestone", order_id, kind, ... } → { milestone_id }
//     { action: "cancel", order_id }            → { ok: true }
//
// Auth: any authenticated user. RPCs are SECURITY DEFINER and enforce
// buyer-only / claimed-supplier gating + RLS visibility internally —
// this handler is a thin input validator that forwards to them.

import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_TITLE = 200;
const MAX_PO = 64;
const MAX_PORT = 128;
const MAX_TEXT_64 = 64;
const MAX_NOTES = 4000;
const MAX_LABEL = 200;
const MAX_CARRIER = 128;
const MAX_TRACKING = 128;
const INCOTERMS = new Set(["FOB", "CIF", "EXW", "DDP", "DAP"]);
const STATUSES = new Set([
  "draft",
  "in_production",
  "shipped",
  "in_transit",
  "delivered",
  "cancelled",
]);
const MILESTONE_KINDS = new Set([
  "po_issued",
  "materials_sourced",
  "production_started",
  "qc_passed",
  "shipped",
  "customs_cleared",
  "delivered",
  "custom",
]);

type Sb = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function requireAuth(): Promise<
  { supabase: Sb; userId: string } | NextResponse
> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  return { supabase, userId: user.id };
}

function errStatus(message: string): number {
  if (/not authenticated/i.test(message)) return 401;
  if (/is not a (buyer|supplier)/i.test(message)) return 403;
  if (/does not own|caller cannot/i.test(message)) return 403;
  if (/not found/i.test(message)) return 404;
  return 400;
}

function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime());
}

export async function GET(req: Request) {
  const gate = await requireAuth();
  if (gate instanceof NextResponse) return gate;
  const { supabase } = gate;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (id) {
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "invalid id" }, { status: 400 });
    }
    const { data, error } = await supabase.rpc("order_get", { p_id: id });
    if (error) {
      return NextResponse.json(
        { error: "order_get failed", detail: error.message },
        { status: errStatus(error.message) },
      );
    }
    if (data == null) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({ order: data });
  }

  const statusRaw = url.searchParams.get("status");
  const status = statusRaw && STATUSES.has(statusRaw) ? statusRaw : null;
  const { data, error } = await supabase.rpc("order_list", { p_status: status });
  if (error) {
    return NextResponse.json(
      { error: "order_list failed", detail: error.message },
      { status: errStatus(error.message) },
    );
  }
  return NextResponse.json({ orders: data ?? [] });
}

export async function POST(req: Request) {
  const gate = await requireAuth();
  if (gate instanceof NextResponse) return gate;
  const { supabase } = gate;

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
    const payload: Record<string, unknown> = {};

    if (obj.accepted_quote_id != null && obj.accepted_quote_id !== "") {
      if (typeof obj.accepted_quote_id !== "string" || !UUID_RE.test(obj.accepted_quote_id)) {
        return NextResponse.json(
          { error: "invalid accepted_quote_id" },
          { status: 400 },
        );
      }
      payload.accepted_quote_id = obj.accepted_quote_id;
    } else {
      if (typeof obj.supplier_id !== "string" || !UUID_RE.test(obj.supplier_id)) {
        return NextResponse.json({ error: "invalid supplier_id" }, { status: 400 });
      }
      payload.supplier_id = obj.supplier_id;
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
      payload.product_title = title;
      const quantityNum = Number(obj.quantity);
      if (!Number.isFinite(quantityNum) || quantityNum <= 0) {
        return NextResponse.json({ error: "quantity must be > 0" }, { status: 400 });
      }
      payload.quantity = quantityNum;
      const unit = typeof obj.quantity_unit === "string" ? obj.quantity_unit.trim() : "";
      if (!unit) {
        return NextResponse.json({ error: "quantity_unit is required" }, { status: 400 });
      }
      payload.quantity_unit = unit.slice(0, 32);
    }

    if (obj.product_title != null && typeof obj.product_title === "string"
        && obj.product_title.trim() && payload.product_title == null) {
      payload.product_title = obj.product_title.trim().slice(0, MAX_TITLE);
    }
    if (obj.unit_price != null && obj.unit_price !== "") {
      const v = Number(obj.unit_price);
      if (!Number.isFinite(v) || v <= 0) {
        return NextResponse.json({ error: "unit_price must be > 0" }, { status: 400 });
      }
      payload.unit_price = v;
    }
    if (typeof obj.currency === "string" && obj.currency.trim()) {
      const cur = obj.currency.trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(cur)) {
        return NextResponse.json(
          { error: "currency must be a 3-letter code" },
          { status: 400 },
        );
      }
      payload.currency = cur;
    }
    if (typeof obj.po_number === "string" && obj.po_number.trim()) {
      payload.po_number = obj.po_number.trim().slice(0, MAX_PO);
    }
    if (typeof obj.incoterm === "string" && obj.incoterm.trim()) {
      const v = obj.incoterm.trim().toUpperCase();
      if (!INCOTERMS.has(v)) {
        return NextResponse.json(
          { error: "incoterm must be one of FOB / CIF / EXW / DDP / DAP" },
          { status: 400 },
        );
      }
      payload.incoterm = v;
    }
    for (const key of ["origin_port", "destination_port"] as const) {
      const v = obj[key];
      if (typeof v === "string" && v.trim()) {
        payload[key] = v.trim().slice(0, MAX_PORT);
      }
    }
    if (typeof obj.ship_to_country === "string" && obj.ship_to_country.trim()) {
      payload.ship_to_country = obj.ship_to_country.trim().slice(0, MAX_TEXT_64);
    }
    for (const key of ["target_ship_date", "target_delivery_date"] as const) {
      const v = obj[key];
      if (typeof v === "string" && v.trim()) {
        if (!isIsoDate(v.trim())) {
          return NextResponse.json({ error: `invalid ${key}` }, { status: 400 });
        }
        payload[key] = v.trim();
      }
    }
    if (typeof obj.notes === "string" && obj.notes.trim()) {
      const t = obj.notes.trim();
      if (t.length > MAX_NOTES) {
        return NextResponse.json(
          { error: `notes exceeds ${MAX_NOTES}` },
          { status: 400 },
        );
      }
      payload.notes = t;
    }

    const { data, error } = await supabase.rpc("order_create", { p_input: payload });
    if (error) {
      return NextResponse.json(
        { error: "order_create failed", detail: error.message },
        { status: errStatus(error.message) },
      );
    }
    return NextResponse.json({ order_id: data });
  }

  if (action === "update") {
    const orderId = obj.order_id;
    if (typeof orderId !== "string" || !UUID_RE.test(orderId)) {
      return NextResponse.json({ error: "invalid order_id" }, { status: 400 });
    }
    const patchIn =
      obj.patch && typeof obj.patch === "object" && !Array.isArray(obj.patch)
        ? (obj.patch as Record<string, unknown>)
        : obj;
    const patch: Record<string, unknown> = {};

    if (typeof patchIn.status === "string") {
      if (!STATUSES.has(patchIn.status)) {
        return NextResponse.json({ error: "invalid status" }, { status: 400 });
      }
      if (patchIn.status === "cancelled") {
        return NextResponse.json(
          { error: "use action=cancel to cancel an order" },
          { status: 400 },
        );
      }
      patch.status = patchIn.status;
    }
    if (typeof patchIn.incoterm === "string") {
      if (patchIn.incoterm.trim() === "") {
        patch.incoterm = "";
      } else {
        const v = patchIn.incoterm.trim().toUpperCase();
        if (!INCOTERMS.has(v)) {
          return NextResponse.json(
            { error: "incoterm must be one of FOB / CIF / EXW / DDP / DAP" },
            { status: 400 },
          );
        }
        patch.incoterm = v;
      }
    }
    for (const key of [
      "carrier_name",
      "tracking_number",
      "po_number",
      "origin_port",
      "destination_port",
      "ship_to_country",
      "notes",
    ] as const) {
      const v = patchIn[key];
      if (typeof v === "string") {
        const trimmed = v.trim();
        const cap =
          key === "notes"
            ? MAX_NOTES
            : key === "carrier_name"
            ? MAX_CARRIER
            : key === "tracking_number"
            ? MAX_TRACKING
            : key === "po_number"
            ? MAX_PO
            : key === "ship_to_country"
            ? MAX_TEXT_64
            : MAX_PORT;
        if (trimmed.length > cap) {
          return NextResponse.json({ error: `${key} exceeds ${cap}` }, { status: 400 });
        }
        patch[key] = trimmed;
      }
    }
    for (const key of [
      "target_ship_date",
      "target_delivery_date",
      "actual_ship_date",
      "actual_delivery_date",
    ] as const) {
      const v = patchIn[key];
      if (typeof v === "string") {
        const trimmed = v.trim();
        if (trimmed && !isIsoDate(trimmed)) {
          return NextResponse.json({ error: `invalid ${key}` }, { status: 400 });
        }
        patch[key] = trimmed;
      }
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "patch is empty" }, { status: 400 });
    }

    const { error } = await supabase.rpc("order_update", {
      p_id: orderId,
      p_patch: patch,
    });
    if (error) {
      return NextResponse.json(
        { error: "order_update failed", detail: error.message },
        { status: errStatus(error.message) },
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "add_milestone") {
    const orderId = obj.order_id;
    if (typeof orderId !== "string" || !UUID_RE.test(orderId)) {
      return NextResponse.json({ error: "invalid order_id" }, { status: 400 });
    }
    const kind = obj.kind;
    if (typeof kind !== "string" || !MILESTONE_KINDS.has(kind)) {
      return NextResponse.json({ error: "invalid kind" }, { status: 400 });
    }
    const payload: Record<string, unknown> = { kind };
    if (typeof obj.label === "string" && obj.label.trim()) {
      const t = obj.label.trim();
      if (t.length > MAX_LABEL) {
        return NextResponse.json(
          { error: `label exceeds ${MAX_LABEL}` },
          { status: 400 },
        );
      }
      payload.label = t;
    }
    if (typeof obj.occurred_on === "string" && obj.occurred_on.trim()) {
      const v = obj.occurred_on.trim();
      if (!isIsoDate(v)) {
        return NextResponse.json({ error: "invalid occurred_on" }, { status: 400 });
      }
      payload.occurred_on = v;
    }
    if (typeof obj.notes === "string" && obj.notes.trim()) {
      const t = obj.notes.trim();
      if (t.length > MAX_NOTES) {
        return NextResponse.json(
          { error: `notes exceeds ${MAX_NOTES}` },
          { status: 400 },
        );
      }
      payload.notes = t;
    }

    const { data, error } = await supabase.rpc("order_milestone_add", {
      p_order_id: orderId,
      p_input: payload,
    });
    if (error) {
      return NextResponse.json(
        { error: "order_milestone_add failed", detail: error.message },
        { status: errStatus(error.message) },
      );
    }
    return NextResponse.json({ milestone_id: data });
  }

  if (action === "cancel") {
    const orderId = obj.order_id;
    if (typeof orderId !== "string" || !UUID_RE.test(orderId)) {
      return NextResponse.json({ error: "invalid order_id" }, { status: 400 });
    }
    const { error } = await supabase.rpc("order_cancel", { p_id: orderId });
    if (error) {
      return NextResponse.json(
        { error: "order_cancel failed", detail: error.message },
        { status: errStatus(error.message) },
      );
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
