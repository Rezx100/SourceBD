"use client";

// Export as a download that never leaves the page. A plain same-tab link to
// the CSV route replaced the Discover page with a bare JSON document on any
// refusal — the 6-per-minute limit (429), a stale selection (409), a bad
// request (400) — and the buyer's selection with it. This fetches the file,
// saves it under the server's own filename, and says what went wrong in a
// live region beside the button. The `href` stays, so a middle-click or a
// browser without script still gets the file.

import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import { interceptPlainClick, runExport, saveBlob } from "@/lib/dashboard/selection";
import { Icon } from "./icons";
import { Button } from "./controls";

export function ExportLink({
  href,
  label,
  requested,
  resetOn,
}: {
  href: string;
  label: string;
  requested?: number;
  /** Changes when the thing being exported changes (the bar passes the
   * buyer's selection edits): the old message is cleared, and a result still
   * in flight is neither saved nor reported. Not a `key` — remounting moved focus off the link
   * and let a second export start under the first. */
  resetOn?: number;
}) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const statusId = useId();
  const round = useRef(0);
  useEffect(() => {
    round.current += 1;
    setStatus("");
    // Free the button for the new selection: a click while the old export
    // was still in flight returned silently, so the buyer clicked and got
    // nothing. The old export carries on, but is neither saved nor reported.
    setBusy(false);
  }, [resetOn]);

  async function run(e: MouseEvent<HTMLElement>) {
    if (!interceptPlainClick(e) || busy) return;
    setBusy(true);
    setStatus("Preparing the export…");
    const asked = round.current;
    try {
      const message = await runExport(href, requested, {
        fetch: (url) => fetch(url),
        // A file for a selection the buyer has since changed is not saved:
        // it would arrive as the new selection's export, and silently.
        save: (blob, filename) => {
          if (round.current === asked) saveBlob(document, URL, (fn) => setTimeout(fn, 1000), blob, filename);
        },
      });
      if (round.current === asked) setStatus(message);
    } finally {
      // After a reset the button already belongs to the next export.
      if (round.current === asked) setBusy(false);
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
