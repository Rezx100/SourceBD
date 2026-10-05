import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./ds.css";
import { cn } from "@/lib/utils";

// SourceBD v4 type (Paper, D-2): IBM Plex Sans for everything, Plex Mono only
// for certificate, register and HS numbers. Paper draws weights 400, 500 and
// 600. The files are committed in `app/fonts` (SIL Open Font License 1.1, latin
// subset) and loaded with next/font/local: the build never calls Google, and a
// visitor's browser never calls a font CDN. The Tailwind `font-sans` and
// `font-mono` stacks read the two CSS variables set here.
const sans = localFont({
  src: [{ path: "./fonts/ibm-plex-sans.woff2", weight: "400 600", style: "normal" }],
  variable: "--font-sans",
  display: "swap",
});

const mono = localFont({
  src: [
    { path: "./fonts/ibm-plex-mono-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-mono-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/ibm-plex-mono-600.woff2", weight: "600", style: "normal" },
  ],
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
