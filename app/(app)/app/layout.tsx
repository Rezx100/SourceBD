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
// The app layout above still routes through `ShellSwitch`, which draws
// nothing around a /app route. Spec H5's onboarding tour mounts after the
// shell; it short-circuits server-side once the buyer has completed or
// dismissed it.

import { AppShell } from "@/components/dashboard/app-shell";
import { TourMount } from "@/components/onboarding/tour-mount";
import { loadBuyerShell } from "@/lib/dashboard/load-buyer-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function BuyerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const shell = await loadBuyerShell(supabase);
  return (
    <>
      <AppShell sidebar={shell.sidebar} topbar={shell.topbar} mainId="main-content">
        {children}
      </AppShell>
      <TourMount flavour="buyer" />
    </>
  );
}
