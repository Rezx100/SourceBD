// The buyer section's layout: the dashboard kit's shell, drawn ONCE around
// every /app page (27 Sep 2026). Before this each page drew its own
// `AppShell`, so a click tore the rail and topbar down and built them again,
// nothing could stay pinned, and the shell's four reads ran on every page.
// Now a navigation swaps only the content region; the rail marks the current
// page from the URL on the client (`SidebarNav`), the search field reads its
// text from the URL (`SearchTypeahead`), and the shell is the viewport from
// `md` up — the page never scrolls, the content region or a pane inside it
// does.
//
// No layout of the `(app)` group sits above this one: the older shell's
// layout, and its reads, wrap only the supplier portal and admin
// (`app/(app)/(old-shell)`, 29 Sep 2026). So analytics learns who is signed
// in here, from the shell's own sign-in read. Spec H5's onboarding tour
// mounts after the shell; it short-circuits server-side once the buyer has
// completed or dismissed it. Its two reads (who is signed in, then the tour's
// state) stream in behind the page: outside a boundary they held the whole
// page back two more round trips after the shell's own.

import { Suspense } from "react";
import { preload } from "react-dom";
import { AppShell } from "@/components/dashboard/app-shell";
import { TourMount } from "@/components/onboarding/tour-mount";
import { loadBuyerShell } from "@/lib/dashboard/load-buyer-shell";
import { SOURCE_LOGO_FILES } from "@/lib/dashboard/source-logos";
import { PostHogProvider } from "@/lib/posthog/provider";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function BuyerLayout({ children }: { children: React.ReactNode }) {
  // A register's mark is a CSS mask, so its PNG was only asked for when a
  // mark first painted: scrolling a record or a line, the squares arrived
  // empty and filled in one by one (founder's video, 29 Sep 2026). Eleven
  // files, 0.8–11.5 KB each, fetched once when the app opens.
  for (const href of SOURCE_LOGO_FILES) preload(href, { as: "image" });
  const supabase = await createSupabaseServerClient();
  const shell = await loadBuyerShell(supabase);
  return (
    <PostHogProvider userId={shell.userId}>
      <AppShell sidebar={shell.sidebar} topbar={shell.topbar} mainId="main-content">
        {children}
      </AppShell>
      <Suspense fallback={null}>
        <TourMount flavour="buyer" />
      </Suspense>
    </PostHogProvider>
  );
}
