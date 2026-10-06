"use client";

// Save and unsave a supplier from its record (Paper: "Save" beside Send RFQ on a desktop, the
// 44-wide bookmark beside it on a phone). The behaviour is the results row's: one request per
// press, a status for a screen reader and a toast for everyone, and never a disabled control
// (the browser would drop focus from it). The bulk bar's Save is heard, so the label follows it.

import { BookmarkSimple } from "@phosphor-icons/react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import Link from "next/link";
import { startTransition, useContext, useEffect, useId, useState } from "react";
import { Toast, buttonClass, toastActionClass } from "@/components/kit";
import { onBulkSaved, rowSaveMessage } from "@/lib/dashboard/selection";
import { cn } from "@/lib/utils";

export function RecordSave({ supplierId, saved, appearance = "button", className }: { supplierId: string; saved: boolean; appearance?: "button" | "icon"; className?: string }) {
  const [on, setOn] = useState(saved);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const [toast, setToast] = useState("");
  const statusId = useId();
  // Not `useRouter()`, which throws outside a mounted app router (the render tests draw this with none).
  const router = useContext(AppRouterContext);
  const label = on ? "Saved" : "Save";

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  // The prop follows a refresh, and a bulk Save elsewhere on the page is heard directly.
  useEffect(() => setOn(saved), [saved]);
  useEffect(() => onBulkSaved(window, supplierId, () => setOn(true)), [supplierId]);

  async function press() {
    if (pending) return;
    setPending(true);
    setStatus("");
    try {
      const res = on
        ? await fetch(`/api/v1/saved?supplier_id=${encodeURIComponent(supplierId)}`, { method: "DELETE" })
        : await fetch("/api/v1/saved", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ supplier_id: supplierId }) });
      if (res.ok) {
        setOn(!on);
        // The client keeps visited pages for 30 s, so the results behind the record and the sidebar's count refresh in the background.
        startTransition(() => router?.refresh());
      }
      const message = rowSaveMessage(res.ok ? 200 : res.status, !on);
      setStatus(message);
      setToast(res.ok && !on ? "Saved to your list" : message);
    } catch {
      setStatus(rowSaveMessage("network", !on));
      setToast(rowSaveMessage("network", !on));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        data-save={supplierId}
        aria-pressed={on}
        aria-busy={pending || undefined}
        aria-label={appearance === "icon" ? label : undefined}
        aria-describedby={status ? statusId : undefined}
        title={appearance === "icon" ? (on ? "Saved · press to remove" : "Save") : undefined}
        onClick={press}
        className={cn(appearance === "icon" ? buttonClass({ kind: "secondary", size: "icon-48" }) : buttonClass({ kind: "secondary", className: "pl-2.5 pr-3" }), on && "border-ink-3 bg-subtle", className)}
      >
        <BookmarkSimple size={appearance === "icon" ? 24 : 16} weight={on ? "fill" : "regular"} className="shrink-0" aria-hidden />
        {appearance === "icon" ? null : label}
      </button>
      <span id={statusId} role="status" aria-live="polite" className="sr-only">
        {status}
      </span>
      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-toast flex justify-center px-4 max-md:bottom-[calc(theme(spacing.action-bar)_+_1.5rem)]">
          <Toast
            tone="brand"
            className="pointer-events-auto"
            action={
              toast === "Saved to your list" ? (
                <Link href="/app/saved" prefetch={false} className={toastActionClass}>
                  View saved
                </Link>
              ) : undefined
            }
          >
            {toast}
          </Toast>
        </div>
      ) : null}
    </>
  );
}
