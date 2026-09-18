import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./ds.css";
import { cn } from "@/lib/utils";

// Design-system rebuild (spec ds-rebuild-must-stay.md). One family for the
// whole platform (founder decision 18 Sep 2026); numbers use its tabular
// figures. The Tailwind `font-sans` stack reads `--font-sans`.
const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
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
    <html
      lang="en"
      className={cn(sans.variable, "font-sans")}
    >
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
