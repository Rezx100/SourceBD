// Cron's door to the Monday "new matches" email (gap 14). Not a webhook, but it lives under
// /api/v1/webhooks/ because the middleware skips that path (cron has no session and `/api/v1/*` answers
// 401 to anyone without one). Auth is a shared secret in a header, compared in constant time, as the
// Firecrawl route does; the secret is JOB_SECRET. Unset means nothing is scheduled here, so 404.
//
// The run can take minutes (up to 200 searches, each read in pages), so the caller should wait for it;
// ops/saved_search_alerts_cron.sh allows 15. A run that is cut short is safe: a search is recorded only
// after its email went out, so what was not reached is simply due again.

import { createHash, timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { runSavedSearchAlertsJob } from "@/lib/email/jobs/saved-search-alerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 900;

const SECRET_HEADER = "x-sourcebd-job-secret";

function secretMatches(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const expected = process.env.JOB_SECRET;
  if (!expected) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const provided = req.headers.get(SECRET_HEADER);
  if (!provided || !secretMatches(provided, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const run = await runSavedSearchAlertsJob();
  // 502 when the due list could not be read (0113 not applied, or the database is down): cron's log shows it.
  return NextResponse.json(run, { status: run.error ? 502 : 200 });
}
