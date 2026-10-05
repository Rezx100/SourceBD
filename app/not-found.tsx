// Not found (Paper `20 Onboarding` S8). A page of one message: what happened, one way on, one way back.
// It does not read the session (that would make every unknown address dynamic), so the bar offers
// "Sign in"; "Go to Search" lands a signed-out person on the sign-in page and brings them back.

import { StatePage } from "@/components/auth/state";
import { AuthLink } from "@/components/auth/link";

export default function NotFound() {
  return (
    <StatePage
      barLink={<AuthLink href="/login">Sign in</AuthLink>}
      kicker="Page not found"
      title="We can't find that page"
      body="The link may be old, or the address has a typo."
      actions={[{ label: "Go to Search", href: "/app" }, { label: "Go to the home page", href: "/", secondary: true }]}
      note="Error 404"
    />
  );
}
