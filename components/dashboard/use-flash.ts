"use client";

import { useEffect, useState } from "react";

/** A success message for the kit `Toast`, cleared after four seconds. */
export function useFlash(ms = 4000) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (!text) return;
    const t = setTimeout(() => setText(null), ms);
    return () => clearTimeout(t);
  }, [text, ms]);
  return [text, setText] as const;
}
