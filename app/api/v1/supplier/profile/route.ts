// /api/v1/supplier/profile — Supplier Profile Editor (Spec S2).
//
// GET  ?list=mine                → caller's claimed-supplier list
// GET  ?supplier_id=<uuid>       → editable + register payload for one supplier
// POST { supplier_id, patch:{…} } → supplier_profile_upsert
//
// Auth in-handler via the Supabase user-scoped client; writes go through
// the SECURITY DEFINER `supplier_profile_upsert` RPC in migration 0034
// which re-checks ownership at the database (`claimed_by = auth.uid()`).
// API-layer existence check on `supplier_profile_get` returning NULL →
// 404 (deliberate: do not leak "owned by someone else" as 403).

import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Sb = Awaited<ReturnType<typeof createSupabaseServerClient>>;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function rpcStatus(detail: string): number {
  const d = detail.toLowerCase();
  if (d.includes("not authenticated")) return 401;
  if (d.includes("not your supplier") || d.includes("not a claimed supplier"))
    return 403;
  return 400;
}

export async function GET(req: Request) {
  const gate = await requireAuth();
  if (gate instanceof NextResponse) return gate;
  const { supabase, userId } = gate;

  const url = new URL(req.url);
  if (url.searchParams.get("list") === "mine") {
    const { data, error } = await supabase
      .from("suppliers")
      .select("id, slug, company_name, supplier_attested_at")
      .eq("claimed_by", userId)
      .eq("is_published", true)
      .order("company_name");
    if (error) {
      return NextResponse.json(
        { error: "list failed", detail: error.message },
        { status: 400 },
      );
    }
    return NextResponse.json({ suppliers: data ?? [] });
  }

  const supplierId = url.searchParams.get("supplier_id");
  if (!supplierId || !UUID_RE.test(supplierId)) {
    return NextResponse.json(
      { error: "supplier_id must be a uuid" },
      { status: 400 },
    );
  }
  const { data, error } = await supabase.rpc("supplier_profile_get", {
    p_supplier_id: supplierId,
  });
  if (error) {
    return NextResponse.json(
      { error: "supplier_profile_get failed", detail: error.message },
      { status: 400 },
    );
  }
  if (data === null) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ profile: data });
}

export async function POST(req: Request) {
  const gate = await requireAuth();
  if (gate instanceof NextResponse) return gate;
  const { supabase } = gate;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const supplierId = body.supplier_id;
  if (typeof supplierId !== "string" || !UUID_RE.test(supplierId)) {
    return NextResponse.json(
      { error: "supplier_id must be a uuid" },
      { status: 400 },
    );
  }
  const rawPatch = body.patch;
  if (
    rawPatch === null ||
    typeof rawPatch !== "object" ||
    Array.isArray(rawPatch)
  ) {
    return NextResponse.json(
      { error: "patch must be an object" },
      { status: 400 },
    );
  }
  // Forward as-is; the RPC owns the allow-list, type, and length rules.
  // Adding the supplier_id key alongside the patch fields lets the RPC do
  // one `update … where id = … and claimed_by = auth.uid()`.
  const p_patch = { ...(rawPatch as Record<string, unknown>), supplier_id: supplierId };

  const { data, error } = await supabase.rpc("supplier_profile_upsert", {
    p_patch,
  });
  if (error) {
    return NextResponse.json(
      { error: "supplier_profile_upsert failed", detail: error.message },
      { status: rpcStatus(error.message) },
    );
  }
  return NextResponse.json({ result: data });
}
