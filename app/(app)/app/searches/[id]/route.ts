// GET /app/searches/<id> — open a saved search.
//
// This is a route handler, NOT a page, and deliberately so. As a page it sat
// under the async `(app)` layout, which awaits several Supabase reads behind
// timeout races before it renders; by the time the page body ran and called
// `redirect()`, Next had already committed HTTP 200 and the redirect never
// reached the wire. That is the same defect `/app/match` shipped with, and the
// same one `scripts/test-profile-http-boundary.mjs` was written for after
// REZ-72. A route handler renders no layout and returns a real Response, so the
// status is the status.

import { NextResponse } from "next/server";

import { getServerRole } from "@/lib/auth";
import { savedSearchRedirectHref } from "@/lib/saved-searches";
import { urlOnSiteFromHref } from "@/lib/site-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * `urlOnSite` assigns its first argument to `URL.pathname`, which percent-
 * encodes a "?" — so passing a whole href through it turned
 * `/app/discover?q=knit` into `/app/discover%3Fq=knit` and 404'd every saved
 * search that had any filter on it. The saved-search href is a full href, so
 * split it before handing the parts over.
 */
function seeOther(href: string): NextResponse {
  const res = NextResponse.redirect(urlOnSiteFromHref(href), 307);
  res.headers.set("Cache-Control", "private, no-store, max-age=0");
  return res;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  const role = await getServerRole();
  if (role !== "buyer" && role !== "admin") return seeOther("/login");
  if (!UUID.test(id)) return seeOther("/app/searches");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return seeOther("/login");

  // Row-level security already confines this to the caller's own rows, but
  // every other path in this feature also filters on the owner explicitly and
  // this one should not be the exception that depends on a policy holding.
  const { data } = await supabase
    .from("saved_searches")
    .select("query_state")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!data) return seeOther("/app/searches");
  return seeOther(savedSearchRedirectHref((data as { query_state?: unknown }).query_state));
}
