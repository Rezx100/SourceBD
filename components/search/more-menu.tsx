"use client";

// The ⋯ menu on the results bar (Paper `10 · Results table`): what the whole search can
// do. Download CSV fetches the file under the server's own name and says how it ended in a
// toast, so a refusal (the limit, a bad request) never replaces the page and the search
// with a bare error document. The rules and words are `lib/dashboard/selection.ts`.

import { DotsThree } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { IconButton, Menu, MenuItem, Toast } from "@/components/kit";
import { runExport, saveBlob } from "@/lib/dashboard/selection";

export function MoreMenu({ exportHref, total, saveHref }: { exportHref: string; total: number | null; /** Save search lives here too: under 1280 the bar folds its button away, and beside a pane the bar is icons. */ saveHref?: string }) {
  const [said, setSaid] = useState("");
  const running = useRef(false);
  useEffect(() => {
    if (!said || said.startsWith("Preparing")) return;
    const t = setTimeout(() => setSaid(""), 5000);
    return () => clearTimeout(t);
  }, [said]);

  async function download() {
    if (running.current) return setSaid("Still preparing the download.");
    running.current = true;
    setSaid("Preparing the download…");
    const message = await runExport(exportHref, undefined, {
      fetch: (url) => fetch(url),
      save: (blob, filename) => saveBlob(document, URL, (fn) => setTimeout(fn, 1000), blob, filename),
    });
    running.current = false;
    setSaid(message);
  }

  return (
    <>
      <Menu align="end" trigger={<IconButton icon={DotsThree} label="More actions" />}>
        {saveHref ? <MenuItem href={saveHref}>Save search</MenuItem> : null}
        <MenuItem onSelect={download} disabled={total === 0} hint={total === 0 ? "Nothing to download" : undefined}>
          Download CSV
        </MenuItem>
      </Menu>
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
