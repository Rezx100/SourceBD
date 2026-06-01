// Authenticated app shell. Wraps the buyer (`/app`), supplier (`/supplier`)
// and admin (`/admin`) route groups with the shared topbar + sidebar per
// `context/frontend-design-spec.md` §2. Per-role sidebar slot list is
// resolved client-side by `Sidebar` from the path. Auth enforcement lives in
// `middleware.ts` (placeholder in F2; real Supabase session in F3).

import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { SkipLink } from "@/components/ui/skip-link";
import { PostHogProvider } from "@/lib/posthog/provider";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AppShellLayout({ children }: { children: React.ReactNode }) {
  let userId: string | null = null;
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    userId = null;
  }
  return (
    <PostHogProvider userId={userId}>
      <div className="flex min-h-screen flex-col bg-bg-l0">
        <SkipLink />
        <Topbar />
        <div className="flex flex-1">
          <Sidebar />
          <main id="main-content" tabIndex={-1} className="flex-1 px-4 py-6 md:px-8 md:py-8 focus:outline-none">{children}</main>
        </div>
      </div>
    </PostHogProvider>
  );
}
