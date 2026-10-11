// Who is signed in, read on this server: the session token's signature is checked against the
// project's published signing key (supabase `getClaims`, the key cached ten minutes), so a page or the
// middleware no longer waits on a round trip to Supabase Auth just to learn the user's id (11 Oct 2026,
// the phone speed pass). A token that cannot be checked that way (an old shared-secret token, a bad
// signature, a key we do not hold) is asked of Auth with `getUser`, exactly as before, so nothing that
// used to be refused is let through. Role and suspension are never read from here: they stay in
// `profiles`, read on every request by the middleware.

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any Supabase client (server, middleware, a test stub).
type AuthClient = { auth: any };

export async function sessionUserId(supabase: AuthClient): Promise<string | null> {
  const auth = supabase.auth;
  // A test stub that only answers getUser keeps working, and is counted as the round trip it stands for.
  if (typeof auth.getClaims === "function") {
    try {
      const { data, error } = await auth.getClaims();
      if (!error) {
        const sub = data?.claims?.sub;
        return typeof sub === "string" && sub ? sub : null;
      }
    } catch {
      // getClaims rethrows what is not an Auth error: that is asked of Auth below too, never a 500.
    }
  }
  const { data } = await auth.getUser();
  const id = data?.user?.id;
  return typeof id === "string" && id ? id : null;
}
