"use client";

// Per-segment error boundary. Catches errors thrown during render in any
// route under `app/` that isn't covered by a more specific boundary. Renders
// inside the root layout (fonts + globals.css still apply).

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl items-center px-6 py-16">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Something went wrong</CardTitle>
          <CardMeta>{error.digest ?? "500"}</CardMeta>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-ink-secondary">
            An unexpected error interrupted this page. The incident has been logged.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="sm" onClick={() => reset()}>
              Try again
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/">Back to home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
