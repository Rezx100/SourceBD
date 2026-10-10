// Create an account (Paper `20 Onboarding` 1): work email and password, or a link by email, the terms in
// words. `?role=supplier` (from "For suppliers") makes a supplier account; everything else is a buyer. `?email=`
// (the home page's hero form) fills the email field when it looks like an address.

import type { Metadata } from "next";
import { AuthSplit } from "@/components/auth/frame";
import { SignUpForm } from "@/components/auth/forms";
import { AuthLink } from "@/components/auth/link";
import { AuthBar, Heading } from "@/components/auth/state";
import { safeNext } from "@/components/auth/words";

export const metadata: Metadata = { title: "Create your account · SourceBD" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ role?: string; next?: string; email?: string | string[] }> }) {
  const q = await searchParams;
  const role = q.role === "supplier" ? "supplier" : "buyer";
  // Where they were going (an invite link): carried to the confirmation email and the sign-in link.
  const next = safeNext(q.next, role === "supplier" ? "/supplier" : "/onboarding");
  const email = typeof q.email === "string" && q.email.length <= 254 && /^[^\s@]+@[^\s@]+$/.test(q.email.trim()) ? q.email.trim() : undefined;
  return (
    <AuthSplit bar={<AuthBar lead="Already have an account?" link={<AuthLink href={q.next ? `/login?next=${encodeURIComponent(next)}` : "/login"}>Sign in</AuthLink>} />}>
      <Heading
        title="Create your account"
        sub={role === "supplier" ? "Create an account to claim your company's profile." : "Find and check Bangladesh suppliers. Every fact shows its source."}
      />
      <SignUpForm role={role} next={next} email={email} />
    </AuthSplit>
  );
}
