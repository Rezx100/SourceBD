// /api/v1/settings — Buyer Settings (Spec B10).
//
// GET                                  → settings_get
// POST {action:'update_profile'}       → settings_update_profile
// POST {action:'update_notifications'} → settings_update_notifications
// POST {action:'change_email'}         → Supabase Auth updateUser({email})
// POST {action:'change_password'}      → Supabase Auth updateUser({password})
//
// Auth: any authenticated user. Email/password changes use Supabase Auth
// directly (the user is identified by the session cookie); the email
// change triggers Supabase's standard confirmation flow.

import { NextResponse } from "next/server";

import { AppOriginError, getCanonicalAppOrigin } from "@/lib/app-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Sb = Awaited<ReturnType<typeof createSupabaseServerClient>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_DISPLAY_NAME = 120;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 200;

async function requireAuth(): Promise<
  { supabase: Sb; userId: string } | NextResponse
> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  return { supabase, userId: user.id };
}

export async function GET() {
  const gate = await requireAuth();
  if (gate instanceof NextResponse) return gate;
  const { supabase } = gate;

  const { data, error } = await supabase.rpc("settings_get");
  if (error) {
    return NextResponse.json(
      { error: "settings_get failed", detail: error.message },
      { status: 400 },
    );
  }
  return NextResponse.json({ settings: data });
}

export async function POST(req: Request) {
  const gate = await requireAuth();
  if (gate instanceof NextResponse) return gate;
  const { supabase } = gate;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";

  if (action === "update_profile") {
    const raw = body.display_name;
    if (raw !== null && raw !== undefined && typeof raw !== "string") {
      return NextResponse.json(
        { error: "display_name must be a string or null" },
        { status: 400 },
      );
    }
    const trimmed =
      typeof raw === "string" ? raw.trim().slice(0, MAX_DISPLAY_NAME) : null;
    const { error } = await supabase.rpc("settings_update_profile", {
      p_display_name: trimmed,
    });
    if (error) {
      return NextResponse.json(
        { error: "settings_update_profile failed", detail: error.message },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "update_notifications") {
    const patch: Record<string, boolean> = {};
    for (const key of ["digest", "rfq_replies", "saved_alerts"] as const) {
      if (key in body) {
        const v = body[key];
        if (typeof v !== "boolean") {
          return NextResponse.json(
            { error: `${key} must be boolean` },
            { status: 400 },
          );
        }
        patch[key] = v;
      }
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: "no notification keys provided" },
        { status: 400 },
      );
    }
    const { error } = await supabase.rpc("settings_update_notifications", {
      p_input: patch,
    });
    if (error) {
      return NextResponse.json(
        { error: "settings_update_notifications failed", detail: error.message },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "change_email") {
    const raw = body.new_email;
    if (typeof raw !== "string" || !EMAIL_RE.test(raw.trim())) {
      return NextResponse.json(
        { error: "new_email must be a valid email address" },
        { status: 400 },
      );
    }
    let emailRedirectTo: string;
    try {
      emailRedirectTo = `${getCanonicalAppOrigin(req.headers)}/auth/callback?next=${encodeURIComponent(
        "/app/settings/profile",
      )}`;
    } catch (err) {
      return NextResponse.json(
        {
          error: "app_origin_unavailable",
          detail:
            err instanceof AppOriginError
              ? err.message
              : "Unable to build email change redirect.",
        },
        { status: 500 },
      );
    }
    const { error } = await supabase.auth.updateUser(
      { email: raw.trim().toLowerCase() },
      { emailRedirectTo },
    );
    if (error) {
      return NextResponse.json(
        { error: "change_email failed", detail: error.message },
        { status: 400 },
      );
    }
    return NextResponse.json({
      ok: true,
      info: "Confirmation email sent to the new address.",
    });
  }

  if (action === "change_password") {
    const raw = body.new_password;
    if (typeof raw !== "string") {
      return NextResponse.json(
        { error: "new_password must be a string" },
        { status: 400 },
      );
    }
    if (raw.length < MIN_PASSWORD || raw.length > MAX_PASSWORD) {
      return NextResponse.json(
        { error: `new_password must be ${MIN_PASSWORD}–${MAX_PASSWORD} chars` },
        { status: 400 },
      );
    }
    const { error } = await supabase.auth.updateUser({ password: raw });
    if (error) {
      return NextResponse.json(
        { error: "change_password failed", detail: error.message },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json(
    { error: "unknown action; expected one of update_profile|update_notifications|change_email|change_password" },
    { status: 400 },
  );
}
