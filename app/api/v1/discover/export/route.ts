import { NextResponse } from "next/server";

import { getServerRole } from "@/lib/auth";
import { runDiscoverExport } from "@/lib/discover-export";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const role = await getServerRole();
  const supabase = await createSupabaseServerClient();
  const url = new URL(req.url);
  const result = await runDiscoverExport({
    role,
    supabase,
    search: url.search,
    today: new Date(),
  });
  return new NextResponse(result.body, { status: result.status, headers: result.headers });
}
