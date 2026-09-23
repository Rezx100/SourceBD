"use client";

// The sticky bulk-action bar (REZ-B, handoff §7.5 / spec §3.1 "Selection"):
// "N selected · Send RFQ · Save · Compare · Export". Renders nothing with an
// empty selection.
//
// Send RFQ and Compare are disabled here on purpose: their destinations are
// REZ-D (the multi-supplier RFQ composer) and REZ-C (`/app/compare`), which
// this branch is not building — REZ-B is the results page only (§7). An
// inert button that says why, in the kit's own shape for that
// (`Button`'s `disabled` + `title`), is the honest state until those land —
// not a link to a page that does not exist.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SEND_RFQ_MAX } from "@/lib/dashboard/selection";
import { Button } from "./controls";
import { Icon } from "./icons";
import { useSelection } from "./selection";

const SEND_RFQ_SOON = `Sending an RFQ to more than one supplier at once is not built yet — open a supplier's record to send one, or select ${SEND_RFQ_MAX} or fewer once it ships.`;
const COMPARE_SOON = "Comparing selected suppliers side by side is not built yet.";

export function SelectionBar({ exportHref }: { exportHref: string }) {
  const sel = useSelection();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  if (!sel.interactive || sel.selected.size === 0) return null;
  const ids = [...sel.selected];
  const count = ids.length;

  async function bulkSave() {
    if (busy) return;
    setBusy(true);
    setStatus("");
    try {
      const results = await Promise.allSettled(
        ids.map((id) =>
          fetch("/api/v1/saved", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ supplier_id: id }),
          }),
        ),
      );
      const failed = results.filter((r) => r.status === "rejected" || !r.value.ok).length;
      setStatus(
        failed === 0
          ? `Saved ${count} ${count === 1 ? "supplier" : "suppliers"}`
          : `Saved ${count - failed} of ${count} — try again for the rest`,
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const sep = exportHref.includes("?") ? "&" : "?";
  const bulkExportHref = `${exportHref}${sep}ids=${ids.map(encodeURIComponent).join(",")}`;

  return (
    <div
      role="toolbar"
      aria-label="Bulk actions"
      className="sticky bottom-0 z-20 flex flex-wrap items-center gap-3 border-t border-line-strong bg-surface px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] sm:px-5"
    >
      <span className="text-sm font-medium text-ink-strong">{count} selected</span>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" disabled title={SEND_RFQ_SOON}>
          <Icon name="send" /> Send RFQ
        </Button>
        <Button
          type="button"
          aria-busy={busy || undefined}
          disabled={busy}
          onClick={bulkSave}
          className="disabled:cursor-not-allowed disabled:border-line disabled:text-ink-disabled"
        >
          <Icon name="bookmark" /> Save
        </Button>
        <Button disabled title={COMPARE_SOON} className="disabled:cursor-not-allowed disabled:border-line disabled:text-ink-disabled">
          <Icon name="compare" /> Compare
        </Button>
        <Button href={bulkExportHref}>
          <Icon name="download" /> Export
        </Button>
      </div>
      <span role="status" aria-live="polite" className="text-xs text-ink-subtle">
        {status}
      </span>
      <Button type="button" variant="ghost" className="ml-auto" onClick={sel.clear}>
        Clear
      </Button>
    </div>
  );
}
