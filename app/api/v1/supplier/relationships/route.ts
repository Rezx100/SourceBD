// /api/v1/supplier/relationships — Factory ↔ Buying-house partnerships (Spec S5).
//
// GET  ?action=list&supplier_id=<uuid>&status=<…>  → viewer-symmetric list
// GET  ?action=search&q=<text>&entity_type=<bh|factory>  → request typeahead
// POST { action: "request",  buying_house_id, factory_id, note? } → { id }
// POST { action: "decide",   id, accept: bool, note? }            → { ok }
// POST { action: "revoke",   id }                                  → { ok }
//
// Auth: requireAnyAuth() (buyer | supplier | admin) — buyers may hit GET
// because the supplier portal shares the auth surface, but every write
// is gated to supplier/admin AND re-checked by the SECURITY DEFINER RPC
// (which enforces `suppliers.claimed_by = auth.uid()` regardless).

import { NextResponse } from "next/server";

import { getServerRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_NOTE = 1000;

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
  const m = message.toLowerCase();
  if (m.includes("not authenticated")) return 401;
  if (
    m.includes("does not own") ||
    m.includes("not your supplier") ||
    m.includes("only the factory side") ||
    m.includes("only the buying house side")
  ) {
    return 403;
  }
  if (m.includes("not found")) return 404;
  return 400;
}

export async function GET(req: Request) {
  const gate = await requireAnyAuth();
  if (gate.error) return gate.error;
  const supabase = await createSupabaseServerClient();

  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "list";

  if (action === "list") {
    const supplierId = url.searchParams.get("supplier_id");
    if (supplierId && !UUID_RE.test(supplierId)) {
      return NextResponse.json(
        { error: "supplier_id must be a uuid" },
        { status: 400 },
      );
    }
    const statusRaw = url.searchParams.get("status");
    const status =
      statusRaw &&
      ["pending", "accepted", "rejected", "revoked"].includes(statusRaw)
        ? statusRaw
        : null;
    const { data, error } = await supabase.rpc("supplier_relationship_list", {
      p_supplier_id: supplierId ?? null,
      p_status: status,
    });
    if (error) {
      return NextResponse.json(
        { error: "list failed", detail: error.message },
        { status: errStatus(error.message) },
      );
    }
    return NextResponse.json({ relationships: data ?? [] });
  }

  if (action === "search") {
    const q = (url.searchParams.get("q") ?? "").trim();
    const entityType = url.searchParams.get("entity_type") ?? "";
    if (entityType !== "buying_house" && entityType !== "factory") {
      return NextResponse.json(
        { error: "entity_type must be buying_house or factory" },
        { status: 400 },
      );
    }
    if (q.length === 0) {
      return NextResponse.json({ results: [] });
    }
    const { data, error } = await supabase.rpc("supplier_relationship_search", {
      p_q: q,
      p_target_entity_type: entityType,
    });
    if (error) {
      return NextResponse.json(
        { error: "search failed", detail: error.message },
        { status: errStatus(error.message) },
      );
    }
    return NextResponse.json({ results: data ?? [] });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

export async function POST(req: Request) {
  const gate = await requireAnyAuth();
  if (gate.error) return gate.error;
  if (gate.role !== "supplier" && gate.role !== "admin") {
    return NextResponse.json({ error: "supplier only" }, { status: 403 });
  }
  const supabase = await createSupabaseServerClient();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: "body must be an object" },
      { status: 400 },
    );
  }
  const obj = body as Record<string, unknown>;
  const action = obj.action;

  if (action === "request") {
    const bh = obj.buying_house_id;
    const fac = obj.factory_id;
    if (typeof bh !== "string" || !UUID_RE.test(bh)) {
      return NextResponse.json(
        { error: "buying_house_id must be a uuid" },
        { status: 400 },
      );
    }
    if (typeof fac !== "string" || !UUID_RE.test(fac)) {
      return NextResponse.json(
        { error: "factory_id must be a uuid" },
        { status: 400 },
      );
    }
    let note: string | null = null;
    if (typeof obj.note === "string" && obj.note.trim().length > 0) {
      note = obj.note.trim();
      if (note.length > MAX_NOTE) {
        return NextResponse.json(
          { error: `note exceeds ${MAX_NOTE} characters` },
          { status: 400 },
        );
      }
    }
    const { data, error } = await supabase.rpc(
      "supplier_relationship_request",
      {
        p_buying_house_id: bh,
        p_factory_id: fac,
        p_note: note,
      },
    );
    if (error) {
      return NextResponse.json(
        { error: "request failed", detail: error.message },
        { status: errStatus(error.message) },
      );
    }
    return NextResponse.json({ id: data });
  }

  if (action === "decide") {
    const id = obj.id;
    if (typeof id !== "string" || !UUID_RE.test(id)) {
      return NextResponse.json(
        { error: "id must be a uuid" },
        { status: 400 },
      );
    }
    if (typeof obj.accept !== "boolean") {
      return NextResponse.json(
        { error: "accept must be a boolean" },
        { status: 400 },
      );
    }
    let note: string | null = null;
    if (typeof obj.note === "string" && obj.note.trim().length > 0) {
      note = obj.note.trim();
      if (note.length > MAX_NOTE) {
        return NextResponse.json(
          { error: `note exceeds ${MAX_NOTE} characters` },
          { status: 400 },
        );
      }
    }
    const { error } = await supabase.rpc("supplier_relationship_decide", {
      p_id: id,
      p_accept: obj.accept,
      p_note: note,
    });
    if (error) {
      return NextResponse.json(
        { error: "decide failed", detail: error.message },
        { status: errStatus(error.message) },
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "revoke") {
    const id = obj.id;
    if (typeof id !== "string" || !UUID_RE.test(id)) {
      return NextResponse.json(
        { error: "id must be a uuid" },
        { status: 400 },
      );
    }
    const { error } = await supabase.rpc("supplier_relationship_revoke", {
      p_id: id,
    });
    if (error) {
      return NextResponse.json(
        { error: "revoke failed", detail: error.message },
        { status: errStatus(error.message) },
      );
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
