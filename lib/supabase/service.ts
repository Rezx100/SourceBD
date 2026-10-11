// A service-role Supabase client for the few writes no signed-in caller may make (0141's reveal finish/abort).
// It carries the visitor's address and browser like the session client, so the activity record (0131) still
// says where the action came from. Null when the service key is not configured.

import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { headers } from "next/headers";

import { forwardedRequestHeaders } from "@/lib/ledger/request-headers";

export async function createSupabaseServiceClient(): Promise<SupabaseClient | null> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  let forwarded: Record<string, string> = {};
  try {
    forwarded = forwardedRequestHeaders(await headers());
  } catch {
    // No request to read: the record gets no address for this call.
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: forwarded },
  });
}
