// Cron's door to the daily outside stamp of the activity record (moderation plan 1e): seal, stamp the
// newest seal with the timestamp authority, verify the chain, email the seal and the token to the outside
// mailbox. Auth is JOB_SECRET in a header, as the hourly route. ops/ledger_cron.sh calls it once a day.

import { createHash, timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { runDailyStamp } from "@/lib/ledger/jobs-runner";

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
  const run = await runDailyStamp();
  // 502 when no seal could be read or written; a failed stamp or mail is reported in the body with a 200,
  // so cron's log shows which half failed, and a broken chain is 500 so it is never a quiet success.
  const status = run.error ? 502 : run.verdict && run.verdict.ok === false ? 500 : 200;
  return NextResponse.json(run, { status });
}
