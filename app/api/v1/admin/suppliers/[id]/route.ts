// /api/v1/admin/suppliers/[id] — admin supplier mutation (Spec A2).
// Dispatches to public.admin_supplier_update; whitelist enforced by RPC.

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

function rpcStatus(detail: string): number {
  const d = detail.toLowerCase();
  if (d.includes("admin only")) return 403;
  if (d.includes("not found")) return 404;
  if (d.includes("not editable") || d.includes("patch") || d.includes("entity_type")) {
    return 422;
  }
  return 400;
}

export async function PATCH(
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

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const patch = body.patch;
  if (
    patch == null ||
    typeof patch !== "object" ||
    Array.isArray(patch) ||
    Object.keys(patch as Record<string, unknown>).length === 0
  ) {
    return NextResponse.json(
      { error: "patch must be a non-empty object" },
      { status: 422 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_supplier_update", {
    p_id: id,
    p_patch: patch,
  });
  if (error) {
    return NextResponse.json(
      { error: "admin_supplier_update failed", detail: error.message },
      { status: rpcStatus(error.message) },
    );
  }
  revalidateTag(TAG_DISCOVER_FACETS);
  revalidateTag(TAG_DISCOVER_SUPPLIERS);
  const { data: slugRow } = await supabase
    .from("suppliers")
    .select("slug")
    .eq("id", id)
    .maybeSingle();
  const slug = (slugRow as { slug?: string } | null)?.slug;
  if (slug) {
    revalidateTag(tagSupplier(slug));
    revalidatePath(`/suppliers/${slug}`);
    revalidatePath(`/app/suppliers/${slug}`);
    revalidatePath("/discover");
    revalidatePath("/app/discover");
  }
  return NextResponse.json(data ?? { ok: true, id });
}
