// Exchanges the Supabase OTP/recovery `?code=...` for a session cookie, then redirects to `next`
// (validated same-origin) or `/app`. A link that is used up or past its hour, or one Supabase itself
// refused (`?error=...&error_code=otp_expired`), lands on the "This link has expired" page, which
// offers a new link, never on a blank sign-in with a raw message in the address bar.

import { NextResponse, type NextRequest } from "next/server";

import { safeNext } from "@/components/auth/words";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  const expired = () => {
    const back = url.clone();
    back.pathname = "/link-expired";
    back.search = next === "/app" ? "" : `?next=${encodeURIComponent(next)}`;
    return NextResponse.redirect(back);
  };

  // Supabase reports its own refusal in the query: an expired or already-used link has `error_code`.
  if (url.searchParams.get("error") || url.searchParams.get("error_code")) return expired();

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return expired();
  }
  const dest = url.clone();
  dest.pathname = next;
  dest.search = "";
  return NextResponse.redirect(dest);
}
