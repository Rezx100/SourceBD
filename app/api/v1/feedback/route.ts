// Phase 7 P3 — Feedback API (authenticated buyers/suppliers/admins).

import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!json || typeof json !== "object") {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  const page_path = (json as { page_path?: unknown }).page_path;
  const message = (json as { message?: unknown }).message;

  if (typeof page_path !== "string" || page_path.length < 1 || page_path.length > 500) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  if (typeof message !== "string" || message.trim().length < 10 || message.length > 4000) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("feedback_submit", {
    p_page_path: page_path,
    p_message: message.trim(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data }, { status: 201 });
}
