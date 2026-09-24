"use client";

// Export as a download that never leaves the page. A plain same-tab link to
// the CSV route replaced the Discover page with a bare JSON document on any
// refusal — the 6-per-minute limit (429), a stale selection (409), a bad
// request (400) — and the buyer's selection with it. This fetches the file,
// saves it under the server's own filename, and says what went wrong in a
// live region beside the button. The `href` stays, so a middle-click or a
// browser without script still gets the file.
//
// One export at a time, and it always finishes and says how it ended. A
// selection change while it runs does not cancel it: the file is the one the
// buyer asked for (the server names it "-selected-N"), and the message says it
// was for the earlier selection. Cancelling instead left a buyer who had heard
// "Preparing the export…" waiting for a file that never came, and every way of
// saying so (a second edit, Clear, a newer export) found another silence.

import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import { interceptPlainClick, runExport, saveBlob } from "@/lib/dashboard/selection";
import { Icon } from "./icons";
import { Button } from "./controls";

export const EARLIER = "For your earlier selection: ";
export const STILL_EXPORTING = "Still preparing the export. Its result will show here.";

export function ExportLink({
  href,
  label,
  requested,
  resetOn,
  onStatus,
}: {
  href: string;
  label: string;
  requested?: number;
  /** Changes when the thing being exported changes (the bar passes the
   * buyer's selection edits). An idle message is cleared; a running export
   * finishes and says it was for the earlier selection. Not a `key`:
   * remounting moved focus off the link. */
  resetOn?: number;
  /** Every status this link shows, so a parent can keep it on screen. */
  onStatus?: (status: string) => void;
}) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const statusId = useId();
  // The selection as it is now; compared with the one an export began on.
  const current = useRef(resetOn);
  const running = useRef(false);
  // False once the page has gone (a navigation): the file is not saved onto
  // whatever the buyer is looking at by then.
  const mounted = useRef(true);
  const say = (s: string) => {
    setStatus(s);
    onStatus?.(s);
  };

  useEffect(() => {
    current.current = resetOn;
    if (!running.current) say("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetOn]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function run(e: MouseEvent<HTMLElement>) {
    if (!interceptPlainClick(e)) return;
    if (running.current) {
      say(STILL_EXPORTING);
      return;
    }
    running.current = true;
    setBusy(true);
    say("Preparing the export…");
    const scope = current.current;
    try {
      const message = await runExport(href, requested, {
        fetch: (url) => fetch(url),
        save: (blob, filename) => {
          if (mounted.current) saveBlob(document, URL, (fn) => setTimeout(fn, 1000), blob, filename);
        },
      });
      say(current.current === scope ? message : `${EARLIER}${message}`);
    } finally {
      running.current = false;
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
