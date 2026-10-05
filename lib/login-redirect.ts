// The query the middleware puts on the sign-in redirect for a gated page. `next` is where the person
// was going. `reason=session` is added only when the browser still holds a Supabase session cookie (an
// `sb-` cookie) but nobody is signed in any more: their session ended, and the sign-in page says so
// (Paper `20 Onboarding` S6) instead of showing the plain form a first-time visitor gets.

export function loginRedirectSearch(pathname: string, search: string, cookieNames: readonly string[]): string {
  const hadSession = cookieNames.some((n) => n.startsWith("sb-"));
  return `?next=${encodeURIComponent(pathname + search)}${hadSession ? "&reason=session" : ""}`;
}
