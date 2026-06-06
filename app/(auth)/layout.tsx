// Spec M6b — Auth route-group layout.
//
// Wraps every (auth) page in the marketing typography stack +
// `data-surface="marketing"` so the M6a token block applies. Drops
// the previous centred Card shell. Each individual page renders the
// split-pane `AuthShell` itself so it can set its own brand-panel
// copy.
//
// Fonts loaded per-layout via next/font/google (Next splits font
// delivery by layout so this does not affect /app, /supplier, /admin).
// H2 `auth` rate limit (10/min IP-bucketed) is enforced upstream by
// `middleware.ts` — nothing to change here.

import type { ReactNode } from "react";
import { Archivo, Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";

const mktDisplay = Archivo({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  variable: "--mkt-font-display",
  display: "swap",
});
const mktBody = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--mkt-font-body",
  display: "swap",
});
const mktMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
