// /api/v1/admin/etl/status - live scraper operations dashboard payload.

import { NextResponse } from "next/server";

import { getServerRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const role = await getServerRole();
  if (role !== "admin") {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_etl_dashboard");

  if (error) {
    const message = error.message.toLowerCase();
    const status = message.includes("admin only") ? 403 : 400;
    return NextResponse.json(
      { error: "admin_etl_dashboard failed", detail: error.message },
      { status },
    );
  }

  return NextResponse.json(data);
}
