// Locked contact (`03 Patterns · 6`): what is on file, as counts with their nouns, and the way
// to unlock it (send an RFQ; the supplier replies in the thread). The component is given counts
// and never a value: contact details are gated on the server, so nothing here could show one.
// Server-safe.

import { LockSimple } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** "Email 1 on file · Phone 4 on file"; only the kinds that exist are named. */
export function onFileWords(emails: number, phones: number): string | null {
  const parts = [emails > 0 ? `Email ${emails} on file` : null, phones > 0 ? `Phone ${phones} on file` : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/** The details-panel block (344). `action` is the Send RFQ button; nothing on file has no action and no lock. */
export function LockedContact({ emails, phones, action, className }: { emails: number; phones: number; action?: ReactNode; className?: string }) {
  const words = onFileWords(emails, phones);
  return (
    <section aria-label="Contact" className={cn("flex w-full max-w-details flex-col gap-3 rounded-lg border border-line p-4", className)}>
      <header className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-ink">Contact</h3>
        {words ? <LockSimple size={16} className="shrink-0 text-ink-3" aria-hidden /> : null}
      </header>
      {words ? (
        <>
          <p className="text-base font-medium text-ink">{words}</p>
          <p className="text-sm text-ink-2">Contact details are locked. Send an RFQ and the supplier replies here.</p>
          {action ? <div className="self-start">{action}</div> : null}
        </>
      ) : (
        <p className="text-base font-medium text-ink-2">No email or phone on file</p>
      )}
    </section>
  );
}

/** The phone's single row above the sticky action bar. */
export function LockedContactRow({ emails, phones }: { emails: number; phones: number }) {
  const words = onFileWords(emails, phones);
  if (!words) return null;
  return (
    <div className="flex min-h-14 items-center gap-3 px-4 py-2">
      <LockSimple size={20} className="shrink-0 text-ink-3" aria-hidden />
      <div className="flex flex-col">
        <p className="text-md font-medium text-ink">{words}</p>
        <p className="text-sm text-ink-3">Locked. The supplier replies to your RFQ.</p>
      </div>
    </div>
  );
}
