"use client";

// Where the record sits beside a conversation (B6a): the 344 column from 1280 (Paper `10 · thread
// with record beside`), the kit's right-hand drawer from 768 to 1279, and a bottom sheet under 768
// (`11 · record as a sheet over the thread`). The conversation stays where it is in all three. The
// open record is in the URL (`?record=`), so closing it, and Escape, are a navigation to `closeHref`.

import { useRouter } from "next/navigation";
import { useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import { Drawer, Sheet } from "@/components/kit/overlay";

const WIDE = "(min-width: 1280px)";
const PHONE = "(max-width: 767px)";

function subscribe(onChange: () => void) {
  const mqs = [window.matchMedia(WIDE), window.matchMedia(PHONE)];
  for (const mq of mqs) mq.addEventListener("change", onChange);
  return () => {
    for (const mq of mqs) mq.removeEventListener("change", onChange);
  };
}

type Tier = "wide" | "mid" | "phone";

/** Wide from 1280, phone under 768. The server draws the wide column, which CSS hides under 1280 until this answers. */
function useTier(): Tier {
  return useSyncExternalStore(
    subscribe,
    () => (window.matchMedia(WIDE).matches ? "wide" : window.matchMedia(PHONE).matches ? "phone" : "mid"),
    () => "wide",
  );
}

export function BesideRecord({ title, closeHref, children }: { title: string; closeHref: string; children: ReactNode }) {
  const tier = useTier();
  const router = useRouter();
  const close = () => router.push(closeHref, { scroll: false });
  if (tier === "wide") {
    const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
      const t = e.target as HTMLElement;
      if (e.key === "Escape" && !e.defaultPrevented && !t.closest("input, textarea, select, [contenteditable=true]")) close();
    };
    return (
      <aside aria-label={title} onKeyDown={onKeyDown} className="hidden min-h-0 w-details shrink-0 flex-col overflow-y-auto border-l border-line bg-surface xl:flex">
        {children}
      </aside>
    );
  }
  return tier === "phone" ? (
    <Sheet open onOpenChange={(next) => (next ? null : close())} title={title} flush>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </Sheet>
  ) : (
    <Drawer open onOpenChange={(next) => (next ? null : close())} title={title}>
      {children}
    </Drawer>
  );
}
