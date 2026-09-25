// The loading state of a kit route, inside the kit's own frame (REZ-C, audit
// cycle 6).
//
// A kit page draws `AppShell` itself, so the app layout draws no shell on its
// route (`ShellSwitch`). The route's `loading.tsx` renders before the page
// does — and without this it rendered a bare skeleton: no sidebar, no topbar,
// no skip link, no `<main>`, for as long as the page took. The shell here is
// the real component with nothing read yet: no counts, no recent searches,
// no caption. It shows where the buyer is and claims nothing it does not know.

import type { ReactNode } from "react";

import { AppShell, activeNavKey } from "./app-shell";

export function KitLoading({ path, screenLabel, children }: { path: string; screenLabel: string; children: ReactNode }) {
  return (
    <AppShell
      sidebar={{ active: activeNavKey(path), activeExact: false, counts: {}, recent: [], plan: { name: "" } }}
      topbar={{ caption: "", initial: null }}
      mainId="main-content"
      screenLabel={screenLabel}
    >
      {children}
    </AppShell>
  );
}
