import { NextResponse } from "next/server";

import { getServerRole } from "@/lib/auth";
import { runEvidencePack } from "@/lib/evidence-pack";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/v1/evidence-pack {sections, format: "csv"}: the evidence pack for auditors (gap row 8).
// A POST because it writes the download record; see lib/evidence-pack.ts.
export async function POST(req: Request) {
  const role = await getServerRole();
  const supabase = await createSupabaseServerClient();
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const result = await runEvidencePack({ role, supabase, raw, today: new Date() });
  return new NextResponse(result.body, { status: result.status, headers: result.headers });
}
