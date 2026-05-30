// Route protection — Spec F3 (Auth) + Spec A5 (suspension gate).
//
// Reads the Supabase session via `@supabase/ssr` and gates the three
// authenticated surfaces plus the public-shape JSON API:
//
//   /app/*       → role in {buyer, admin}; supplier → /supplier; anon → /login
//   /supplier/*  → role in {supplier, admin}; other → /login
//   /admin/*     → role === admin; other → /login
//   /api/v1/*    → 401 anon / 403 if suspended; otherwise pass-through
//
// Public allow-list per `phases.md` F3 scope:
//   - `(marketing)/*` (anonymous home + future legal/about/pricing)
//   - `/discover` (limited shape, no contacts in payload)
//   - `/suppliers/[slug]` (contacts server-blurred — never trust the client)
//
// Suspension model (Spec A5): `profiles.is_suspended=true` blocks all
// gated UI (redirects to `/suspended`) and returns 403 JSON from any
// `/api/v1/**` request. Suspended users can still reach `/suspended`
// and `/auth/sign-out` (both deliberately outside the matcher). Per
// `code-standards.md`, server enforces auth + ownership; middleware is
// the UX-correct convenience that also doubles as an API gate.
//
// `runtime='nodejs'` so the bundled supabase client + cookie store work the
// same way as in Server Components.

import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware";

export const runtime = "nodejs";

type Role = "admin" | "buyer" | "supplier";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");

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

  if (!user) {
    if (isApi) {
      return NextResponse.json(
        { error: "not authenticated" },
        { status: 401 },
      );
    }
    return redirectToLogin(req);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_suspended")
    .eq("id", user.id)
    .maybeSingle();
  const role = (profile?.role ?? null) as Role | null;
  const suspended = profile?.is_suspended === true;

  if (!role) {
    if (isApi) {
      return NextResponse.json(
        { error: "not authenticated" },
        { status: 401 },
      );
    }
    return redirectToLogin(req);
  }

  if (suspended) {
    if (isApi) {
      return NextResponse.json(
        { error: "account suspended" },
        { status: 403 },
      );
    }
    const url = req.nextUrl.clone();
    url.pathname = "/suspended";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isApi) {
    // Role gating beyond suspension is the route handler's job; pass-through
    // here so SECURITY DEFINER RPCs and `getServerRole()` can do role checks.
    return res;
  }

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
  // /suspended and /auth/* are deliberately excluded so suspended users
  // can read the explainer and sign out. Public `(marketing)`, `/login`,
  // `/discover`, `/suppliers/[slug]` are also excluded.
  matcher: [
    "/app/:path*",
    "/admin/:path*",
    "/supplier/:path*",
    "/api/v1/:path*",
  ],
};
