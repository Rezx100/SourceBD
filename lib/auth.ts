// Server-side auth helpers.
//
// Spec F1 ships placeholders only; Spec F3 (Auth) replaces `getServerRole`
// with a real Supabase session lookup against the `profiles.role` column.
// Until then `DEV_ADMIN_BYPASS=1` (set in `.env.local` for local dev) makes
// the current request pass any `role === "admin"` gate. The bypass has no
// effect in production builds — `/dev/*` routes hard-404 when
// `NODE_ENV === "production"` regardless of this value.

import "server-only";

export type Role = "admin" | "buyer" | "supplier";

export async function getServerRole(): Promise<Role | null> {
  if (process.env.NODE_ENV !== "production" && process.env.DEV_ADMIN_BYPASS === "1") {
    return "admin";
  }
  // TODO(Spec F3 — Auth): read Supabase session → profiles.role.
  return null;
}
