// The second step of signing in (row 6): the 6 digits from the authenticator app. Only a signed-in session
// that is still owed its code sees the form; a stranger is sent to sign in, and everyone else on to where they
// were going. The middleware sends any gated page here until the code has been given.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthSplit } from "@/components/auth/frame";
import { CodeForm } from "@/components/auth/forms";
import { AuthBar, Heading } from "@/components/auth/state";
import { safeNext } from "@/components/auth/words";
import { needsSecondStep, readAal } from "@/lib/second-step";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Enter your code · SourceBD" };
export const dynamic = "force-dynamic";

export default async function LoginCodePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!needsSecondStep(await readAal(supabase))) redirect(next);
  return (
    <AuthSplit bar={<AuthBar lead={user.email ?? undefined} link={
          <form action="/auth/sign-out" method="post" className="inline">
            <button type="submit" className="max-sm:min-h-11">
              Sign out
            </button>
          </form>
        } />}>
      <Heading title="Enter your code" sub="Open your authenticator app and enter the 6-digit code for SourceBD." />
      <CodeForm next={next} />
    </AuthSplit>
  );
}
