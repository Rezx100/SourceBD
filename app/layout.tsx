import type { Metadata, Viewport } from "next";
import { Archivo, Hanken_Grotesk, IBM_Plex_Mono, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

// Unified platform typography (decision 2026-06-18). The app surfaces now
// share the marketing stack so the whole platform reads as one company:
// Archivo (display) + Hanken Grotesk (body) + IBM Plex Mono (mono). This
// supersedes the M6a split — `--font-*` and `--mkt-font-*` now resolve to
// the same families.
const display = Archivo({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["500", "600", "700", "800", "900"],
});

const body = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "SourceBD",
  description: "Verified Bangladesh RMG supplier intelligence.",
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
    <html lang="en" className={cn(display.variable, body.variable, mono.variable, "font-sans", geist.variable)}>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
