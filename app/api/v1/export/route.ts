import { NextResponse } from "next/server";

import { getServerRole } from "@/lib/auth";
import { runListExport } from "@/lib/list-export";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/export?kind=saved&sort=… | ?kind=certificates&show=… — Download CSV on Saved,
// Compliance and Certificate expiry. See lib/list-export.ts.
export async function GET(req: Request) {
  const role = await getServerRole();
  const supabase = await createSupabaseServerClient();
  const result = await runListExport({ role, supabase, search: new URL(req.url).search, today: new Date() });
  return new NextResponse(result.body, { status: result.status, headers: result.headers });
}
