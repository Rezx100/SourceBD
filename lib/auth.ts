// Server-side auth helpers.
//
// Spec F3 reads the Supabase session and resolves the caller's role from
// `public.profiles.role`. The function signature is preserved so existing
// callers (`middleware.ts`, `/dev/components` gate) work unchanged.
//
// `DEV_ADMIN_BYPASS=1` is retained for local dev only and never honoured in
// production — `/dev/*` routes also hard-404 when `NODE_ENV === "production"`
// regardless of this value.

import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Role = "admin" | "buyer" | "supplier";

const ALLOWED: ReadonlySet<Role> = new Set<Role>(["admin", "buyer", "supplier"]);

export async function getServerRole(): Promise<Role | null> {
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.DEV_ADMIN_BYPASS === "1"
  ) {
    return "admin";
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !data) return null;
  const role = data.role as Role;
  return ALLOWED.has(role) ? role : null;
}
