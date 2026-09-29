"use client";

// The topbar's search field, where the page does not carry its own.
//
// The search landing (`/app`, founder 28 Sep 2026: "the first viewport should
// be the search window") is one large field in the middle of the page. A
// second, smaller field in the topbar above it was two search boxes on one
// screen, and ⌘K would have focused the wrong one. The shell is drawn once by
// the layout and does not know the page, so this reads the URL on the client
// and steps the topbar field aside on the landing. The slot keeps its width
// so the topbar's caption and account link do not jump between pages.

import { usePathname } from "next/navigation";
import { useSyncExternalStore, type ReactNode } from "react";

/** The pages whose content draws the app's search field itself. */
export const OWN_FIELD_PATHS = ["/app"] as const;

export function pageDrawsOwnField(pathname: string | null): boolean {
  const path = (pathname ?? "").replace(/(.)\/+$/, "$1");
  return (OWN_FIELD_PATHS as readonly string[]).includes(path);
}

export function TopbarSearchSlot({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pageDrawsOwnField(pathname)) return <div aria-hidden className="w-full max-w-[420px]" />;
  return <>{children}</>;
}

/** True on Apple platforms, where the shortcut is ⌘K rather than Ctrl K. */
export function isApplePlatform(platform: string | null | undefined, userAgent: string | null | undefined): boolean {
  return /mac|iphone|ipad|ipod/i.test(platform || "") || /mac os x|iphone|ipad/i.test(userAgent || "");
}

const noop = () => () => {};

/**
 * True on a Mac, iPhone or iPad, for a shortcut hint in the buyer's own keys.
 * The server cannot know the platform, so it renders the Ctrl form and a Mac
 * swaps in ⌘ after hydration (`useSyncExternalStore`, so the first client
 * render still matches the server's).
 */
export function useApplePlatform(): boolean {
  return useSyncExternalStore(
    noop,
    () => isApplePlatform(navigator.platform, navigator.userAgent),
    () => false,
  );
}

/**
 * The shortcut hint beside a search field, in the buyer's own keyboard's
 * words. It said "⌘K" on every machine, and on Windows the founder read it as
 * a stray glyph.
 */
export function ShortcutHint({ className }: { className?: string }) {
  const apple = useApplePlatform();
  return (
    <kbd
      aria-label={apple ? "Command K" : "Control K"}
      className={
        "hidden shrink-0 items-center gap-0.5 rounded-xs bg-surface-sunken px-1.5 font-sans text-[11px] font-medium leading-5 text-ink-muted sm:inline-flex" +
        (className ? ` ${className}` : "")
      }
    >
      {apple ? "⌘" : "Ctrl"}
      <span>K</span>
    </kbd>
  );
}
