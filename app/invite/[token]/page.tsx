// /invite/<token> (gap 4): the link in a team invite. Signed out, it sends the person to sign in or sign
// up and brings them back here; signed in, it joins them to the team (`workspace_invite_accept`, which
// checks the token, the expiry and that the signed-in email is the one invited) and opens Team and roles
// with a note. Every refusal is a plain sentence. The token is a one-time secret: this page never
// prints it, and `referrer: no-referrer` keeps it out of the next request's Referer.

import Link from "next/link";
import { redirect } from "next/navigation";
import { Button, buttonClass } from "@/components/kit";
import { INVITE_TOKEN_RE, REFUSALS, refusalOf, type InviteRefusal } from "@/components/team/model";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Team invite · SourceBD", robots: { index: false, follow: false }, referrer: "no-referrer" as const };

function Refusal({ kind, email }: { kind: InviteRefusal; email?: string | null }) {
  const { title, body } = REFUSALS[kind];
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col justify-center gap-4 px-4 py-10">
      <p className="text-md font-semibold tracking-tight text-brand-ink">SourceBD</p>
      <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
      <p className="text-base text-ink-2">{body}</p>
      {kind === "wrong_email" && email ? <p className="text-sm text-ink-3">You are signed in as {email}.</p> : null}
      <div className="flex flex-wrap gap-2 pt-2">
        {kind === "wrong_email" ? (
          <form action="/auth/sign-out" method="post">
            <Button type="submit" kind="primary" className="max-md:h-input-touch">
              Sign out
            </Button>
          </form>
        ) : null}
        <Link href="/app" prefetch={false} className={buttonClass({ kind: kind === "wrong_email" ? "secondary" : "primary", className: "max-md:h-input-touch" })}>
          Open SourceBD
        </Link>
      </div>
    </main>
  );
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // A link that is not even the shape of a token never reaches the database.
  if (!INVITE_TOKEN_RE.test(token)) return <Refusal kind="not_found" />;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);

  const { error } = await supabase.rpc("workspace_invite_accept", { p_token: token });
  if (error) return <Refusal kind={refusalOf(error.message)} email={user.email} />;
  redirect("/app/settings/members?joined=1");
}
