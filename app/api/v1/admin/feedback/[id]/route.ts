// Phase 7 P3 — Admin feedback status update.

import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServerRole } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const role = await getServerRole();
  if (role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const VALID_STATUSES = new Set(["open", "triaged", "closed"]);
  const contentType = req.headers.get("content-type") ?? "";

  let status: string | null = null;
  if (contentType.includes("application/json")) {
    const body = (await req.json().catch(() => null)) as { status?: string } | null;
    const s = body?.status;
    if (typeof s === "string" && VALID_STATUSES.has(s)) status = s;
  } else {
    const form = await req.formData().catch(() => null);
    const s = form?.get("status");
    if (typeof s === "string" && VALID_STATUSES.has(s)) status = s;
  }

  if (status === null) {
    return NextResponse.json(
      { error: "invalid status; expected one of open|triaged|closed" },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("feedback_admin_set_status", {
    p_id: id,
    p_status: status,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (contentType.includes("application/json")) {
    return NextResponse.json({ ok: data });
  }

  const referer = req.headers.get("referer") ?? "/admin/feedback";
  return NextResponse.redirect(new URL(referer, req.url), 303);
}
