// /api/v1/admin/certifications/decide — approve/reject a queued cert (Spec A3).

import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

import { getServerRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
  const reason = typeof body.reason === "string" ? body.reason : null;

  if (!UUID_RE.test(queueId)) {
    return NextResponse.json({ error: "queue_id must be a UUID" }, { status: 400 });
  }
  if (decision !== "approve" && decision !== "reject") {
    return NextResponse.json(
      { error: "decision must be approve|reject" },
      { status: 400 },
    );
  }
  if (decision === "reject" && (!reason || reason.trim().length === 0)) {
    return NextResponse.json(
      { error: "reason required when rejecting" },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_cert_decide", {
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
      { error: "admin_cert_decide failed", detail: error.message },
      { status: code },
    );
  }
  revalidateTag(TAG_DISCOVER_FACETS);
  revalidateTag(TAG_DISCOVER_SUPPLIERS);
  const result = (data as { supplier_id?: string; certification_id?: string } | null) ?? null;
  let supplierId = result?.supplier_id;
  if (!supplierId && result?.certification_id) {
    const { data: certRow } = await supabase
      .from("certifications")
      .select("supplier_id")
      .eq("id", result.certification_id)
      .maybeSingle();
    supplierId = (certRow as { supplier_id?: string } | null)?.supplier_id;
  }
  if (supplierId) {
    const { data: slugRow } = await supabase
      .from("suppliers")
      .select("slug")
      .eq("id", supplierId)
      .maybeSingle();
    const slug = (slugRow as { slug?: string } | null)?.slug;
    if (slug) {
      revalidateTag(tagSupplier(slug));
      revalidatePath(`/suppliers/${slug}`);
      revalidatePath(`/app/suppliers/${slug}`);
      revalidatePath("/discover");
      revalidatePath("/app/discover");
    }
  }
  return NextResponse.json(data);
}
