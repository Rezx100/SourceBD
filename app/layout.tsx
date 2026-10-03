import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./ds.css";
import { cn } from "@/lib/utils";

// SourceBD v4 type (Paper, D-2): IBM Plex Sans for everything, Plex Mono only
// for certificate, register and HS numbers. Paper draws weights 400, 500 and
// 600. next/font fetches them at build time and serves them from this site, so
// a visitor's browser never calls a font CDN. The Tailwind `font-sans` and
// `font-mono` stacks read the two CSS variables set here.
const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
