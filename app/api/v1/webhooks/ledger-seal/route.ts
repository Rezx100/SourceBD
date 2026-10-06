// Cron's door to the hourly seal of the activity record (moderation plan 1e). Not a webhook, but under
// /api/v1/webhooks/ because the middleware skips that path (cron has no session). Auth is the shared
// secret JOB_SECRET in a header, compared in constant time, as the saved-search alerts route does. Unset
// means nothing is scheduled here, so 404. ops/ledger_cron.sh calls it every hour.

import { createHash, timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { runHourlySeal } from "@/lib/ledger/jobs-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
  const run = await runHourlySeal();
  // 502 when the seal could not be written (0135 not applied, or the database is down): cron's log shows it.
  return NextResponse.json(run, { status: run.error ? 502 : 200 });
}
