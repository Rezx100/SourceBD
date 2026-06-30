// Authenticated app shell. Wraps the buyer (`/app`), supplier (`/supplier`)
// and admin (`/admin`) route groups with the shared topbar + sidebar per
// `context/frontend-design-spec.md` §2. Per-role sidebar slot list is
// resolved client-side by `Sidebar` from the path. Auth enforcement lives in
// `middleware.ts` (placeholder in F2; real Supabase session in F3).
// Sidebar badge counts are fetched here (server) from existing RPCs
// (`buyer_dashboard` migration 0026, `admin_dashboard` migration 0037,
// `settings_get`) so the client component stays pure render.

import { Sidebar, type SidebarBadges } from "@/components/shell/sidebar";
import { SidebarRail } from "@/components/shell/sidebar-rail";
import { BottomTabBar } from "@/components/shell/bottom-tab-bar";
import { Topbar } from "@/components/shell/topbar";
import { SkipLink } from "@/components/ui/skip-link";
import { PostHogProvider } from "@/lib/posthog/provider";
import { FeedbackMount } from "@/components/feedback/feedback-mount";
import { ScrollToTop } from "@/components/shell/scroll-to-top";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServerRole } from "@/lib/auth";

type SettingsDoc = {
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  plan_tier: string | null;
};

type BuyerDashboardDoc = {
  saved_count?: number;
  alerts?: unknown[];
};

type AdminDashboardDoc = {
  suppliers?: { published?: number };
  queues?: {
    claims_pending?: number;
    sanctions_active?: number;
    verification_queue_total?: number;
    verification_queue_by_type?: Record<string, number>;
  };
  generated_at?: string;
};

export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let userId: string | null = null;
  let email: string | null = null;
  let displayName: string | null = null;
  let avatarUrl: string | null = null;
  let planTier: string | null = null;
  let moatTotal: number | null = null;
  let moatRefreshedAt: string | null = null;
  let badges: SidebarBadges = {};

  let role: Awaited<ReturnType<typeof getServerRole>> = null;
  // Per-call race timeout. When Supabase compute is under pressure, individual
  // dashboard RPCs can stall for >30s and block the entire shell from rendering
  // (auth'd users see app/loading.tsx with no chrome). Each fetch races against
  // a 6s timeout; on miss we render the shell with whatever we did collect.
  const withTimeout = <T,>(p: PromiseLike<T>, ms: number, fallback: T): Promise<T> =>
    Promise.race([
      Promise.resolve(p),
      new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
    ]);
  try {
    const supabase = await createSupabaseServerClient();
    const [{ data: userData }, roleResolved] = await Promise.all([
      withTimeout(supabase.auth.getUser(), 5000, { data: { user: null } } as Awaited<ReturnType<typeof supabase.auth.getUser>>),
      withTimeout(getServerRole(), 5000, null as Awaited<ReturnType<typeof getServerRole>>),
    ]);
    userId = userData.user?.id ?? null;
    email = userData.user?.email ?? null;
    role = roleResolved;

    const moatPromise = supabase
      .from("suppliers")
      .select("id", { head: true, count: "exact" })
      .eq("is_published", true);
    const settingsPromise = userId
      ? supabase.rpc("settings_get")
      : Promise.resolve({ data: null });
    const buyerPromise =
      userId && role === "buyer"
        ? supabase.rpc("buyer_dashboard")
        : Promise.resolve({ data: null });
    const adminPromise =
      userId && role === "admin"
        ? supabase.rpc("admin_dashboard")
        : Promise.resolve({ data: null });

    const [moatRes, settingsRes, buyerRes, adminRes] = await Promise.all([
      withTimeout(moatPromise, 6000, { count: null } as Awaited<typeof moatPromise>),
      withTimeout(settingsPromise, 6000, { data: null } as Awaited<typeof settingsPromise>),
      withTimeout(buyerPromise, 6000, { data: null } as Awaited<typeof buyerPromise>),
      withTimeout(adminPromise, 6000, { data: null } as Awaited<typeof adminPromise>),
    ]);

    moatTotal = typeof moatRes.count === "number" ? moatRes.count : null;
    const settings = (settingsRes.data ?? null) as SettingsDoc | null;
    if (settings) {
      displayName = settings.display_name ?? displayName;
      email = settings.email ?? email;
      avatarUrl = settings.avatar_url ?? avatarUrl;
      planTier = settings.plan_tier ?? planTier;
    }
    const buyerDoc = (buyerRes.data ?? null) as BuyerDashboardDoc | null;
    if (buyerDoc) {
      badges = {
        ...badges,
        discover: moatTotal ?? undefined,
        saved: typeof buyerDoc.saved_count === "number" ? buyerDoc.saved_count : 0,
        compliance: Array.isArray(buyerDoc.alerts) ? buyerDoc.alerts.length : 0,
      };
    }
    const adminDoc = (adminRes.data ?? null) as AdminDashboardDoc | null;
    if (adminDoc) {
      const certBacklog =
        adminDoc.queues?.verification_queue_by_type?.cert_doc_review ?? 0;
      const claimBacklog =
        adminDoc.queues?.verification_queue_by_type?.claim_review ??
        adminDoc.queues?.claims_pending ??
        0;
      badges = {
        ...badges,
        discover: adminDoc.suppliers?.published ?? moatTotal ?? undefined,
        adminQueue: adminDoc.queues?.verification_queue_total ?? 0,
        adminClaims: claimBacklog,
        adminCerts: certBacklog,
        adminSanctions: adminDoc.queues?.sanctions_active ?? 0,
      };
      if (adminDoc.generated_at) moatRefreshedAt = adminDoc.generated_at;
    }
    // Buyer/admin variants always show the moat headline even when no role
    // dashboard payload arrives (e.g. supplier users browsing /app/* drafts).
    if (badges.discover == null && moatTotal != null) {
      badges = { ...badges, discover: moatTotal };
    }
  } catch {
    // Fail-soft: render the shell with whatever we managed to collect.
  }

  return (
    <PostHogProvider userId={userId}>
      <div className="flex min-h-dvh flex-col bg-bg-l0">
        <ScrollToTop />
        <SkipLink />
        <Topbar
          role={role}
          moatTotal={moatTotal}
          avatarUrl={avatarUrl}
          displayName={displayName}
          email={email}
        />
        <div className="flex flex-1 flex-col md:flex-row md:items-start">
          {/* R2 — tablet portrait (md..<lg) renders the icon-only rail,
              desktop (≥lg) renders the full sidebar. Both have their own
              visibility class so they never both render at the same width. */}
          <SidebarRail role={role} />
          <Sidebar
            role={role}
            email={email}
            displayName={displayName}
            avatarUrl={avatarUrl}
            planTier={planTier}
            moatTotal={moatTotal}
            moatRefreshedAt={moatRefreshedAt}
            badges={badges}
          />
          <main
            id="main-content"
            tabIndex={-1}
            className="flex-1 px-4 pb-[calc(56px+env(safe-area-inset-bottom,0px)+1rem)] pt-6 md:min-h-[calc(100dvh-3.5rem)] md:px-10 md:pb-12 md:pt-10 lg:px-12 focus:outline-none"
          >
            {children}
          </main>
        </div>
        {/* R2 — phone only (md:hidden). Bottom-tab covers the top 5
            destinations per role; the full sidebar is available via the
            topbar hamburger. */}
        <BottomTabBar role={role} />
        <FeedbackMount userId={userId} />
      </div>
    </PostHogProvider>
  );
}
