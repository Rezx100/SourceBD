"use client";

// Per-segment error boundary. Catches errors thrown during render in any
// route under `app/` that isn't covered by a more specific boundary. Renders
// inside the root layout (fonts + globals.css still apply).

import Link from "next/link";

import { BlurFade } from "@/components/ui/blur-fade";
import { MagicCard } from "@/components/ui/magic-card";
import { Button } from "@/components/ui/button";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg items-center px-6 py-16">
      <BlurFade delay={0.05} className="w-full">
        <MagicCard
          className="w-full rounded-xl border border-hairline bg-surface-l1 px-8 py-10"
          gradientColor="#ecf3ee"
          gradientOpacity={0.08}
        >
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-sem-amber">
            {error.digest ?? "500"}
          </p>
          <h1 className="mt-2 font-display text-[22px] font-bold tracking-tight text-ink-primary">
            Something went wrong
          </h1>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-secondary">
            An unexpected error interrupted this page. The incident has been
            logged.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="primary" size="sm" onClick={() => reset()}>
              Try again
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/">Back to home</Link>
            </Button>
          </div>
        </MagicCard>
      </BlurFade>
    </main>
  );
}
