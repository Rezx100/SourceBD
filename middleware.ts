// Route protection — Spec F3 (Auth) + Spec A5 (suspension gate) + Spec H2
// (rate limiting).
//
// Gates the three authenticated surfaces plus the public-shape JSON API:
//
//   /app/*       → role in {buyer, admin}; supplier → /supplier; anon → /login
//   /supplier/*  → role in {supplier, admin}; other → /login
//   /admin/*     → role === admin; other → /login
//   /api/v1/*    → 401 anon / 403 if suspended; otherwise pass-through
//
// Rate limiting (Spec H2) runs before auth gating so an unauthenticated
// attacker cannot evade the auth-route limiter. Four route classes:
// `auth` (IP), `api_write` (user), `api_read` (user), `public_marketing`
// (IP). The internal health probe (`/api/health`) is excluded by the
// matcher itself — no client-controllable allowlist header.
//
// `runtime='nodejs'` so the bundled supabase client + cookie store work the
// same way as in Server Components.

import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware";
import {
  RATE_LIMITS,
  classifyRoute,
  leftmostIp,
  type RateLimitClass,
} from "@/lib/rate-limit/limits";
import { rlCheck } from "@/lib/rate-limit/check";
import {
  getCachedPublicSupplierProfile,
  isPublicSupplierSlug,
} from "@/lib/public-supplier-profile";
import { urlOnSite } from "@/lib/site-origin";

export const runtime = "nodejs";

type Role = "admin" | "buyer" | "supplier";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Canonical hostname redirect ──────────────────────────────────────────
  // Redirect www.sourcebd.net → sourcebd.net (301, permanent).
  // Runs first, before rate limiting and auth, so the redirect is always
  // issued regardless of route. Defence in depth: CF Page Rule covers this
  // too, but this ensures correctness even when CF is bypassed or misconfigured.
  const host = req.headers.get("host") ?? "";
  if (host.startsWith("www.")) {
    const dest = urlOnSite(pathname, req.nextUrl.search);
    return NextResponse.redirect(dest, { status: 301 });
  }
  // ────────────────────────────────────────────────────────────────────────

  const isApi = pathname.startsWith("/api/");
  const needsAuthGate =
    pathname === "/app" ||
    pathname.startsWith("/app/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/supplier" ||
    pathname.startsWith("/supplier/") ||
    pathname.startsWith("/api/v1/");

  // Local-dev admin bypass — mirrors `lib/auth.ts::getServerRole`. Never
  // honoured in production. Dev bypass also skips rate limiting so local
  // iteration is not throttled.
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.DEV_ADMIN_BYPASS === "1"
  ) {
    return NextResponse.next({ request: req });
  }

  const { supabase, res } = createSupabaseMiddlewareClient(req);

  const klass: RateLimitClass | null = classifyRoute(pathname, req.method);
  let cachedUserId: string | null | undefined;

  if (klass) {
    const spec = RATE_LIMITS[klass];
    let ident: string;
    if (spec.identifier === "user") {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      cachedUserId = user?.id ?? null;
      // Unauthed hits on /api/v1/* still get bucketed (by IP) so a logged-out
      // attacker cannot bypass the gate by omitting cookies.
      ident = cachedUserId ?? leftmostIp(req.headers);
    } else {
      ident = leftmostIp(req.headers);
    }
    const result = await rlCheck(supabase, klass, ident, spec.perMin);
    if (!result.ok) {
      return new NextResponse(
        JSON.stringify({
          error: "rate_limited",
          retry_after_seconds: result.retryAfter,
        }),
        {
          status: 429,
          headers: {
            "Retry-After": String(result.retryAfter),
            "Content-Type": "application/json; charset=utf-8",
          },
        },
      );
    }
  }

  // I-034: bounce logged-in buyers/admins from the demo-mode marketing
  // surface (`/discover`, `/suppliers/<slug>`) to their app-side
  // equivalent. Suppliers stay on the marketing variant (no `/app`
  // equivalent for them). Anon visitors short-circuit on the cookie
  // probe so cold marketing traffic does not pay a DB round-trip.
  if (req.method === "GET" || req.method === "HEAD") {
    const targetAppPath = appPathForMarketing(pathname);
    if (targetAppPath) {
      const hasSbCookie = req.cookies
        .getAll()
        .some((c) => c.name.startsWith("sb-"));
      if (hasSbCookie) {
        if (cachedUserId === undefined) {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          cachedUserId = user?.id ?? null;
        }
        if (cachedUserId) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", cachedUserId)
            .maybeSingle();
          const role = (profile?.role ?? null) as Role | null;
          if (role === "buyer" || role === "admin") {
            return redirectOnSite(
              targetAppPath,
              req.nextUrl.search,
              307,
            );
          }
        }
      }
    }
  }

  // Public factory pages are force-static. A redirect() from the page
  // inherits s-maxage=300. Issue the 307 here so Cache-Control can be
  // private, no-store. Do not skip this on a query string: Retry lands
  // on the canonical factory URL, and ?retry=1 must still 307 while
  // the pack is 57014. Do not catch-and-fall-through: a throw here is
  // 500, not an ISR-cached 307. The page throws on timedOut if this
  // intercept is skipped.
  if (req.method === "GET" || req.method === "HEAD") {
    const publicSlug = publicSupplierSlugFromPath(pathname);
    if (publicSlug) {
      const pack = await getCachedPublicSupplierProfile(publicSlug);
      if (pack.timedOut) {
        return redirectOnSite(
          "/temporarily-slow",
          `?slug=${encodeURIComponent(publicSlug)}`,
          307,
        );
      }
    }
  }

  if (pathname === "/" || pathname === "/temporarily-slow") {
    res.headers.set("Cache-Control", "private, no-store, max-age=0");
  }

  if (!needsAuthGate) return res;

  const user =
    cachedUserId === undefined
      ? (await supabase.auth.getUser()).data.user
      : cachedUserId
        ? { id: cachedUserId }
        : null;

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
    return NextResponse.redirect(urlOnSite("/suspended"));
  }

  if (isApi) {
    return res;
  }

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (role !== "admin") return redirectToLogin(req);
  } else if (pathname === "/supplier" || pathname.startsWith("/supplier/")) {
    if (role !== "supplier" && role !== "admin") return redirectToLogin(req);
  } else if (pathname === "/app" || pathname.startsWith("/app/")) {
    if (role === "supplier") {
      return NextResponse.redirect(urlOnSite("/supplier"));
    }
    if (role !== "buyer" && role !== "admin") return redirectToLogin(req);
  }

  return res;
}

function redirectToLogin(req: NextRequest) {
  return NextResponse.redirect(
    urlOnSite(
      "/login",
      `?next=${encodeURIComponent(
        req.nextUrl.pathname + req.nextUrl.search,
      )}`,
    ),
  );
}

// I-034: marketing → app equivalent map. Only `/discover` and
// `/suppliers/<slug>` have an authenticated app surface that should be
// shown to logged-in buyers/admins by default; `/`, `/pricing`,
// `/legal/*`, `/compliance/*` deliberately stay accessible to logged-in
// users (legitimate destinations even when signed in).
// 307/303 that must not follow the request Host or be CDN-cached.
function redirectOnSite(
  pathname: string,
  search: string,
  status: number,
): NextResponse {
  const dest = urlOnSite(pathname, search);
  const res = NextResponse.redirect(dest, status);
  res.headers.set("Cache-Control", "private, no-store, max-age=0");
  return res;
}

function appPathForMarketing(pathname: string): string | null {
  if (pathname === "/discover") return "/app/discover";
  if (pathname.startsWith("/suppliers/")) {
    return "/app" + pathname;
  }
  return null;
}

function publicSupplierSlugFromPath(pathname: string): string | null {
  const match = /^\/suppliers\/([^/]+)$/.exec(pathname);
  const slug = match?.[1];
  if (!slug || !isPublicSupplierSlug(slug)) return null;
  return slug;
}

export const config = {
  // Broad matcher so marketing + auth surfaces flow through the H2 limiter.
  // Static assets, the Next runtime, the internal health probe, and the two
  // machine-to-machine webhook endpoints are excluded so we do not run
  // middleware on every image / JS / CSS request — and so a retrying sender is
  // neither rate-limited nor auth-gated.
  //
  // The Firecrawl exclusion is load-bearing, not an optimisation: `/api/v1/*`
  // returns 401 to anonymous callers, and Firecrawl has no session. Left in the
  // matcher, every monitor notification would be rejected and the early-warning
  // tier would be silently dead. That route authenticates itself with a
  // shared-secret header instead.
  matcher: [
    "/((?!_next/|api/health|api/stripe/webhook|api/v1/webhooks/|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico|css|js|woff|woff2|ttf|map|xml|txt)$).*)",
  ],
};
