"use client";

// Export as a download that never leaves the page. A plain same-tab link to
// the CSV route replaced the Discover page with a bare JSON document on any
// refusal — the 6-per-minute limit (429), a stale selection (409), a bad
// request (400) — and the buyer's selection with it. This fetches the file,
// saves it under the server's own filename, and says what went wrong in a
// live region beside the button. The `href` stays, so a middle-click or a
// browser without script still gets the file.

import { useId, useState, type MouseEvent } from "react";
import { interceptPlainClick, runExport, saveBlob } from "@/lib/dashboard/selection";
import { Icon } from "./icons";
import { Button } from "./controls";

export function ExportLink({ href, label, requested }: { href: string; label: string; requested?: number }) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const statusId = useId();

  async function run(e: MouseEvent<HTMLElement>) {
    if (!interceptPlainClick(e) || busy) return;
    setBusy(true);
    setStatus("Preparing the export…");
    try {
      setStatus(
        await runExport(href, requested, {
          fetch: (url) => fetch(url),
          save: (blob, filename) => saveBlob(document, URL, (fn) => setTimeout(fn, 1000), blob, filename),
        }),
      );
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
