// /api/v1/admin/suppliers/[id]/rescore — enqueue SBI recalc (Spec A2).

import { NextResponse } from "next/server";

import { getServerRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const role = await getServerRole();
  if (role !== "admin") {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "id must be a UUID" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_score_recalc_enqueue", {
    p_supplier_id: id,
  });
  if (error) {
    const code = error.message.toLowerCase().includes("admin only")
      ? 403
      : error.message.toLowerCase().includes("not found")
      ? 404
      : 400;
    return NextResponse.json(
      { error: "admin_score_recalc_enqueue failed", detail: error.message },
      { status: code },
    );
  }
  return NextResponse.json(data);
}
