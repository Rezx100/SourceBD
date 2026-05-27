// Exchanges the Supabase OTP/recovery `?code=...` for a session cookie, then
// redirects to `next` (validated same-origin) or `/app`.

import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function safeNext(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/app";
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const back = url.clone();
      back.pathname = "/login";
      back.search = `?error=${encodeURIComponent(error.message)}`;
      return NextResponse.redirect(back);
    }
  }
  const dest = url.clone();
  dest.pathname = next;
  dest.search = "";
  return NextResponse.redirect(dest);
}
