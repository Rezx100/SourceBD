"use client";

// "Check a source" on the getting-started card: the first time the buyer follows a link out of a supplier
// record (a source's own page, a certificate's document), the server is told once. Nothing is read from the
// link; only that one was followed. It sits inside the record, so it never listens anywhere else.

import { useEffect } from "react";
import { markSourceChecked } from "./actions";

export function SourceCheckListener() {
  useEffect(() => {
    let sent = false;
    const onClick = (e: MouseEvent) => {
      if (sent) return;
      const a = (e.target as Element | null)?.closest?.("a[href]");
      const href = a?.getAttribute("href") ?? "";
      if (!/^https?:\/\//i.test(href)) return;
      try {
        if (new URL(href).origin === window.location.origin) return;
      } catch {
        return;
      }
      sent = true;
      void markSourceChecked().catch(() => {});
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
