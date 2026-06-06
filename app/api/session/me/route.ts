// I-033 — minimal session probe for marketing chrome hydration.
//
// Public endpoint, cookied. Returns the caller's role (or null) for the
// marketing top-nav client island to render the correct CTAs without
// breaking ISR on the marketing pages themselves. Never cached.
//
// Surface is intentionally narrow: no email, no user id, no profile fields.
// UI visibility is not a security control — `/app`, `/supplier`, `/admin`,
// `/api/v1/*` remain server-enforced by `middleware.ts`.

import { getServerRole } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let role = null;
  try {
    role = await getServerRole();
  } catch {
    role = null;
  }
  return Response.json(
    { role },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}
