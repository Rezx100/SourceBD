// /api/v1/admin/etl/jobs/[id]/decision - cancel or retry scraper queue jobs.

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getServerRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Body = {
  action?: unknown;
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const role = await getServerRole();
  if (role !== "admin") {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "id must be a UUID" }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";
  if (!["cancel", "retry"].includes(action)) {
    return NextResponse.json({ error: "action must be cancel or retry" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_etl_job_decide", {
    p_job_id: id,
    p_action: action,
  });

  if (error) {
    const message = error.message.toLowerCase();
    const status = message.includes("admin only")
      ? 403
      : message.includes("not found")
        ? 404
        : message.includes("only ")
          ? 409
          : 400;
    return NextResponse.json(
      { error: "admin_etl_job_decide failed", detail: error.message },
      { status },
    );
  }

  revalidatePath("/admin/sources");
  return NextResponse.json(data);
}
