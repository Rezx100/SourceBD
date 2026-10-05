// POST /api/v1/saved-searches/last: keep the search the buyer just ran, so Saved searches can ask
// "Save your last search?" (gap row 14, migration 0113). Auth and the shape are `lib/saved-searches`.

import { NextResponse } from "next/server";

import { getServerRole } from "@/lib/auth";
import { runLastSearchSet } from "@/lib/saved-searches";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const role = await getServerRole();
  const supabase = await createSupabaseServerClient();
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const result = await runLastSearchSet({ role, supabase, raw });
  return NextResponse.json(result.body, { status: result.status });
}
