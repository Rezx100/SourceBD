"use client";

// Per-segment error boundary (Paper `20 Onboarding` S9). Catches errors thrown during render in any
// route under `app/` that has no boundary of its own. It says what is safe, offers Try again and the
// way out, and gives the reference (the error's digest) for support. Never the error's own message.

import { AuthLink } from "@/components/auth/link";
import { StatePage } from "@/components/auth/state";
import { Button } from "@/components/kit";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <StatePage
      barLink={<AuthLink href="/login">Sign in</AuthLink>}
      kicker="Something went wrong"
      title="We couldn't load this page"
      body="Your searches and saved suppliers are safe. Try again in a moment."
      primary={
        <Button kind="primary" size="lg" className="max-sm:h-input-touch max-sm:text-md" onClick={() => reset()}>
          Try again
        </Button>
      }
      actions={[{ label: "Go to Search", href: "/app", secondary: true }]}
      note={error.digest ? `Error 500 · reference ${error.digest}. Tell support this if it keeps happening.` : "Error 500. Tell support if it keeps happening."}
    />
  );
}
