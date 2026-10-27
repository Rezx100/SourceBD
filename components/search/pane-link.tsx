"use client";

// A results row's link to the record beside the results, read in full while the pointer rests on it
// (founder, 28 Oct 2026: switching records took ~2 s and reopening one was no faster). Next keys a
// plain navigation's cache entry by the path alone, so `?record=a` and `?record=b` overwrote each
// other and staleTimes never helped; a full prefetch is keyed with the search, so the click lands on a
// page already read and a record opened again within the router's stale time draws at once. Not on
// sight: 25 rows would be 25 record reads. The dwell keeps a pointer sweeping down the list from
// reading every row it crosses.

import { AppRouterContext, type PrefetchOptions } from "next/dist/shared/lib/app-router-context.shared-runtime";
import Link from "next/link";
import { useContext, useRef, type ComponentProps } from "react";

const FULL = { kind: "full" } as PrefetchOptions;
const DWELL_MS = 120;

export function PaneLink({ href, onMouseEnter, onMouseLeave, onPointerDown, ...rest }: Omit<ComponentProps<typeof Link>, "href" | "prefetch"> & { href: string }) {
  // The context, not useRouter: the table is drawn outside a router too (as useRowSave reads it).
  const router = useContext(AppRouterContext);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  return (
    <Link
      {...rest}
      href={href}
      prefetch={false}
      onMouseEnter={(e) => {
        onMouseEnter?.(e);
        cancel();
        timer.current = setTimeout(() => router?.prefetch(href, FULL), DWELL_MS);
      }}
      onMouseLeave={(e) => {
        onMouseLeave?.(e);
        cancel();
      }}
      // A click quicker than the dwell, or a tap: the press starts the read, so the click finds it in flight.
      onPointerDown={(e) => {
        onPointerDown?.(e);
        cancel();
        router?.prefetch(href, FULL);
      }}
    />
  );
}
