// Sign-out endpoint. POST only — protects against drive-by GETs.

import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { THEME_COOKIE } from "@/lib/theme";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    req.nextUrl.origin;
  const url = new URL("/login", origin);
  const res = NextResponse.redirect(url, { status: 303 });
  // The app's theme is this browser's, not the account's: the next person to sign in here starts in light.
  res.cookies.delete(THEME_COOKIE);
  return res;
}
