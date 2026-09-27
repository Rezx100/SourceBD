"use client";

import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { startTransition, useContext, useEffect, useId, useState } from "react";
import { Button } from "@/components/dashboard/controls";
import { Icon } from "@/components/dashboard/icons";
import { Toast } from "@/components/dashboard/toast";
import { onBulkSaved, rowSaveMessage } from "@/lib/dashboard/selection";

/**
 * Save / unsave a supplier from a results row.
 *
 * Three things this control must not do, each of which it used to:
 *
 * 1. **Disable itself while it is focused.** The browser blurs a control the
 *    moment it becomes disabled, so focus fell to `<body>` and did not come
 *    back — a keyboard user saving the fourteenth row of a table was returned
 *    to the top of the document. `aria-busy` says "working" without taking the
 *    control away; the in-flight guard is a ref-free boolean check instead.
 * 2. **Change state silently.** The label flips Save → Saved, but focus had
 *    already left, so nothing was announced. A live region reports the outcome.
 * 3. **Leave the control dead after a network error.** There was no
 *    `try`/`catch`, so a rejected fetch skipped the reset and the button stayed
 *    disabled and silent for the rest of the page's life.
 */
export function SaveRecordButton({
  supplierId,
  saved,
  icon = false,
}: {
  supplierId: string;
  saved: boolean;
  icon?: boolean;
}) {
  const [on, setOn] = useState(saved);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string>("");
  // The visible confirmation. The live region below told a screen reader and
  // nobody else: sighted buyers saw the button blink and could not tell the
  // save had landed.
  const [toast, setToast] = useState<string>("");
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  const statusId = useId();
  // Not `useRouter()`, which throws outside a mounted app router (the render
  // tests draw this with no router at all).
  const router = useContext(AppRouterContext);
  const label = on ? "Saved" : "Save";

  // `useState(saved)` reads its initial value once. The bar's bulk Save
  // refreshes the page, which re-renders this with a new `saved` prop but does
  // not remount it — so follow the prop when it changes…
  useEffect(() => {
    setOn(saved);
  }, [saved]);
  // …and hear the bulk save directly, because the prop does not always
  // change: a row that loaded saved, was unsaved here, then bulk-saved comes
  // back from the refresh with the same `saved={true}`, the effect above
  // never runs, and this kept reading "Save" over a saved supplier.
  useEffect(() => onBulkSaved(window, supplierId, () => setOn(true)), [supplierId]);

  return (
    <>
      <Button
        type="button"
        icon={icon}
        aria-busy={pending || undefined}
        aria-label={label}
        aria-describedby={status ? statusId : undefined}
        className={icon ? "h-7 w-7" : undefined}
        onClick={async () => {
          if (pending) return;
          setPending(true);
          setStatus("");
          try {
            const res = on
              ? await fetch(`/api/v1/saved?supplier_id=${encodeURIComponent(supplierId)}`, { method: "DELETE" })
              : await fetch("/api/v1/saved", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ supplier_id: supplierId }),
                });
            if (res.ok) {
              setOn(!on);
              // The client keeps visited pages for 30s (`staleTimes` in
              // next.config.ts), so the results behind the record and the
              // sidebar's Saved count would otherwise read the old state when
              // the buyer closes the record. Refreshed in the background.
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
        }}
      >
        <Icon name="bookmark" /> {icon ? null : label}
      </Button>
      <span id={statusId} role="status" aria-live="polite" className="sr-only">
        {status}
      </span>
      {/* Not a second live region: the one above already announces it. */}
      {toast ? (
        <Toast
          text={toast}
          href={null}
          announce={false}
          className="fixed z-[60]"
          link={toast === "Saved to your list" ? { href: "/app/saved", label: "View saved" } : null}
        />
      ) : null}
    </>
  );
}
