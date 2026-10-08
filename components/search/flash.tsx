// A confirmation after the buyer's own action ("RFQ sent", "Search saved"): the kit's brand
// toast at the bottom centre, with the one link that follows. Server component: it is in the
// page while the address carries `?sent=` or `?saved=1`, so it is there for a screen reader
// on arrival and gone on the next navigation.

import Link from "next/link";
import { Toast, toastActionClass } from "@/components/kit";

export function Flash({ text, link }: { text: string; link?: { href: string; label: string } }) {
  return (
    // A polite live region, first in the list region, so its arrival is announced (round 3, item 6).
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-toast flex justify-center px-4 max-md:bottom-[calc(theme(spacing.tabbar)_+_1.5rem)]">
      <Toast tone="brand" className="pointer-events-auto" action={link ? <Link href={link.href} prefetch={false} className={toastActionClass}>{link.label}</Link> : undefined}>
        {text}
      </Toast>
    </div>
  );
}
