"use client";

// "Product saved" (Open): the form sends the buyer back to the list with `?saved=<id>`, and this says
// so for five seconds. Client: the timer.

import Link from "next/link";
import { useEffect, useState } from "react";
import { Toast } from "@/components/kit";
import { toastActionClass } from "@/components/kit/classes";
import { openHref, savedWords } from "./words";

export function SavedNote({ id }: { id: string }) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setOn(false), 5000);
    return () => clearTimeout(t);
  }, []);
  if (!on) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-toast flex justify-center px-4 max-md:bottom-[calc(theme(spacing.tabbar)+1rem+env(safe-area-inset-bottom))]">
      <Toast
        tone="brand"
        action={
          <Link href={openHref(id)} prefetch={false} className={toastActionClass}>
            Open
          </Link>
        }
        className="pointer-events-auto"
      >
        {savedWords}
      </Toast>
    </div>
  );
}
