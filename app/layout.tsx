import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./ds.css";
import { cn } from "@/lib/utils";

// Design-system rebuild (spec ds-rebuild-must-stay.md), artifact v3 type:
// Geist for everything, Geist Mono for the ledger's stamps (eyebrows, source
// marks, register and certificate numbers, HS codes). Both are self-hosted
// variable fonts (OFL) from the Design System artifact's `project/fonts/`, so
// a build never reaches out to a font CDN. The Tailwind `font-sans` and
// `font-mono` stacks read the two CSS variables set here.
const sans = localFont({
  src: "./fonts/Geist-Variable.woff2",
  weight: "100 900",
  variable: "--font-sans",
  display: "swap",
});

const mono = localFont({
  src: "./fonts/GeistMono-Variable.woff2",
  weight: "100 900",
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SourceBD",
  description: "Verified Bangladesh RMG supplier intelligence.",
  icons: {
    icon: "/icons/brand/sourcebd-logo.png",
    shortcut: "/icons/brand/sourcebd-logo.png",
    apple: "/icons/brand/sourcebd-logo.png",
  },
};

// Spec P1: explicit mobile viewport. Without this, mobile Safari renders
// the site at desktop width and the entire responsive contract is moot.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn(sans.variable, mono.variable, "font-sans")}>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
