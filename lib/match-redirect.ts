/**
 * /app/match is Smart Match folded into Discover's Ask mode (spec §7).
 *
 * The redirect exists in two places and must not disagree. `middleware.ts`
 * issues it for every real request — middleware runs before routing, so it
 * always wins — and `app/(app)/app/match/route.ts` covers the paths that skip
 * the middleware, chiefly the local dev-admin bypass. They shipped with two
 * separate implementations: the route handler carried the caller's query and
 * the middleware hard-coded `?ask=1`, so in production a link into
 * `/app/match?q=knit+polo` landed on an empty Ask box, and the only guard that
 * disagreed ran on the one path where the other implementation answered.
 *
 * One function, two call sites, so they cannot drift again.
 */
export const MATCH_PATH = "/app/match";
export const MATCH_TARGET = "/app/discover";

/**
 * The search string Discover should open with, given whatever the caller
 * arrived at /app/match with. Always turns Ask on; keeps everything else.
 */
export function matchRedirectSearch(incoming: URLSearchParams): string {
  const out = new URLSearchParams(incoming);
  out.set("ask", "1");
  return `?${out.toString()}`;
}
