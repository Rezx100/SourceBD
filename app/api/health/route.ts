// Liveness probe. No DB call, no auth — must succeed even when downstream
// dependencies are degraded so load balancers / uptime checks can distinguish
// "process alive" from "service degraded".
//
// `commit` resolves from build-injected env. On Vercel-style hosts the
// `VERCEL_GIT_COMMIT_SHA` env var is auto-populated; self-hosted deploys set
// `COMMIT_SHA` in the runtime env. Falls back to "unknown" if neither is set.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return Response.json({
    status: "ok",
    commit: process.env.COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown",
    ts: new Date().toISOString(),
  });
}
