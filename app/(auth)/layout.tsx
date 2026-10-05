// Spec M6b — Auth route-group layout.
//
// Wraps every (auth) page in the marketing typography stack +
// `data-surface="marketing"` so the M6a token block applies. Drops
// the previous centred Card shell. Each individual page renders the
// split-pane `AuthShell` itself so it can set its own brand-panel
// copy.
//
// Fonts loaded per-layout via next/font/local, files in `app/fonts` (Next splits font
// delivery by layout so this does not affect /app, /supplier, /admin).
// H2 `auth` rate limit (10/min IP-bucketed) is enforced upstream by
// `middleware.ts` — nothing to change here.

import type { ReactNode } from "react";
import localFont from "next/font/local";

const mktDisplay = localFont({
  src: [{ path: "../fonts/archivo.woff2", weight: "500 900", style: "normal" }],
  variable: "--mkt-font-display",
  display: "swap",
});
const mktBody = localFont({
  src: [{ path: "../fonts/hanken-grotesk.woff2", weight: "400 700", style: "normal" }],
  variable: "--mkt-font-body",
  display: "swap",
});
const mktMono = localFont({
  src: [
    { path: "../fonts/ibm-plex-mono-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/ibm-plex-mono-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/ibm-plex-mono-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--mkt-font-mono",
  display: "swap",
});

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-surface="marketing"
      className={`${mktDisplay.variable} ${mktBody.variable} ${mktMono.variable}`}
    >
      {children}
    </div>
  );
}
