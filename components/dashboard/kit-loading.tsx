// The loading state of a buyer route. The layout draws the shell once and
// keeps it across navigations, so a route's `loading.tsx` owes only the
// content region: the page frame, with the skeleton inside it. It does not
// know its route and does not need to — the rail reads the URL itself.

import type { ReactNode } from "react";

import { Page } from "./page";

export function KitLoading({ children }: { children: ReactNode }) {
  return <Page>{children}</Page>;
}
