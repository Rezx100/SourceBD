// GET /app/match — Smart Match folded into Discover's Ask mode (spec §7).
//
// A route handler, not a page, for the reason `app/(app)/app/searches/[id]`
// gives at length: a page under the async `(app)` layout has already committed
// HTTP 200 by the time its body calls `redirect()`, which is the REZ-72 defect
// this whole surface was rewritten after.

import { NextResponse } from "next/server";

import { urlOnSiteFromHref } from "@/lib/site-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: Request): NextResponse {
  // Whatever the caller arrived with is a search, not decoration: a link into
  // /app/match?q=knit+polo meant to open Discover on that query landed on an
  // empty Ask box, because the redirect was a bare string and dropped it.
  const incoming = new URL(req.url).searchParams;
  incoming.set("ask", "1");
  const res = NextResponse.redirect(urlOnSiteFromHref(`/app/discover?${incoming.toString()}`), 307);
  res.headers.set("Cache-Control", "private, no-store, max-age=0");
  return res;
}
