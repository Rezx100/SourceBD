// GET /app/settings/plan — the old address of Settings · Subscription.
//
// A route handler, not a page: a page here sits under the settings
// `loading.tsx`, which commits HTTP 200 before a `redirect()` in the page body
// can reach the wire (see app/(app)/app/searches/[id]/route.ts). This answers
// a real 308 for every bookmark and link that still names the old address.

import { NextResponse } from "next/server";

import { urlOnSiteFromHref } from "@/lib/site-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(): NextResponse {
  return NextResponse.redirect(urlOnSiteFromHref("/app/settings/subscription"), 308);
}
