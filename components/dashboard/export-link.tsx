"use client";

// Export as a download that never leaves the page. A plain same-tab link to
// the CSV route replaced the Discover page with a bare JSON document on any
// refusal — the 6-per-minute limit (429), a stale selection (409), a bad
// request (400) — and the buyer's selection with it. This fetches the file,
// saves it under the server's own filename, and says what went wrong in a
// live region beside the button. The `href` stays, so a middle-click or a
// browser without script still gets the file.

import { useId, useState, type MouseEvent } from "react";
import { exportMessage } from "@/lib/dashboard/selection";
import { Icon } from "./icons";
import { Button } from "./controls";

export function ExportLink({ href, label, requested }: { href: string; label: string; requested?: number }) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const statusId = useId();

  async function run(e: MouseEvent<HTMLElement>) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setStatus("");
    try {
      const res = await fetch(href);
      if (!res.ok) {
        setStatus(exportMessage(res.status, {}));
        return;
      }
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "sourcebd-suppliers.csv";
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus(exportMessage(200, { rows: Number(res.headers.get("X-SourceBD-Rows") ?? NaN), requested }));
    } catch {
      setStatus(exportMessage("network", {}));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button href={href} onClick={run} aria-busy={busy || undefined} aria-describedby={status ? statusId : undefined}>
        <Icon name="download" /> {label}
      </Button>
      <span id={statusId} role="status" aria-live="polite" className="text-xs text-ink-subtle">
        {status}
      </span>
    </>
  );
}
