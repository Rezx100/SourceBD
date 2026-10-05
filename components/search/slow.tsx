"use client";

// After two seconds a loading head reads "Loading suppliers…" (Paper `Results, loading`): a
// quick search never flashes words, a slow one says it is working.

import { useEffect, useState, type ReactNode } from "react";

export function SlowHead({ children, slow = "Loading suppliers…" }: { children?: ReactNode; slow?: string }) {
  const [late, setLate] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLate(true), 2000);
    return () => clearTimeout(t);
  }, []);
  return <span className="text-base font-semibold text-ink">{late ? slow : children}</span>;
}
