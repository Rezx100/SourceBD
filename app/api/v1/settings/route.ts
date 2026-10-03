// /api/v1/settings — Buyer Settings (Spec B10).
//
// GET                                  → settings_get
// POST {action:'update_profile'}       → settings_update_profile
// POST {action:'update_notifications'} → settings_update_notifications
// POST {action:'update_workspace', …}  → settings_update_workspace (0106)
// POST {action:'update_inquiry', questions?, email_template?}
//                                      → settings_update_inquiry (0106)
// POST {action:'change_email'}         → Supabase Auth updateUser({email})
// POST {action:'change_password', current_password, new_password}
//                                      → current password checked, then
//                                        Supabase Auth updateUser({password})
//
// Auth: any authenticated user. Email/password changes use Supabase Auth
// directly (the user is identified by the session cookie); the email
// change triggers Supabase's standard confirmation flow.

import { NextResponse } from "next/server";

import { AppOriginError, getCanonicalAppOrigin } from "@/lib/app-origin";
import { createSupabaseServerClient, passwordMatches } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Sb = Awaited<ReturnType<typeof createSupabaseServerClient>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_DISPLAY_NAME = 120;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 200;
const URL_RE = /^https?:\/\/\S+$/i;

// update_workspace: [label, max length, allowed values?]. Only keys the
// caller sends are written; null or "" clears one.
const WORKSPACE_FIELDS: Record<string, [label: string, max: number, allowed?: readonly string[]]> = {
  company_name: ["The company name", 200],
  company_type: ["The company type", 16, ["brand", "retailer", "importer", "agent", "other"]],
  business_description: ["The business description", 2000],
  website: ["The website", 300],
  customer_base: ["The customer base", 300],
  employee_count: ["The number of employees", 16, ["1-10", "11-50", "51-200", "201-1000", "1000+"]],
  company_logo_url: ["The logo address", 1000],
};
const MAX_QUESTIONS = 20;
const MAX_QUESTION = 200;
const MAX_TEMPLATE = 4000;

async function requireAuth(): Promise<
  { supabase: Sb; userId: string; email: string | null } | NextResponse
> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  return { supabase, userId: user.id, email: user.email ?? null };
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
  const { supabase, email } = gate;

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

  if (action === "update_workspace") {
    const patch: Record<string, string | null> = {};
    for (const [key, [label, max, allowed]] of Object.entries(WORKSPACE_FIELDS)) {
      if (!(key in body)) continue;
      const raw = body[key];
      if (raw !== null && typeof raw !== "string") {
        return NextResponse.json({ error: `${label} must be text.` }, { status: 400 });
      }
      const value = typeof raw === "string" ? raw.trim() || null : null;
      if (value && value.length > max) {
        return NextResponse.json({ error: `${label} must be ${max} characters or fewer.` }, { status: 400 });
      }
      if (value && allowed && !allowed.includes(value)) {
        return NextResponse.json({ error: `${label} must be one of ${allowed.join(", ")}.` }, { status: 400 });
      }
      if (value && (key === "website" || key === "company_logo_url") && !URL_RE.test(value)) {
        return NextResponse.json(
          { error: `${label} must start with http:// or https://.` },
          { status: 400 },
        );
      }
      patch[key] = value;
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "There is nothing to save." }, { status: 400 });
    }
    const { error } = await supabase.rpc("settings_update_workspace", { p_input: patch });
    if (error) {
      return NextResponse.json(
        { error: "settings_update_workspace failed", detail: error.message },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "update_inquiry") {
    const patch: { questions?: string[]; email_template?: string | null } = {};
    if ("questions" in body) {
      const raw = body.questions;
      if (!Array.isArray(raw) || raw.some((q) => typeof q !== "string")) {
        return NextResponse.json({ error: "The questions must be a list of text." }, { status: 400 });
      }
      const questions = (raw as string[]).map((q) => q.trim()).filter(Boolean);
      if (questions.length > MAX_QUESTIONS) {
        return NextResponse.json(
          { error: `You can keep up to ${MAX_QUESTIONS} questions.` },
          { status: 400 },
        );
      }
      if (questions.some((q) => q.length > MAX_QUESTION)) {
        return NextResponse.json(
          { error: `Each question must be ${MAX_QUESTION} characters or fewer.` },
          { status: 400 },
        );
      }
      patch.questions = questions;
    }
    if ("email_template" in body) {
      const raw = body.email_template;
      if (raw !== null && typeof raw !== "string") {
        return NextResponse.json({ error: "The email template must be text." }, { status: 400 });
      }
      const template = typeof raw === "string" ? raw.trim() || null : null;
      if (template && template.length > MAX_TEMPLATE) {
        return NextResponse.json(
          { error: `The email template must be ${MAX_TEMPLATE} characters or fewer.` },
          { status: 400 },
        );
      }
      patch.email_template = template;
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "There is nothing to save." }, { status: 400 });
    }
    const { error } = await supabase.rpc("settings_update_inquiry", { p_input: patch });
    if (error) {
      return NextResponse.json(
        { error: "settings_update_inquiry failed", detail: error.message },
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
    // A lifted session cookie must not be enough to take the account (ST-03).
    const current = body.current_password;
    if (typeof current !== "string" || current.length === 0) {
      return NextResponse.json(
        { error: "Enter your current password." },
        { status: 400 },
      );
    }
    if (!email) {
      return NextResponse.json(
        { error: "This account has no email address to check the password against." },
        { status: 400 },
      );
    }
    let matches: boolean;
    try {
      matches = await passwordMatches(email, current);
    } catch {
      return NextResponse.json(
        { error: "The password could not be checked just now. Try again in a minute." },
        { status: 503 },
      );
    }
    if (!matches) {
      return NextResponse.json(
        { error: "That is not your current password." },
        { status: 403 },
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
    { error: "unknown action; expected one of update_profile|update_notifications|update_workspace|update_inquiry|change_email|change_password" },
    { status: 400 },
  );
}
