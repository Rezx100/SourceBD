// /api/v1/admin/etl/schedule - create or update a scraper timer.

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { isScraperCode } from "@/lib/admin/etl-scrapers";
import { getServerRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  scraper_code?: unknown;
  enabled?: unknown;
  interval_minutes?: unknown;
  next_run_at?: unknown;
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

  if (!isScraperCode(body.scraper_code)) {
    return NextResponse.json({ error: "unknown scraper_code" }, { status: 400 });
  }
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be boolean" }, { status: 400 });
  }
  if (
    typeof body.interval_minutes !== "number" ||
    !Number.isInteger(body.interval_minutes) ||
    body.interval_minutes < 60 ||
    body.interval_minutes > 43200
  ) {
    return NextResponse.json(
      { error: "interval_minutes must be an integer between 60 and 43200" },
      { status: 400 },
    );
  }

  const nextRunAt =
    typeof body.next_run_at === "string" && !Number.isNaN(Date.parse(body.next_run_at))
      ? body.next_run_at
      : null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_etl_schedule_upsert", {
    p_scraper_code: body.scraper_code,
    p_enabled: body.enabled,
    p_interval_minutes: body.interval_minutes,
    p_next_run_at: nextRunAt,
  });

  if (error) {
    const message = error.message.toLowerCase();
    const status = message.includes("admin only") ? 403 : 400;
    return NextResponse.json(
      { error: "admin_etl_schedule_upsert failed", detail: error.message },
      { status },
    );
  }

  revalidatePath("/admin/sources");
  return NextResponse.json(data);
}
