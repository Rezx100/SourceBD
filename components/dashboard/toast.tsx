// The kit's toast, in its own module so a client control (the row Save) can
// show one without pulling the RFQ list and the results table into its bundle.

import Link from "next/link";
import { cn } from "@/lib/utils";

/** `.toast`: `surface-inverse` with the signal dot. */
export function Toast({
  text,
  href,
  className,
  link = null,
  announce = true,
}: {
  text: string;
  href: string | null;
  className?: string;
  /** A named link in place of the plain "Open". */
  link?: { href: string; label: string } | null;
  /** False when the caller already has a live region saying the same thing. */
  announce?: boolean;
}) {
  return (
    <div
      role={announce ? "status" : undefined}
      className={cn(
        "absolute bottom-6 left-1/2 inline-flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2.5 rounded-md bg-surface-inverse px-3.5 py-2.5 text-sm font-medium text-ink-inverse shadow-lg",
        className,
      )}
    >
      <i aria-hidden className="inline-block size-2 rounded-full bg-signal shadow-bloom" />
      {text}
      {link ? (
        <Link href={link.href} prefetch={false} className="text-brand-ink-inverse underline-offset-2 hover:underline">
          {link.label}
        </Link>
      ) : href ? (
        <a href={href} className="text-brand-ink-inverse">
          Open
        </a>
      ) : null}
    </div>
  );
}
