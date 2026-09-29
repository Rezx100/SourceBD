"use client";

// Mounted once by `AppShell`: closes and places every tray in the app
// (`lib/dashboard/menu-dismiss.ts`). The shell outlives every navigation, so
// one set of document listeners serves every page.

import { useEffect } from "react";
import { installMenuDismiss } from "@/lib/dashboard/menu-dismiss";

export function MenuDismiss() {
  useEffect(() => installMenuDismiss(document), []);
  return null;
}
