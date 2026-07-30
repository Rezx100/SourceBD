// /api/v1/admin/evidence/decide - repair action on one problem citation.
//
// Three verbs, each with a different meaning that must not be conflated:
//   acknowledge - an operator has looked and accepts the current state.
//   retire      - no live source supports this fact any more; orphan the claim.
//   recheck     - put the document back at the front of the verifier's queue.
//
// `recheck` exists so an operator is never forced to choose between "retire a
// fact that is probably fine" and "leave a red row sitting there" when the real
// answer is that the source was unreachable at check time. Ownership and role
// are enforced again inside the RPC; this route is not the security boundary.

import { NextResponse } from "next/server";

import { getServerRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS = new Set(["acknowledge", "retire", "recheck"]);

type Body = { claim_id?: unknown; action?: unknown; note?: unknown };

export async function POST(req: Request) {
  const role = await getServerRole();
  if (role !== "admin") {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (typeof body.claim_id !== "string" || body.claim_id.length === 0) {
    return NextResponse.json({ error: "claim_id required" }, { status: 400 });
  }
  if (typeof body.action !== "string" || !ACTIONS.has(body.action)) {
    return NextResponse.json(
      { error: "action must be acknowledge, retire or recheck" },
      { status: 400 },
    );
  }
  // Retiring a claim removes the evidence behind a fact a buyer may already have
  // read, so it has to be attributable to a person and a reason.
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (body.action === "retire" && note.length === 0) {
    return NextResponse.json(
      { error: "a note is required when retiring a claim" },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_evidence_claim_decide", {
    p_claim_id: body.claim_id,
    p_action: body.action,
    p_note: note || null,
  });

  if (error) {
    const message = error.message.toLowerCase();
    const status = message.includes("admin only")
      ? 403
      : message.includes("not found")
        ? 404
        : 400;
    return NextResponse.json(
      { error: "admin_evidence_claim_decide failed", detail: error.message },
      { status },
    );
  }

  return NextResponse.json(data);
}
