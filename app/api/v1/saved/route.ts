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
