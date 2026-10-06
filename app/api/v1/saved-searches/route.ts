import { NextResponse } from "next/server";

import { getServerRole } from "@/lib/auth";
import { runSavedSearchesAlert, runSavedSearchesDelete, runSavedSearchesGet, runSavedSearchesPost, runSavedSearchesRename } from "@/lib/saved-searches";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const role = await getServerRole();
  const supabase = await createSupabaseServerClient();
  const result = await runSavedSearchesGet({ role, supabase });
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(req: Request) {
  const role = await getServerRole();
  const supabase = await createSupabaseServerClient();
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const result = await runSavedSearchesPost({ role, supabase, raw });
  return NextResponse.json(result.body, { status: result.status });
}

export async function PATCH(req: Request) {
  const role = await getServerRole();
  const supabase = await createSupabaseServerClient();
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  // {id, alert_weekly} is the Email-me-new-matches switch; {id, name} is a rename.
  const isAlert = Boolean(raw && typeof raw === "object" && !Array.isArray(raw) && "alert_weekly" in raw);
  // One change per call: a rename that rode along with the switch would be dropped without a word.
  if (isAlert && "name" in (raw as object)) return NextResponse.json({ error: "send name or alert_weekly, not both" }, { status: 400 });
  const result = await (isAlert ? runSavedSearchesAlert : runSavedSearchesRename)({ role, supabase, raw });
  return NextResponse.json(result.body, { status: result.status });
}

export async function DELETE(req: Request) {
  const role = await getServerRole();
  const supabase = await createSupabaseServerClient();
  const url = new URL(req.url);
  const result = await runSavedSearchesDelete({
    role,
    supabase,
    id: url.searchParams.get("id"),
  });
  return NextResponse.json(result.body, { status: result.status });
}
