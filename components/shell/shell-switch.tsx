"use client";

// Which shell an /app page is drawn in, decided on the client (REZ-C, audit
// cycle 5).
//
// The dashboard kit's pages draw their own `AppShell`; every other page gets
// the older shell from the app layout. The layout used to choose from a
// request header, which is only right on a full page load: on a client
// navigation Next does not re-render a layout shared by both pages, so going
// from an old-shell page to a kit page by `next/link` kept the old shell and
// drew the kit's inside it — two sidebars, two skip links, a `<main>` in a
// `<main>`. This component re-renders on every navigation (`usePathname`), so
// the choice follows the page actually shown.

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { drawsKitShell } from "@/lib/dashboard/kit-shell";

export function ShellSwitch({
  top,
  side,
  bottom,
  children,
}: {
  /** Skip link, scroll reset and topbar: the old shell's header. */
  top: ReactNode;
  /** The rail and the sidebar. */
  side: ReactNode;
  /** The phone bottom-tab bar. */
  bottom: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  // The kit draws its own shell, and its rail reflows into a horizontal nav
  // strip below `md` rather than hiding — so it needs no `BottomTabBar`.
  if (drawsKitShell(pathname)) return <>{children}</>;
  return (
    <div className="flex min-h-dvh flex-col bg-bg-l0">
      {top}
      <div className="flex flex-1 flex-col md:flex-row md:items-start">
        {side}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 px-4 pb-[calc(56px+env(safe-area-inset-bottom,0px)+1rem)] pt-6 md:min-h-[calc(100dvh-3.5rem)] md:px-10 md:pb-12 md:pt-10 lg:px-12 focus:outline-none"
        >
          {children}
        </main>
      </div>
      {bottom}
    </div>
  );
}
