"use client";

// The coach mark's card: dark, 320 wide, bottom right of the results (over the tab bar's top on a phone).
// "Got it" says so to the server and takes `?welcome=1` out of the address. Escape does the same.

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/kit";
import { dismissCoach } from "./actions";

export function CoachCard({ closeHref }: { closeHref: string }) {
  const router = useRouter();
  const [gone, setGone] = useState(false);
  const close = () => {
    setGone(true);
    void dismissCoach().catch(() => {});
    router.replace(closeHref, { scroll: false });
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `close` only reads the router and the href.
  }, []);
  if (gone) return null;
  return (
    <div
      role="note"
      aria-label="Where facts come from"
      className="fixed bottom-[calc(theme(spacing.tabbar)_+_theme(spacing.4))] right-4 z-toast flex w-[calc(100vw-2rem)] max-w-80 flex-col gap-3 rounded-lg bg-ink p-4 shadow-dialog md:bottom-6 md:right-6"
    >
      <p className="text-md font-medium text-surface">Every fact shows where it came from.</p>
      <p className="text-sm text-line">Open a supplier to see each source, with the date we checked it.</p>
      <div className="flex justify-end">
        <Button kind="secondary" size="md" className="border-0 bg-surface text-ink hover:bg-subtle max-md:h-11" onClick={close}>
          Got it
        </Button>
      </div>
    </div>
  );
}
