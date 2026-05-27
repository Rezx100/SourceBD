// Route protection — Spec F3 (Auth).
//
// Reads the Supabase session via `@supabase/ssr` and gates the three
// authenticated surfaces:
//
//   /app/*       → role in {buyer, admin}; supplier → /supplier; anon → /login
//   /supplier/*  → role in {supplier, admin}; other → /login
//   /admin/*     → role === admin; other → /login
//
// Public allow-list per `phases.md` F3 scope:
//   - `(marketing)/*` (anonymous home + future legal/about/pricing)
//   - `/discover` (limited shape, no contacts in payload)
//   - `/suppliers/[slug]` (contacts server-blurred — never trust the client)
//
// Per `code-standards.md`, server enforces auth + ownership. The matcher
// below intentionally only covers the gated surfaces; allow-list routes
// never enter this function. Contact PII gating on public profile pages is
// enforced inside the server component, not by middleware.
//
// `runtime='nodejs'` so the bundled supabase client + cookie store work the
// same way as in Server Components.

import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware";

export const runtime = "nodejs";

type Role = "admin" | "buyer" | "supplier";

export async function middleware(req: NextRequest) {
  // Local-dev admin bypass — mirrors `lib/auth.ts::getServerRole`. Never
  // honoured in production; the `DEV_ADMIN_BYPASS` env var is unset there.
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.DEV_ADMIN_BYPASS === "1"
  ) {
    return NextResponse.next({ request: req });
  }

  const { supabase, res } = createSupabaseMiddlewareClient(req);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { pathname } = req.nextUrl;

  if (!user) return redirectToLogin(req);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = (profile?.role ?? null) as Role | null;

  if (!role) return redirectToLogin(req);

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (role !== "admin") return redirectToLogin(req);
  } else if (pathname === "/supplier" || pathname.startsWith("/supplier/")) {
    if (role !== "supplier" && role !== "admin") return redirectToLogin(req);
  } else if (pathname === "/app" || pathname.startsWith("/app/")) {
    if (role === "supplier") {
      const url = req.nextUrl.clone();
      url.pathname = "/supplier";
      url.search = "";
      return NextResponse.redirect(url);
    }
    if (role !== "buyer" && role !== "admin") return redirectToLogin(req);
  }

  return res;
}

function redirectToLogin(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(
    req.nextUrl.pathname + req.nextUrl.search,
  )}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/app/:path*", "/admin/:path*", "/supplier/:path*"],
};
