// GET /app/match — Smart Match folded into Discover's Ask mode (spec §7).
//
// A route handler, not a page, for the reason `app/(app)/app/searches/[id]`
// gives at length: a page under the async `(app)` layout has already committed
// HTTP 200 by the time its body calls `redirect()`, which is the REZ-72 defect
// this whole surface was rewritten after.

import { NextResponse } from "next/server";

import { MATCH_TARGET, matchRedirectSearch } from "@/lib/match-redirect";
import { urlOnSiteFromHref } from "@/lib/site-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: Request): NextResponse {
  // `middleware.ts` answers this path for every real request and this handler
  // never runs there. It is reached only where the middleware is skipped —
  // the local dev-admin bypass — so it must produce the same redirect, which
  // is why both call `matchRedirectSearch`.
  const search = matchRedirectSearch(new URL(req.url).searchParams);
  const res = NextResponse.redirect(urlOnSiteFromHref(`${MATCH_TARGET}${search}`), 307);
  res.headers.set("Cache-Control", "private, no-store, max-age=0");
  return res;
}
