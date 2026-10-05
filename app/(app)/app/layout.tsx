// The buyer section's layout: the v4 app frame (B3), drawn ONCE around every /app
// page, so a navigation swaps only `<main>`. The frame marks the current item
// from the URL on the client. The supplier portal and admin keep the older shell
// (`app/(app)/(old-shell)`) until B10.
//
// Analytics learns who is signed in from the frame's own sign-in read. The
// onboarding tour mounts after the frame and streams in behind the page.

import { Suspense } from "react";
import { preload } from "react-dom";
import { AppFrame } from "@/components/frame";
import { TourMount } from "@/components/onboarding/tour-mount";
import { loadFrameBadges } from "@/lib/dashboard/frame-badges";
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
  // "Last active" on Team and roles (gap 4): the database stamps it at most every 10 minutes, so this
  // is a no-op most of the time. Fire and forget; a failed call, or 0111 not applied yet, changes nothing.
  void (async () => {
    try {
      await supabase.rpc("profile_touch");
    } catch {
      // best effort
    }
  })();
  // The menu's two counts (Messages "N new", Compliance "N to check") start now and are NOT awaited:
  // the frame is drawn at once and they fill in when they settle (row 24). Compliance is the hub's own
  // count; a slow or failed read draws no badge, never a 0.
  const badges = loadFrameBadges(supabase);
  // ponytail: the old shell's loader still reads three counts the frame does not
  // show; it goes with the old kit (B11).
  const shell = await loadBuyerShell(supabase);
  return (
    <PostHogProvider userId={shell.userId}>
      <AppFrame account={shell.sidebar.account ?? null} badges={badges}>
        {children}
      </AppFrame>
      <Suspense fallback={null}>
        <TourMount flavour="buyer" />
      </Suspense>
    </PostHogProvider>
  );
}
