// /api/v1/admin/queue/decide — review-queue release.
// Approve/release executes the classified buyer-facing mutation.
// Specialized queues keep their own endpoints:
// - cert_doc_review: /api/v1/admin/certifications/decide
// - sanctions_hit: /api/v1/admin/sanctions/decide

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { getServerRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { queueDecideRequestError } from "@/lib/admin/queue-decide-decision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  queue_id?: unknown;
  decision?: unknown;
  note?: unknown;
};

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

  const queueId = typeof body.queue_id === "string" ? body.queue_id : "";
  const decision = typeof body.decision === "string" ? body.decision : "";
  const note = typeof body.note === "string" ? body.note : null;

  const bad = queueDecideRequestError(queueId, decision);
  if (bad) {
    return NextResponse.json({ error: bad.error }, { status: bad.status });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_queue_decide", {
    p_queue_id: queueId,
    p_decision: decision,
    p_note: note,
  });

  if (error) {
    const m = error.message.toLowerCase();
    const code = m.includes("admin only")
      ? 403
      : m.includes("not found")
        ? 404
        : m.includes("already decided")
          ? 409
          : 400;
    return NextResponse.json(
      { error: "admin_queue_decide failed", detail: error.message },
      { status: code },
    );
  }

  revalidatePath("/admin");
  revalidatePath("/admin/queue");
  revalidatePath("/discover");
  revalidatePath("/app/discover");
  return NextResponse.json(data);
}
