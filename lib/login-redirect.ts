// The query the middleware puts on the sign-in redirect for a gated page. `next` is where the person
// was going. `reason=session` is added only when the browser still holds a Supabase SESSION cookie
// (`sb-<ref>-auth-token`, possibly chunked as `.0`, `.1`) but nobody is signed in any more: their session
// ended, and the sign-in page says so (Paper `20 Onboarding` S6) instead of the plain form a first-time
// visitor gets. Other `sb-` cookies do not count: asking for an email link leaves a `-code-verifier`
// cookie on a visitor who has never been signed in.

const SESSION_COOKIE = /^sb-.+-auth-token(\.\d+)?$/;

export function loginRedirectSearch(pathname: string, search: string, cookieNames: readonly string[]): string {
  const hadSession = cookieNames.some((n) => SESSION_COOKIE.test(n));
  return `?next=${encodeURIComponent(pathname + search)}${hadSession ? "&reason=session" : ""}`;
}
