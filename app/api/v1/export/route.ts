import { NextResponse } from "next/server";

import { getServerRole } from "@/lib/auth";
import { noteActivity } from "@/lib/ledger/note";
import { runListExport } from "@/lib/list-export";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/export?kind=saved&sort=… | ?kind=certificates&show=… — Download CSV on Saved,
// Compliance and Certificate expiry. See lib/list-export.ts.
export async function GET(req: Request) {
  const role = await getServerRole();
  const supabase = await createSupabaseServerClient();
  const url = new URL(req.url);
  const result = await runListExport({ role, supabase, search: url.search, today: new Date() });
  if (result.status === 200) {
    // A download is written to the activity record as this person's (moderation plan 1d).
    await noteActivity(supabase, "export.downloaded", { content: { export: "list", kind: url.searchParams.get("kind"), search: url.search.slice(0, 2000), rows: result.headers["X-SourceBD-Rows"] ?? null } });
  }
  return new NextResponse(result.body, { status: result.status, headers: result.headers });
}
