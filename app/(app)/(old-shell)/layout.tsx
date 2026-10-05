// The layout of the two portals that are not the buyer app: admin (`/admin`) and the supplier portal (`/supplier`),
// on the v4 portal frame (B10a). The frame is drawn ONCE around every page, so a navigation swaps only `<main>`;
// the current item follows the URL on the client.
//
// Auth is enforced by `middleware.ts` and, for admin, again by `admin/layout.tsx`: nothing here is a gate. This
// reads what the frame shows and nothing more: who is signed in (the account menu) and, for an admin, the four
// queue counts beside the menu. Each read races a timeout, so a slow database draws the frame without the
// figure (an unread count is absent, never 0) instead of holding the whole portal.
//
// The route group is still named `(old-shell)`; it goes with the last old-kit page (B11).

import { PortalFrame, type PortalBadges } from "@/components/frame/portal";
import { getServerRole } from "@/lib/auth";
import { PostHogProvider } from "@/lib/posthog/provider";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SettingsDoc = { email: string | null; display_name: string | null; avatar_url: string | null };

type AdminDashboardDoc = {
  queues?: {
    claims_pending?: number;
    sanctions_active?: number;
    verification_queue_total?: number;
    verification_queue_by_type?: Record<string, number>;
  };
};

const withTimeout = <T,>(p: PromiseLike<T>, ms: number, fallback: T): Promise<T> => Promise.race([Promise.resolve(p), new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  let userId: string | null = null;
  let email: string | null = null;
  let name: string | null = null;
  let avatarUrl: string | null = null;
  let badges: PortalBadges = {};
  try {
    const supabase = await createSupabaseServerClient();
    const [{ data: userData }, role] = await Promise.all([
      withTimeout(supabase.auth.getUser(), 5000, { data: { user: null } } as Awaited<ReturnType<typeof supabase.auth.getUser>>),
      withTimeout(getServerRole(), 5000, null as Awaited<ReturnType<typeof getServerRole>>),
    ]);
    userId = userData.user?.id ?? null;
    email = userData.user?.email ?? null;
    const settingsRead = userId ? supabase.rpc("settings_get") : Promise.resolve({ data: null });
    const adminRead = userId && role === "admin" ? supabase.rpc("admin_dashboard") : Promise.resolve({ data: null });
    const [settingsRes, adminRes] = await Promise.all([
      withTimeout(settingsRead, 6000, { data: null } as Awaited<typeof settingsRead>),
      withTimeout(adminRead, 6000, { data: null } as Awaited<typeof adminRead>),
    ]);
    const settings = (settingsRes.data ?? null) as SettingsDoc | null;
    if (settings) {
      name = settings.display_name ?? name;
      email = settings.email ?? email;
      avatarUrl = settings.avatar_url ?? avatarUrl;
    }
    const admin = (adminRes.data ?? null) as AdminDashboardDoc | null;
    if (admin?.queues) {
      const q = admin.queues;
      badges = {
        adminQueue: num(q.verification_queue_total),
        adminClaims: num(q.verification_queue_by_type?.claim_review ?? q.claims_pending),
        adminCerts: num(q.verification_queue_by_type?.cert_doc_review),
        adminSanctions: num(q.sanctions_active),
      };
    }
  } catch {
    // Fail-soft: draw the frame with whatever was read.
  }
  const initial = (name ?? email ?? "").trim().charAt(0).toUpperCase() || null;
  return (
    <PostHogProvider userId={userId}>
      <PortalFrame account={userId ? { initial, name, email, avatarUrl } : null} badges={badges}>
        {children}
      </PortalFrame>
    </PostHogProvider>
  );
}
