// "Check your email" after a reset link was asked for (Paper `20 Onboarding` S5, reset wording). It says
// the link was sent "if" the address has an account, because the page must not tell which do.

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthLink } from "@/components/auth/link";
import { StatePage } from "@/components/auth/state";
import { AUTH_EMAIL_COOKIE, MAIL_LINKS } from "@/components/auth/words";

export const metadata: Metadata = { title: "Check your email · SourceBD" };
export const dynamic = "force-dynamic";

export default async function ResetSentPage() {
  const email = (await cookies()).get(AUTH_EMAIL_COOKIE)?.value;
  if (!email) redirect("/forgot-password");
  return (
    <StatePage
      barLink={<AuthLink href="/login">Sign in</AuthLink>}
      kicker="Password reset"
      title="Check your email"
      body={`If ${email} has an account, we sent a reset link to it. It works for one hour.`}
      actions={[
        { label: MAIL_LINKS[0].label, href: MAIL_LINKS[0].href },
        { label: MAIL_LINKS[1].label, href: MAIL_LINKS[1].href, secondary: true },
      ]}
      note={
        <>
          Wrong email? <AuthLink href="/forgot-password">Go back and change it.</AuthLink> No email after 2 minutes? Check spam.
        </>
      }
    />
  );
}
