// Exchanges the Supabase OTP/recovery `?code=...` for a session cookie, then redirects to `next`
// (validated same-origin) or `/app`. A link that is used up or past its hour, or one Supabase itself
// refused (`?error=...&error_code=otp_expired`), lands on the "This link has expired" page, which
// offers a new link, never on a blank sign-in with a raw message in the address bar.
//
// Every redirect is built on the site's own origin (`urlOnSiteFromHref`), never the request's Host,
// and keeps the query of `next` (an invite, a search): assigning "/app/discover?hs=6109" to a pathname
// would encode the "?" and land on a 404.

import { NextResponse, type NextRequest } from "next/server";

import { safeNext } from "@/components/auth/words";
import { needsSecondStep, readAal } from "@/lib/second-step";
import { urlOnSiteFromHref } from "@/lib/site-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  const expired = () => NextResponse.redirect(urlOnSiteFromHref(next === "/app" ? "/link-expired" : `/link-expired?next=${encodeURIComponent(next)}`));

  // Supabase reports its own refusal in the query: an expired or already-used link has `error_code`.
  if (url.searchParams.get("error") || url.searchParams.get("error_code")) return expired();

  if (code) {
    // The visitor's own browser is the session's device on the Security page (row 6).
    const supabase = await createSupabaseServerClient({ userAgent: req.headers.get("user-agent") });
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return expired();
    // A link gives the first step only: an account with two-step on is asked for its code next.
    if (needsSecondStep(await readAal(supabase))) return NextResponse.redirect(urlOnSiteFromHref(`/login/code?next=${encodeURIComponent(next)}`));
  }
  return NextResponse.redirect(urlOnSiteFromHref(next));
}
