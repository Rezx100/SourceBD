import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./ds.css";
import { cn } from "@/lib/utils";

// Type, site-wide (founder, 9 Oct 2026, replacing Paper's IBM Plex): Geist for
// everything a person reads, Geist Mono only for what a register filed (a
// certificate, register or HS number, a date beside it) and for short labels.
// A caption that is a sentence is sans. Both are self-hosted variable files in
// `app/fonts` (SIL Open Font License 1.1) loaded with next/font/local: the build
// never calls Google, and a visitor's browser never calls a font CDN. The
// Tailwind `font-sans` and `font-mono` stacks read the two CSS variables set here.
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
  // The brand kit's (25 Oct 2026): the 32 tile with five teeth for a browser tab, the app tile for anything larger.
  icons: {
    icon: [
      { url: "/icons/brand/sourcebd-favicon.svg", type: "image/svg+xml" },
      { url: "/icons/brand/sourcebd-favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/brand/sourcebd-favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/brand/sourcebd-tile-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/brand/sourcebd-tile-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/icons/brand/sourcebd-favicon-32.png",
    apple: { url: "/icons/brand/sourcebd-apple-touch-180.png", sizes: "180x180", type: "image/png" },
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
