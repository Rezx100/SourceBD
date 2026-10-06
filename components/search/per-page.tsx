"use client";

// "25 per page" with the page sizes the search takes. The hrefs are built on the server (they
// keep the open record); choosing one follows it inside a transition, so the button spins until
// the bigger page has arrived: the menu closes on the click, and 100 rows take a moment.

import { CaretDown, Check, SpinnerGap } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Menu, MenuItem, buttonClass } from "@/components/kit";

export function PerPageMenu({ per, sizes }: { per: number; sizes: readonly (readonly [number, string])[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Menu
      align="end"
      trigger={
        <button type="button" aria-busy={pending || undefined} className={buttonClass({ kind: "secondary", className: "gap-1 pl-3 pr-2" })}>
          {per} per page
          {pending ? (
            <SpinnerGap size={16} className="shrink-0 animate-spin text-ink-2 motion-reduce:animate-none" aria-hidden />
          ) : (
            <CaretDown size={16} className="shrink-0 text-ink-2" aria-hidden />
          )}
        </button>
      }
    >
      {sizes.map(([n, href]) => (
        <MenuItem key={n} onSelect={() => start(() => router.push(href, { scroll: false }))}>
          <span className="flex items-center gap-2">
            <span className="flex size-4 shrink-0 items-center justify-center">{n === per ? <Check size={16} className="text-brand" aria-label="Page size" /> : null}</span>
            {n} per page
          </span>
        </MenuItem>
      ))}
    </Menu>
  );
}
