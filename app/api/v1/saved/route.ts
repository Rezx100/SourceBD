// GET  /api/v1/saved   → { rows } — the caller's saved suppliers, newest first,
//                        up to 100, for the RFQ composer's supplier picker.
//                        Read through `buyer_saved_list` (0026), whose RETURNS
//                        carries no contact column and no SBI.
// POST /api/v1/saved   — { supplier_id } or { supplier_ids: [...] } → one
//                        upsert into saved_suppliers (lib/saved-suppliers.ts)
// DELETE /api/v1/saved?supplier_id=<uuid> → delete the caller's saved row
//
// Spec B5 (saved suppliers). The `(app)/app/*` middleware does NOT cover
// `/api/*`, so this handler enforces buyer/admin auth itself via
// `getServerRole()`. Inserts and deletes run through the user-scoped
// supabase client so RLS policies (`pol_saved_suppliers_*_self`) keyed by
// `auth.uid()` enforce ownership at the database. The handler is a thin
// gate — never trust the wire `owner_id`; we never read it from the body.

import { NextResponse } from "next/server";

import { getServerRole } from "@/lib/auth";
import { runSavedSupplierPost } from "@/lib/saved-suppliers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requireBuyer() {
  const role = await getServerRole();
  if (role !== "buyer" && role !== "admin") {
    return {
      role: null,
      error: NextResponse.json({ error: "unauthorised" }, { status: 401 }),
    } as const;
  }
  return { role, error: null } as const;
}

export async function GET() {
  const gate = await requireBuyer();
  if (gate.error) return gate.error;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("buyer_saved_list", { p_sort: "recent", p_limit: 100, p_offset: 0 });
  if (error) {
    return NextResponse.json({ error: "Your saved suppliers could not be read just now." }, { status: 502 });
  }
  // Named fields only, so nothing the RPC might add later leaves by accident.
  const rows = ((Array.isArray(data) ? data : []) as Record<string, unknown>[])
    .filter((r) => typeof r.id === "string" && typeof r.slug === "string")
    .map((r) => ({
      id: r.id as string,
      slug: r.slug as string,
      company_name: String(r.company_name ?? ""),
      entity_type: typeof r.entity_type === "string" ? r.entity_type : null,
      city: typeof r.city === "string" ? r.city : null,
      district: typeof r.district === "string" ? r.district : null,
      source_tags: Array.isArray(r.source_tags) ? r.source_tags.filter((t): t is string => typeof t === "string") : null,
    }));
  return NextResponse.json({ rows }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: Request) {
  // Role first: a caller who is not a buyer is refused before their body is
  // read (runSavedSupplierPost returns 401 without looking at `raw`).
  const role = await getServerRole();
  let raw: unknown;
  if (role === "buyer" || role === "admin") {
    try {
      raw = await req.json();
    } catch {
      raw = undefined;
    }
  }
  const result = await runSavedSupplierPost({
    role,
    supabase: await createSupabaseServerClient(),
    raw,
  });
  return NextResponse.json(result.body, { status: result.status });
}

export async function DELETE(req: Request) {
  const gate = await requireBuyer();
  if (gate.error) return gate.error;

  const url = new URL(req.url);
  const supplierId = url.searchParams.get("supplier_id");
  if (!supplierId || !UUID_RE.test(supplierId)) {
    return NextResponse.json({ error: "invalid supplier_id" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: user } = await supabase.auth.getUser();
  const ownerId = user.user?.id;
  if (!ownerId) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const { error } = await supabase
    .from("saved_suppliers")
    .delete()
    .eq("owner_id", ownerId)
    .eq("supplier_id", supplierId);
  if (error) {
    return NextResponse.json({ error: "unsave failed", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, saved: false });
}
