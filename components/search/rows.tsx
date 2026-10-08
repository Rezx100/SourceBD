// The rows of the search landing's lists (recent, saved and common searches): a link per line
// with a count at the end. On a phone they sit on the page; from `sm` they are one bordered list.

import Link from "next/link";
import type { ReactNode } from "react";

export const h2 = "text-md font-semibold text-ink sm:text-lg";

/** A list of links, one per line, each with a count at the end: recent searches, saved searches, common searches. */
export function LinkRows({ children }: { children: ReactNode }) {
  return <ul className="flex flex-col sm:overflow-clip sm:rounded-lg sm:border sm:border-line">{children}</ul>;
}

export function LinkRow({ href, label, count }: { href: string; label: string; count: ReactNode }) {
  return (
    <li className="border-b border-line last:border-b-0">
      <Link
        href={href}
        prefetch={false}
        className="flex min-h-touch items-center justify-between gap-3 py-2.5 outline-none hover:bg-brand-wash focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus sm:min-h-11 sm:px-4 sm:py-0"
      >
        <span className="text-md font-medium text-ink sm:text-base">{label}</span>
        {count}
      </Link>
    </li>
  );
}

export function Count({ children }: { children: ReactNode }) {
  return <span className="shrink-0 text-base text-ink-3 sm:text-sm">{children}</span>;
}

export const supplierCount = (n: number) => `${n.toLocaleString("en-GB")} ${n === 1 ? "supplier" : "suppliers"}`;
