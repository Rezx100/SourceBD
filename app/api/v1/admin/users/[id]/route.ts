// /api/v1/admin/users/[id] — admin user mutation (Spec A5).
// Dispatches to public.admin_user_update; whitelist enforced by RPC.

import { NextResponse } from "next/server";

import { getServerRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PatchBody = {
  patch?: {
    role?: unknown;
    is_suspended?: unknown;
    suspended_reason?: unknown;
  };
};

function rpcStatus(detail: string): number {
  const d = detail.toLowerCase();
  if (d.includes("admin only")) return 403;
  if (d.includes("cannot edit self")) return 403;
  if (d.includes("last active admin")) return 409;
  if (d.includes("user not found")) return 404;
  if (
    d.includes("not editable") ||
    d.includes("required") ||
    d.includes("must be") ||
    d.includes("no-op") ||
    d.includes("empty")
  ) {
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

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
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

  // Shape validation matching the RPC's whitelist + types.
  const clean: Record<string, unknown> = {};
  if ("role" in patch) {
    const r = patch.role;
    if (typeof r !== "string" || !["buyer", "supplier", "admin"].includes(r)) {
      return NextResponse.json(
        { error: "role must be buyer|supplier|admin" },
        { status: 422 },
      );
    }
    clean.role = r;
  }
  if ("is_suspended" in patch) {
    const s = patch.is_suspended;
    if (typeof s !== "boolean") {
      return NextResponse.json(
        { error: "is_suspended must be boolean" },
        { status: 422 },
      );
    }
    clean.is_suspended = s;
  }
  if ("suspended_reason" in patch) {
    const r = patch.suspended_reason;
    if (r !== null && typeof r !== "string") {
      return NextResponse.json(
        { error: "suspended_reason must be string or null" },
        { status: 422 },
      );
    }
    if (typeof r === "string" && r.length > 2000) {
      return NextResponse.json(
        { error: "suspended_reason too long" },
        { status: 422 },
      );
    }
    clean.suspended_reason = r;
  }
  if (clean.is_suspended === true) {
    const reason =
      typeof clean.suspended_reason === "string"
        ? clean.suspended_reason.trim()
        : "";
    if (reason.length === 0) {
      return NextResponse.json(
        { error: "suspended_reason required when suspending" },
        { status: 422 },
      );
    }
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_user_update", {
    p_user_id: id,
    p_patch: clean,
  });
  if (error) {
    return NextResponse.json(
      { error: "admin_user_update failed", detail: error.message },
      { status: rpcStatus(error.message) },
    );
  }
  return NextResponse.json(data ?? { ok: true, user_id: id });
}
