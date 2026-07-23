"use client";

// Document-level error boundary. Fires only when the root layout itself
// throws (font loader, html shell). Must render its own <html>/<body>
// because the root layout is unavailable at this point. Tailwind tokens
// come from `globals.css` which is already linked by the root layout's
// bundle, so utility classes still work.

import Link from "next/link";
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from "next/font/google";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "600"],
});

const body = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
  weight: ["400", "600"],
});

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="bg-bg-l0 text-ink-primary">
        <main className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-16">
          <div className="w-full rounded-card border border-hairline bg-surface-l1 p-6 shadow-l1">
            <p className="text-[12px] text-ink-tertiary">
              {error.digest ?? "500"}
            </p>
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tightish">
              Service unavailable
            </h1>
            <p className="mt-3 text-ink-secondary">
              SourceBD couldn&rsquo;t load. Please refresh in a moment.
            </p>
            <Link
              href="/"
              className="mt-5 inline-flex items-center rounded-pill border border-accent-indigo bg-accent-indigo px-3.5 py-1.5 text-[14px] font-semibold text-ink-on-accent"
            >
              Reload home
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
