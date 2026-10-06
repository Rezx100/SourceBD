// Supplier list row (`03 Patterns · 7`), the two narrow forms. The full-width desktop row is a
// row of the kit's table. `pane`: with the record docked the list keeps name, type and place, the
// first certificate problem and the source count. `phone`: name 16/500, "Factory · Dhaka · 11
// sources", the first certificate problem. A long name wraps; nothing truncates. Server-safe.

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const noun = (n: number) => `${n} ${n === 1 ? "source" : "sources"}`;

export function SupplierRow({
  layout,
  href,
  name,
  type,
  place,
  sources,
  problem,
  selected,
}: {
  layout: "pane" | "phone";
  href: string;
  name: string;
  type: string | null;
  place: string | null;
  sources: number;
  /** A CertProblem, or the plain "No certificates found" line. */
  problem?: ReactNode;
  selected?: boolean;
}) {
  const kind = [type ?? "Type not published", place ?? "place not published"].join(" · ");
  const base = "flex flex-col border-b border-line outline-none last:border-b-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand";
  if (layout === "phone")
    return (
      <Link href={href} aria-current={selected ? "true" : undefined} className={cn(base, "min-h-11 gap-1 px-4 py-3 hover:bg-brand-wash", selected && "bg-brand-tint")}>
        <span className="text-md font-medium text-ink">{name}</span>
        <span className="text-sm text-ink-3">
          {kind} · {noun(sources)}
        </span>
        {problem ? <span className="text-sm">{problem}</span> : null}
      </Link>
    );
  return (
    <Link
      href={href}
      aria-current={selected ? "true" : undefined}
      className={cn(base, "min-h-14 gap-0.5 border-l-2 px-3 py-2.5 hover:bg-brand-wash", selected ? "border-l-brand bg-brand-tint" : "border-l-transparent")}
    >
      <span className="flex justify-between gap-3">
        <span className="text-base font-medium text-ink">{name}</span>
        <span className="shrink-0 text-xs text-ink-3">{noun(sources)}</span>
      </span>
      <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-ink-3">
        <span>{kind}</span>
        {problem ? (
          <>
            <span aria-hidden>·</span>
            {problem}
          </>
        ) : null}
      </span>
    </Link>
  );
}
