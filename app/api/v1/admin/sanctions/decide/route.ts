// /api/v1/admin/sanctions/decide — confirm/clear a queued sanctions hit (Spec A4).

import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

import { getServerRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notifySanctionConfirmed } from "@/lib/email/triggers/sanction-alert";
import {
  TAG_DISCOVER_FACETS,
  TAG_DISCOVER_SUPPLIERS,
  tagSupplier,
} from "@/lib/cache/tags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Body = {
  queue_id?: unknown;
  decision?: unknown;
  reason?: unknown;
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
  const reason = typeof body.reason === "string" ? body.reason : "";

  if (!UUID_RE.test(queueId)) {
    return NextResponse.json({ error: "queue_id must be a UUID" }, { status: 400 });
  }
  if (decision !== "confirm" && decision !== "clear") {
    return NextResponse.json(
      { error: "decision must be confirm|clear" },
      { status: 400 },
    );
  }
  if (reason.trim().length === 0) {
    return NextResponse.json(
      { error: "reason required" },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_sanctions_decide", {
    p_queue_id: queueId,
    p_decision: decision,
    p_reason: reason,
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
      { error: "admin_sanctions_decide failed", detail: error.message },
      { status: code },
    );
  }

  // H4 — sanction_alert fan-out (only on confirm, best-effort).
  const result = (data ?? {}) as { supplier_id?: string; decision?: string };
  if (result.decision === "confirm" && result.supplier_id) {
    const supplierId = result.supplier_id;
    const { data: supp } = await supabase
      .from("suppliers")
      .select("company_name, slug")
      .eq("id", supplierId)
      .maybeSingle();
    const { data: q } = await supabase
      .from("verification_queue")
      .select("source_data")
      .eq("id", queueId)
      .maybeSingle();
    const listName =
      (q?.source_data as { list?: string } | null)?.list ?? "Sanctions list";
    void notifySanctionConfirmed({
      supplierId,
      supplierName: supp?.company_name ?? "Saved supplier",
      supplierSlug: supp?.slug ?? supplierId,
      listName,
      reason,
    });
    revalidateTag(TAG_DISCOVER_FACETS);
    revalidateTag(TAG_DISCOVER_SUPPLIERS);
    if (supp?.slug) revalidateTag(tagSupplier(supp.slug));
  }

  return NextResponse.json(data);
}
