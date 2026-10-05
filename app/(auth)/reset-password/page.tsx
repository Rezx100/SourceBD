// Choose a new password (Paper `20 Onboarding` S3). Only a session that has just come through a reset
// link gets here: with no session the link was used up or has expired, which is S4's page, not a form
// that would fail on save.

import type { Metadata } from "next";
import { AuthSplit } from "@/components/auth/frame";
import { ResetForm } from "@/components/auth/forms";
import { AuthLink } from "@/components/auth/link";
import { AuthBar, Heading, StatePage } from "@/components/auth/state";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Choose a new password · SourceBD" };
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <StatePage
        barLink={<AuthLink href="/login">Sign in</AuthLink>}
        kicker="Password reset"
        title="This link has expired"
        body="Links work once and for one hour. We can send you a new one."
        actions={[{ label: "Send a new link", href: "/forgot-password" }, { label: "Sign in with a password", href: "/login", secondary: true }]}
      />
    );
  }
  return (
    <AuthSplit bar={<AuthBar lead="Not you?" link={<AuthLink href="/login">Sign in</AuthLink>} />}>
      <Heading title="Choose a new password" sub={user.email ? `For ${user.email}.` : undefined} />
      <ResetForm />
    </AuthSplit>
  );
}
