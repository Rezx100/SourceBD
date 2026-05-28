// Browser-side Supabase client for client components (Realtime subscriptions).
// Reuses the user's auth cookie via `@supabase/ssr` so RLS applies under
// the caller's JWT — Realtime row filtering uses the same RLS policies as
// PostgREST.

"use client";

import { createBrowserClient } from "@supabase/ssr";

let _client: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
  _client = createBrowserClient(url, anonKey);
  return _client;
}
