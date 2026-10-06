// Phase 7 P3 — Feedback API (authenticated buyers/suppliers/admins).
//
// Signed-in only (401 before anything is read), a note of 10 to 4,000 characters and the page it was written on.
// Every refusal is a plain sentence the "Send feedback" dialog shows as it is. The per-minute limit is the
// middleware's `api_write` bucket (30 a minute per user), which answers 429 before this runs.

import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const refuse = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return refuse("Sign in to send feedback.", 401);

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return refuse("Could not read your note. Try again.", 400);
  }
  if (!json || typeof json !== "object") return refuse("Could not read your note. Try again.", 400);

  const page_path = (json as { page_path?: unknown }).page_path;
  const message = (json as { message?: unknown }).message;

  if (typeof page_path !== "string" || page_path.length < 1 || page_path.length > 500) {
    return refuse("Could not tell which page this is about. Reload and try again.", 400);
  }
  if (typeof message !== "string" || message.trim().length < 10) {
    return refuse("Write at least 10 characters so we can act on it.", 400);
  }
  if (message.length > 4000) return refuse("Keep it under 4,000 characters.", 400);

  const { data, error } = await supabase.rpc("feedback_submit", {
    p_page_path: page_path,
    p_message: message.trim(),
  });

  if (error) return refuse("Could not send your feedback. Nothing was sent; try again in a moment.", 500);

  return NextResponse.json({ id: data }, { status: 201 });
}
