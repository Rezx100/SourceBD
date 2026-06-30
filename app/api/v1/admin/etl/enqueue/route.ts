// /api/v1/admin/etl/enqueue - enqueue a scraper run.

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { isScraperCode } from "@/lib/admin/etl-scrapers";
import { getServerRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  scraper_code?: unknown;
  priority?: unknown;
  metadata?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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

  const priority =
    typeof body.priority === "number" && Number.isInteger(body.priority)
      ? body.priority
      : 100;
  const metadata = isRecord(body.metadata) ? body.metadata : {};

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_etl_enqueue", {
    p_scraper_code: body.scraper_code,
    p_priority: priority,
    p_metadata: metadata,
  });

  if (error) {
    const message = error.message.toLowerCase();
    const status = message.includes("admin only") ? 403 : 400;
    return NextResponse.json(
      { error: "admin_etl_enqueue failed", detail: error.message },
      { status },
    );
  }

  revalidatePath("/admin");
  revalidatePath("/admin/sources");
  return NextResponse.json(data);
}
