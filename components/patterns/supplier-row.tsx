// Supplier list row (`03 Patterns · 7`), the two narrow forms. The full-width desktop row is a
// row of the kit's table. `pane`: with the record docked the list keeps name, type and place, the
// first certificate problem and the source count. `phone`: name 16/500, "Factory · Dhaka · 11
// sources", the first certificate problem. A name is one line (the One-Line Name Rule): the base
// name cut at the end with the whole name in `title`, its qualifier leading the line under. Server-safe.

import Link from "next/link";
import type { ReactNode } from "react";
import { oneLine } from "@/components/kit/classes";
import { nameSecondLine, splitQualifier } from "@/lib/dashboard/facts";
import { cn } from "@/lib/utils";
import { LinkPending } from "./link-pending";

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
  /** The certificates' compact cell, or the dash for none on file. */
  problem?: ReactNode;
  selected?: boolean;
}) {
  const { base, qualifier } = splitQualifier(name);
  const kind = nameSecondLine(name, type ?? "Type not published", place ?? "place not published");
  // The whole name stays in the DOM for a screen reader (the visible base is hidden from it when the two differ);
  // never an aria-label on the row, which would silence its sources and certificate words.
  const spoken = qualifier ? (
    <>
      <span aria-hidden="true">{base}</span>
      <span className="sr-only">{name}</span>
    </>
  ) : (
    base
  );
  const box = "flex flex-col border-b border-line outline-none last:border-b-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus";
  if (layout === "phone")
    return (
      <Link href={href} aria-current={selected ? "true" : undefined} className={cn(box, "min-h-11 gap-1 px-4 py-3 hover:bg-brand-wash", selected && "bg-brand-tint")}>
        <span data-name="" title={name} className={cn(oneLine, "text-md font-medium text-ink")}>
          {spoken}
          <LinkPending className="ml-1.5 inline-block align-[-2px]" />
        </span>
        <span data-name="" className={cn(oneLine, "text-sm text-ink-3")}>
          {kind} · {noun(sources)}
        </span>
        {problem ? <span className="text-sm">{problem}</span> : null}
      </Link>
    );
  return (
    <Link
      href={href}
      aria-current={selected ? "true" : undefined}
      className={cn(box, "min-h-14 gap-0.5 border-l-2 px-3 py-2.5 hover:bg-brand-wash", selected ? "border-l-brand-ink bg-brand-tint" : "border-l-transparent")}
    >
      <span className="flex justify-between gap-3">
        <span data-name="" title={name} className={cn(oneLine, "text-base font-medium text-ink")}>
          {spoken}
          <LinkPending className="ml-1.5 inline-block align-[-2px]" />
        </span>
        <span className="shrink-0 text-xs text-ink-3">{noun(sources)}</span>
      </span>
      <span className="flex items-center gap-x-1.5 text-xs text-ink-3">
        <span data-name="" title={kind} className={oneLine}>{kind}</span>
        {problem ? (
          <>
            <span aria-hidden>·</span>
            <span className="shrink-0">{problem}</span>
          </>
        ) : null}
      </span>
    </Link>
  );
}
