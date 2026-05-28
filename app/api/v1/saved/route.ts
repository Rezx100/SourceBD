// POST /api/v1/saved   — { supplier_id } → insert into saved_suppliers
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
  const gate = await requireBuyer();
  if (gate.error) return gate.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "body must be an object" }, { status: 400 });
  }
  const raw = (body as Record<string, unknown>).supplier_id;
  if (typeof raw !== "string" || !UUID_RE.test(raw)) {
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
    .upsert(
      { owner_id: ownerId, supplier_id: raw },
      { onConflict: "owner_id,supplier_id", ignoreDuplicates: true },
    );
  if (error) {
    return NextResponse.json({ error: "save failed", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, saved: true });
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
