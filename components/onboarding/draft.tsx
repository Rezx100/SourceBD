"use client";

// What the person has typed so far on a step, shared with the panel beside the form (Paper draws the
// panel changing as they answer: "Saved to Settings", "Your search so far"). The page wraps the whole
// split page in this provider; the form writes, the panel reads. Nothing here is saved.

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type Draft = Record<string, unknown>;
type Ctx = { draft: Draft; set: (patch: Draft) => void };
const DraftContext = createContext<Ctx | null>(null);

export function DraftProvider({ initial, children }: { initial: Draft; children: ReactNode }) {
  const [draft, setDraft] = useState<Draft>(initial);
  const value = useMemo<Ctx>(() => ({ draft, set: (patch) => setDraft((d) => ({ ...d, ...patch })) }), [draft]);
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useDraft(): Ctx {
  return useContext(DraftContext) ?? { draft: {}, set: () => {} };
}
