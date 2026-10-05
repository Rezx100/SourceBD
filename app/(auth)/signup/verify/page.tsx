// Check your email (Paper `20 Onboarding` 2). The address is the one the sign-up kept in its cookie for
// an hour; with no cookie there is nothing to verify here, so the person goes back to the form.
// The email carries a link (the 6-digit code Paper draws needs the code in Supabase's confirmation
// template, which is a dashboard setting: until it is there this page offers the link only).

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { changeSignupEmail } from "@/app/(auth)/actions";
import { AuthSplit } from "@/components/auth/frame";
import { ResendLine } from "@/components/auth/forms";
import { AuthLink } from "@/components/auth/link";
import { AuthBar, Heading } from "@/components/auth/state";
import { AUTH_EMAIL_COOKIE, MAIL_LINKS } from "@/components/auth/words";
import { ButtonLink } from "@/components/kit";

export const metadata: Metadata = { title: "Check your email · SourceBD" };
export const dynamic = "force-dynamic";

export default async function VerifyPage() {
  const email = (await cookies()).get(AUTH_EMAIL_COOKIE)?.value;
  if (!email) redirect("/signup");
  return (
    <AuthSplit bar={<AuthBar lead="Already confirmed?" link={<AuthLink href="/login">Sign in</AuthLink>} />}>
      <Heading title="Check your email" sub={`We sent a link to ${email}. Open it to confirm your address.`} />
      <div className="flex gap-2">
        {MAIL_LINKS.map((m) => (
          <ButtonLink key={m.label} href={m.href} target="_blank" rel="noopener noreferrer" kind="secondary" size="lg" className="flex-1 max-sm:h-input-touch">
            {m.label}
          </ButtonLink>
        ))}
      </div>
      <div className="flex flex-col gap-2.5 border-t border-line pt-5">
        <ResendLine />
        <form action={changeSignupEmail} className="flex items-baseline gap-1.5 text-base text-ink-3">
          Wrong email?
          <button type="submit" className="font-medium text-brand underline decoration-1 [text-underline-position:from-font] max-sm:min-h-11">
            Change it
          </button>
        </form>
      </div>
    </AuthSplit>
  );
}
