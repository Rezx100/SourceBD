"use client";

// Download CSV on Saved, Compliance and Certificate expiry (gap row 16). Fetches the file from
// `/api/v1/export` under the server's own name and says how it ended in a toast, so a refusal
// (signed out, a read that failed) never replaces the page with a bare error document. The rules
// and words are `lib/dashboard/selection.ts`, the same as the search's Download CSV.

import { DownloadSimple } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { Button, Toast } from "@/components/kit";
import { runExport, saveBlob } from "@/lib/dashboard/selection";

export function DownloadCsv({ href, className }: { href: string; className?: string }) {
  const [said, setSaid] = useState("");
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  useEffect(() => {
    if (!said || busy) return;
    const t = setTimeout(() => setSaid(""), 5000);
    return () => clearTimeout(t);
  }, [said, busy]);

  async function download() {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setSaid("Preparing the download…");
    const message = await runExport(href, undefined, {
      fetch: (url) => fetch(url),
      save: (blob, filename) => saveBlob(document, URL, (fn) => setTimeout(fn, 1000), blob, filename),
    });
    running.current = false;
    setBusy(false);
    setSaid(message);
  }

  return (
    <>
      <Button icon={DownloadSimple} loading={busy} loadingLabel="Preparing" onClick={download} className={className}>
        Download CSV
      </Button>
      <span role="status" aria-live="polite" className="sr-only">
        {said}
      </span>
      {said ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-toast flex justify-center px-4 max-md:bottom-[calc(theme(spacing.tabbar)_+_1.5rem)]">
          <Toast className="pointer-events-auto">{said}</Toast>
        </div>
      ) : null}
    </>
  );
}
