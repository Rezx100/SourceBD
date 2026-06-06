// Demo-mode banner — Spec M5 / M6a (light).
// Anonymous public chrome above /discover and /suppliers/[slug].
// Server component; no client island. Plain <aside aria-label="Demo
// mode"> (not role="status" — this is static marketing chrome, not a
// live region).

import Link from "next/link";

export function DemoBanner({ next }: { next: string }) {
  const signupHref = `/signup?next=${encodeURIComponent(next)}`;
  const loginHref = `/login?next=${encodeURIComponent(next)}`;
  return (
    <aside aria-label="Demo mode" className="mkt-demo">
      <div className="mkt-demo-inner">
        <p>
          <strong>Demo mode.</strong> Contacts and saved-supplier features
          are reserved for verified buyers. Sign up free to unlock.
        </p>
        <div className="mkt-demo-cta">
          <Link className="pri" href={signupHref}>
            Sign up free
          </Link>
          <Link className="ghost" href={loginHref}>
            Sign in
          </Link>
        </div>
      </div>
    </aside>
  );
}
