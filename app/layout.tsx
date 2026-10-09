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
