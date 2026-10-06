import { NextResponse } from "next/server";

import { getServerRole } from "@/lib/auth";
import { runDiscoverExport } from "@/lib/discover-export";
import { noteActivity } from "@/lib/ledger/note";
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
  if (result.status === 200) {
    // A search exported is written to the activity record as this person's (moderation plan 1d; a burst of
    // exports is one of the warning signs).
    await noteActivity(supabase, "export.downloaded", { content: { export: "discover", search: url.search.slice(0, 2000), rows: result.headers["X-SourceBD-Rows"] ?? null } });
  }
  return new NextResponse(result.body, { status: result.status, headers: result.headers });
}
