// Placeholder route protection for the supplier and admin surfaces.
//
// F2 contract: any request to `/admin/*` or `/supplier/*` that resolves to a
// non-admin / non-supplier role is redirected to `/login`. The role lookup
// uses `lib/auth.ts::getServerRole`, which in F2 only honours the
// `DEV_ADMIN_BYPASS=1` env var (returns `'admin'`) and otherwise returns
// `null`. Real Supabase session reading + per-role gating ships in Spec F3.
//
// Runtime is forced to Node so `lib/auth.ts` (marked `server-only`) can be
// imported without the Edge runtime stripping it.

import { NextResponse, type NextRequest } from "next/server";
import { getServerRole } from "@/lib/auth";

export const runtime = "nodejs";

export async function middleware(req: NextRequest) {
  const role = await getServerRole();
  const { pathname } = req.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (role !== "admin") return redirectToLogin(req);
  } else if (pathname === "/supplier" || pathname.startsWith("/supplier/")) {
    if (role !== "supplier" && role !== "admin") return redirectToLogin(req);
  }

  return NextResponse.next();
}

function redirectToLogin(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*", "/supplier/:path*"],
};
