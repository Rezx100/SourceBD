// "Check your email" after a sign-in link was asked for (Paper `20 Onboarding` S5). The address is the
// one the action kept in its cookie; with none there is nothing to say, so back to the form.

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthLink } from "@/components/auth/link";
import { StatePage } from "@/components/auth/state";
import { AUTH_EMAIL_COOKIE, MAIL_LINKS } from "@/components/auth/words";

export const metadata: Metadata = { title: "Check your email · SourceBD" };
export const dynamic = "force-dynamic";

export default async function LinkSentPage() {
  const email = (await cookies()).get(AUTH_EMAIL_COOKIE)?.value;
  if (!email) redirect("/login");
  return (
    <StatePage
      barLink={<AuthLink href="/login">Sign in</AuthLink>}
      kicker="Sign-in link"
      title="Check your email"
      body={`We sent a sign-in link to ${email}. It works for one hour.`}
      actions={[
        { label: MAIL_LINKS[0].label, href: MAIL_LINKS[0].href },
        { label: MAIL_LINKS[1].label, href: MAIL_LINKS[1].href, secondary: true },
      ]}
      note={
        <>
          Wrong email? <AuthLink href="/login?method=link">Go back and change it.</AuthLink> No email after 2 minutes? Check spam.
        </>
      }
    />
  );
}
