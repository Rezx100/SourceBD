// Spec H2 — Route-class limit constants + classifier.
//
// One global limit per (route-class). Tuned for the v1 abuse threshold,
// not for per-tenant quotas. See `context/feature-specs/spec-H2-rate-limiting.md`
// for the rationale on each ceiling.

export const LIMIT_AUTH = 10;
export const LIMIT_API_WRITE = 30;
export const LIMIT_API_READ = 120;
/** The CSV export route: up to ten `discover_suppliers` pages per request,
 * each a full-corpus pass under the hs_lines / cert_expiry sorts (0104).
 * Bounds this route only — a signed-in PostgREST caller reaches the RPC
 * directly, outside the app (hand-off §7.1). */
export const LIMIT_API_EXPORT = 6;
export const LIMIT_PUBLIC_MARKETING = 240;

export type RateLimitClass =
  | "auth"
  | "api_write"
  | "api_read"
  | "api_export"
  | "public_marketing";

export type RateLimitSpec = {
  perMin: number;
  identifier: "ip" | "user";
};

export const RATE_LIMITS: Record<RateLimitClass, RateLimitSpec> = {
  auth: { perMin: LIMIT_AUTH, identifier: "ip" },
  api_write: { perMin: LIMIT_API_WRITE, identifier: "user" },
  api_read: { perMin: LIMIT_API_READ, identifier: "user" },
  api_export: { perMin: LIMIT_API_EXPORT, identifier: "user" },
  public_marketing: { perMin: LIMIT_PUBLIC_MARKETING, identifier: "ip" },
};

const AUTH_PATHS = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
]);

const MARKETING_PREFIXES = [
  "/pricing",
  "/legal",
  "/discover",
  "/suppliers",
  "/compliance",
  "/temporarily-slow",
];

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function classifyRoute(
  pathname: string,
  method: string,
): RateLimitClass | null {
  if (pathname === "/api/v1/discover/export") return "api_export";
  if (pathname.startsWith("/api/v1")) {
    return WRITE_METHODS.has(method) ? "api_write" : "api_read";
  }
  // Public anon API endpoints — IP-based, same ceiling as marketing pages.
  if (
    pathname.startsWith("/api/discover") ||
    pathname.startsWith("/api/suppliers")
  ) {
    return "public_marketing";
  }
  if (AUTH_PATHS.has(pathname)) {
    // GET renders the page (cheap). The bucket starts to bite on the form
    // submission, which Next routes back to the same path as a POST server
    // action. Apply to both so a bot cannot bypass by spamming GETs.
    return "auth";
  }
  if (pathname === "/") return "public_marketing";
  // The buyer Discover page runs the same RPC, and a page load with an
  // expensive sort costs what one export page does. It had no bucket at all.
  if (pathname === "/app/discover") return "api_read";
  for (const prefix of MARKETING_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      return "public_marketing";
    }
  }
  return null;
}

export function leftmostIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  return "0.0.0.0";
}
