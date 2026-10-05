// "This link has expired" (Paper `20 Onboarding` S4): where the email-link callback sends a link that is
// used up or past its hour. The way forward is a new link, or the password.

import type { Metadata } from "next";
import { AuthLink } from "@/components/auth/link";
import { StatePage } from "@/components/auth/state";
import { safeNext } from "@/components/auth/words";

export const metadata: Metadata = { title: "This link has expired · SourceBD" };

export default async function LinkExpiredPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  const q = next === "/app" ? "" : `&next=${encodeURIComponent(next)}`;
  return (
    <StatePage
      barLink={<AuthLink href="/login">Sign in</AuthLink>}
      kicker="Sign-in link"
      title="This link has expired"
      body="Links work once and for one hour. We can send you a new one."
      actions={[
        { label: "Send a new link", href: `/login?method=link${q}` },
        { label: "Sign in with a password", href: next === "/app" ? "/login" : `/login?next=${encodeURIComponent(next)}`, secondary: true },
      ]}
    />
  );
}
