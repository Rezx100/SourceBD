// Reset your password, asking for the link (Paper `20 Onboarding` S2). The next page never says whether
// the address has an account.

import type { Metadata } from "next";
import { AuthSplit } from "@/components/auth/frame";
import { ForgotForm } from "@/components/auth/forms";
import { AuthLink } from "@/components/auth/link";
import { AuthBar, Heading } from "@/components/auth/state";

export const metadata: Metadata = { title: "Reset your password · SourceBD" };

export default function ForgotPasswordPage() {
  return (
    <AuthSplit bar={<AuthBar lead="Remembered it?" link={<AuthLink href="/login">Sign in</AuthLink>} />}>
      <Heading title="Reset your password" sub="We email you a link. It works for one hour." />
      <ForgotForm />
    </AuthSplit>
  );
}
