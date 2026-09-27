// The loading state of a buyer route. The layout draws the shell once and
// keeps it across navigations, so a route's `loading.tsx` owes only the
// content region: the page frame, with the skeleton inside it. `path` and
// `screenLabel` are accepted for the callers that still pass them and mean
// nothing here — the rail reads the URL itself.

import type { ReactNode } from "react";

import { Page } from "./page";

export function KitLoading({ children }: { path?: string; screenLabel?: string; children: ReactNode }) {
  return <Page>{children}</Page>;
}
