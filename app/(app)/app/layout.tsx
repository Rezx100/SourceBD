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

import { preload } from "react-dom";
import { AppShell } from "@/components/dashboard/app-shell";
import { TourMount } from "@/components/onboarding/tour-mount";
import { loadBuyerShell } from "@/lib/dashboard/load-buyer-shell";
import { SOURCE_LOGO_FILES } from "@/lib/dashboard/source-logos";
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
    <>
      <AppShell sidebar={shell.sidebar} topbar={shell.topbar} mainId="main-content">
        {children}
      </AppShell>
      <TourMount flavour="buyer" />
    </>
  );
}
