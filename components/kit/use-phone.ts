"use client";

// True under 768, the width where the kit's overlays become bottom sheets (a dialog on a desktop,
// a sheet on a phone). The server draws the desktop form; this answers once the page is live.

import { useSyncExternalStore } from "react";

const PHONE = "(max-width: 767px)";
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(PHONE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

export const useIsPhone = (): boolean => useSyncExternalStore(subscribe, () => window.matchMedia(PHONE).matches, () => false);
