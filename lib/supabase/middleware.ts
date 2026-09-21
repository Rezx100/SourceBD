// Supabase middleware client. Refreshes the auth session cookie on every
// request and exposes the resolved user so middleware can gate routes.
//
// IMPORTANT: per Supabase SSR docs, the response built here MUST be the one
// returned to the browser so that any refreshed `sb-*` cookies propagate.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export function createSupabaseMiddlewareClient(req: NextRequest) {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-sourcebd-pathname", req.nextUrl.pathname);
  let res = NextResponse.next({
    request: { headers: requestHeaders },
  });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          req.cookies.set(name, value);
        }
        res = NextResponse.next({
          request: { headers: requestHeaders },
        });
        for (const { name, value, options } of cookiesToSet) {
          res.cookies.set(name, value, options);
        }
      },
    },
  });
  return { supabase, res };
}
