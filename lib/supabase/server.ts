// Supabase server client for Server Components, Server Actions, and Route
// Handlers. Reads + writes auth cookies via the Next.js `cookies()` store.
//
// Per `context/architecture.md`, the Supabase JS client is the sanctioned
// way to talk to the database. `@supabase/ssr` is the official cookie
// bridge for Next.js App Router (replaces deprecated
// `@supabase/auth-helpers-nextjs`).

import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";

import { forwardedRequestHeaders } from "@/lib/ledger/request-headers";

/**
 * Every call carries the visitor's address and browser as `x-sourcebd-ip` / `x-sourcebd-ua` (moderation
 * plan 1b), which the activity record (0131) reads from the request's headers; without them the database
 * sees only this server. A request that cannot be read (a build, a script) sends none.
 *
 * `userAgent` is the visitor's own browser, for a client that SIGNS SOMEONE IN: Auth records the agent of
 * the request that opens a session, and from a server action that would be this server's ("node"), so the
 * Security page could not tell one device from another. Pass it from the sign-in actions and the link
 * callback only; every other call is the session's own and needs no header.
 */
export async function createSupabaseServerClient(opts: { userAgent?: string | null } = {}) {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
  let forwarded: Record<string, string> = {};
  try {
    forwarded = forwardedRequestHeaders(await headers());
  } catch {
    // No request to read (a build, a script): the record gets no address for this call.
  }
  // A header value may not carry control characters (a newline would be a second header).
  const ua = typeof opts.userAgent === "string" ? opts.userAgent.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 300) : "";
  const extra = { ...forwarded, ...(ua ? { "User-Agent": ua } : {}) };
  return createServerClient(url, anonKey, {
    ...(Object.keys(extra).length > 0 ? { global: { headers: extra } } : {}),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // `set` is unavailable when called from a pure Server Component;
          // middleware refreshes the session cookie on every request so this
          // failure is non-fatal.
        }
      },
    },
  });
}

// Is `password` this account's current password? Checked by signing in on a
// throwaway client that keeps no cookie, so the caller's own session is left
// alone; the session it opens is closed again at once (ST-03). Supabase's own
// sign-in limits apply to every guess. Throws when the check itself fails.
export async function passwordMatches(email: string, password: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
  const probe = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await probe.auth.signInWithPassword({ email, password });
  if (error?.code === "invalid_credentials") return false;
  // A rate limit or an outage is not a wrong password: say neither.
  if (error) throw new Error(`password check failed: ${error.message}`);
  await probe.auth.signOut({ scope: "local" });
  return true;
}
