"use client";

// Document-level error boundary. Fires only when the root layout itself throws (the font loader, the
// html shell). It must draw its own <html> and <body>; the root layout's fonts are not there, so it
// uses the system face, and the tokens come from the stylesheet the root layout's bundle already links.

import Link from "next/link";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="en">
      <body className="bg-surface text-ink antialiased">
        <main className="mx-auto flex min-h-screen max-w-prose flex-col justify-center gap-5 px-4 pb-14 [font-family:system-ui,sans-serif]">
          <p className="text-sm font-medium text-ink-3">Something went wrong</p>
          <h1 className="text-2xl font-semibold tracking-tighter text-ink">SourceBD couldn&rsquo;t load</h1>
          <p className="text-md text-ink-2">Your searches and saved suppliers are safe. Reload in a moment.</p>
          <div>
            <Link href="/" className="inline-flex h-control-lg items-center rounded-sm bg-brand px-4 text-base font-medium text-surface">
              Reload the home page
            </Link>
          </div>
          <p className="text-sm text-ink-3">{error.digest ? `Error 500 · reference ${error.digest}` : "Error 500"}</p>
        </main>
      </body>
    </html>
  );
}
