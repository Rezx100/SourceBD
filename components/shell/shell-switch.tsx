"use client";

// Which shell an /app page is drawn in, decided on the client (REZ-C, audit
// cycles 5–6).
//
// The dashboard kit's pages draw their own `AppShell`; every other page gets
// the older shell from the app layout. The layout used to choose from a
// request header, which is only right on a full page load: on a client
// navigation Next does not re-render a layout shared by both pages, so going
// from an old-shell page to a kit page by `next/link` kept the old shell and
// drew the kit's inside it. This component re-renders on every navigation
// (`usePathname`), so the choice follows the page actually shown.
//
// The element tree around `children` is the SAME on both sides — three
// `div`s, whatever the page — and only their props change. Returning a bare
// fragment on one side and a `<main>` on the other changed the parent
// element's type, which makes React unmount and remount everything below it:
// the onboarding tour in `app/(app)/app/layout.tsx` re-opened on every
// crossing, at its first step, after the buyer had dismissed it (cycle 6). On
// a kit page the wrappers are `display: contents` and carry no landmark; the
// kit's own `<main>` is the page's one.

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
  // The kit draws its own shell, and its rail reflows into a horizontal nav
  // strip below `md` rather than hiding — so it needs no `BottomTabBar`.
  const kit = drawsKitShell(usePathname() ?? "");
  return (
    <div className={kit ? "contents" : "flex min-h-dvh flex-col bg-bg-l0"}>
      {kit ? null : top}
      <div className={kit ? "contents" : "flex flex-1 flex-col md:flex-row md:items-start"}>
        {kit ? null : side}
        <div
          role={kit ? undefined : "main"}
          id={kit ? undefined : "main-content"}
          tabIndex={kit ? undefined : -1}
          className={
            kit
              ? "contents"
              : "flex-1 px-4 pb-[calc(56px+env(safe-area-inset-bottom,0px)+1rem)] pt-6 md:min-h-[calc(100dvh-3.5rem)] md:px-10 md:pb-12 md:pt-10 lg:px-12 focus:outline-none"
          }
        >
          {children}
        </div>
      </div>
      {kit ? null : bottom}
    </div>
  );
}
