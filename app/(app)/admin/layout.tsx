// Admin route group layout — defense in depth (R9 round 3, issue #2).
//
// Middleware (middleware.ts) already gates `/admin/*` and forces a
// redirect to `/login` for any non-admin caller; this layout runs the
// same role check on the server before any admin page renders, so a
// future middleware regression cannot leak admin chrome to a non-admin.
//
// Rule 7 (server enforces auth and ownership; hiding UI is never a
// security control) — this is a server-side gate, not a UI-hiding one.

import { notFound } from "next/navigation";

import { getServerRole } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const role = await getServerRole();
  if (role !== "admin") notFound();
  return <>{children}</>;
}
