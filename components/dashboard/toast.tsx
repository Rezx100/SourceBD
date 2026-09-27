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
    // Two boxes: the outer one is positioned and centred with its own
    // transform; the inner one rises 8px into place (320 ms). One element
    // cannot do both, because the rise keyframe animates `transform` and its
    // `both` fill would leave the centring at `none`.
    <div
      role={announce ? "status" : undefined}
      className={cn("absolute bottom-6 left-1/2 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2", className)}
    >
      <div className="inline-flex max-w-full items-center gap-2.5 rounded-md bg-surface-inverse px-3.5 py-2.5 text-sm font-medium text-ink-inverse shadow-lg animate-rise motion-reduce:animate-none">
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
    </div>
  );
}
