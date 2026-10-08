// "This account is suspended" (Paper `20 Onboarding` S7; Spec A5). No auth gate: the middleware sends a
// suspended person here from every gated surface, and they can still sign out. The words say what is
// paused and where to ask; they never say why (the reason is the administrator's to give).

import type { Metadata } from "next";
import { ButtonLink } from "@/components/kit";
import { StatePage } from "@/components/auth/state";

export const metadata: Metadata = { title: "This account is suspended · SourceBD" };
export const dynamic = "force-dynamic";

const SUPPORT = "mailto:support@sourcebd.net?subject=Suspended%20account";

function SignOut({ className }: { className?: string }) {
  return (
    <form action="/auth/sign-out" method="post">
      <button type="submit" className={className ?? "font-medium text-brand-ink underline decoration-1 [text-underline-position:from-font] max-sm:min-h-11"}>
        Sign out
      </button>
    </form>
  );
}

export default function SuspendedPage() {
  return (
    <StatePage
      barLink={<SignOut className="font-medium underline decoration-1 [text-underline-position:from-font]" />}
      kicker="Account"
      title="This account is suspended"
      body="You can't search or send RFQs while it is suspended. Contact us to find out why."
      primary={
        <>
          <ButtonLink href={SUPPORT} kind="primary" size="lg" className="max-sm:h-input-touch max-sm:text-md">
            Contact support
          </ButtonLink>
          <SignOut />
        </>
      }
    />
  );
}
