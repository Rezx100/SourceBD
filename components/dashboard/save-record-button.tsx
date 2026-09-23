"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/components/dashboard/controls";
import { Icon } from "@/components/dashboard/icons";

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
  const statusId = useId();
  const label = on ? "Saved" : "Save";

  // `useState(saved)` only reads its initial value once. The bulk-save
  // button in the selection bar saves N suppliers and calls
  // `router.refresh()`, which re-renders this component with a new `saved`
  // prop but does not remount it — without this, a card just bulk-saved from
  // the bar keeps showing "Save" until a full page reload.
  useEffect(() => {
    setOn(saved);
  }, [saved]);

  return (
    <>
      <Button
        type="button"
        icon={icon}
        aria-busy={pending || undefined}
        aria-pressed={on}
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
              const next = !on;
              setOn(next);
              setStatus(next ? "Saved" : "Removed from saved");
            } else if (res.status === 401) {
              setStatus("Sign in to save a record.");
            } else {
              setStatus("Could not save that. Try again.");
            }
          } catch {
            setStatus("Could not save that — no connection. Try again.");
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
    </>
  );
}
