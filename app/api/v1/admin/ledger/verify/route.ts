// POST /api/v1/admin/ledger/verify — the "Verify" button on the admin Data page (moderation plan 1e): re-checks
// the whole seal chain on demand through ledger_verify, which keeps its verdict for the page to show.

import { NextResponse } from "next/server";

import { getServerRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST() {
  const role = await getServerRole();
  if (role !== "admin") {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("ledger_verify");
  if (error) {
    return NextResponse.json({ error: "ledger_verify failed", detail: error.message }, { status: 502 });
  }
  return NextResponse.json(data ?? { ok: null });
}
