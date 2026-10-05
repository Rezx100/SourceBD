// Sign in (Paper `20 Onboarding` S1), and two states that come back to it: a session that ended (S6,
// `?reason=session`, which the middleware adds when a cookie was there but no longer signs anyone in).
// `next` is kept through every step and only a same-origin path is honoured.

import type { Metadata } from "next";
import { AuthSplit } from "@/components/auth/frame";
import { LinkForm, SignInForm } from "@/components/auth/forms";
import { AuthLink } from "@/components/auth/link";
import { AuthBar, Heading, StatePage } from "@/components/auth/state";
import { safeNext } from "@/components/auth/words";

export const metadata: Metadata = { title: "Sign in · SourceBD" };

const here = (next: string) => (next === "/app" ? "/login" : `/login?next=${encodeURIComponent(next)}`);

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reason?: string; method?: string }> }) {
  const q = await searchParams;
  const next = safeNext(q.next);

  if (q.reason === "session") {
    return (
      <StatePage
        barLink={<AuthLink href={here(next)}>Sign in</AuthLink>}
        kicker="Session ended"
        title="You were signed out"
        body="Sessions end after a while, to keep your account safe. Sign in to carry on."
        actions={[{ label: "Sign in again", href: here(next) }, { label: "Email me a sign-in link", href: `/login?method=link&next=${encodeURIComponent(next)}`, secondary: true }]}
        note="You come back to the page you were on. Saved suppliers and RFQ drafts are kept."
      />
    );
  }

  if (q.method === "link") {
    return (
      <AuthSplit bar={<AuthBar lead="New to SourceBD?" link={<AuthLink href="/signup">Create an account</AuthLink>} />}>
        <Heading title="Get a sign-in link" sub="We email you a link. It works once, for one hour." />
        <LinkForm next={next} />
        <p className="text-base text-ink-3">
          Prefer a password? <AuthLink href={here(next)}>Sign in with a password</AuthLink>
        </p>
      </AuthSplit>
    );
  }

  return (
    <AuthSplit bar={<AuthBar lead="New to SourceBD?" link={<AuthLink href={next === "/app" ? "/signup" : `/signup?next=${encodeURIComponent(next)}`}>Create an account</AuthLink>} />}>
      <Heading title="Sign in" sub="Use the work email you signed up with." />
      <SignInForm next={next} />
    </AuthSplit>
  );
}
