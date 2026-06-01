"use server";

// Server actions for Spec F3 — Auth.
// Email/password + magic link signin, signup, password-reset request, and
// password update from a recovery session.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendEmail, EmailError } from "@/lib/email/send";

export type AuthActionState = { error?: string; info?: string };

function isSafeNext(value: string | null | undefined): value is string {
  // Only same-origin relative paths. Block protocol-relative `//evil.com`
  // and absolute URLs.
  return !!value && value.startsWith("/") && !value.startsWith("//");
}

async function siteOrigin(): Promise<string> {
  const envOrigin = process.env.NEXT_PUBLIC_APP_URL;
  if (envOrigin) return envOrigin.replace(/\/$/, "");
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

export async function signInWithPassword(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const nextRaw = String(formData.get("next") ?? "");
  if (!email || !password) return { error: "Email and password are required." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  const next = isSafeNext(nextRaw) ? nextRaw : "/app";
  revalidatePath("/", "layout");
  redirect(next);
}

export async function signInWithMagicLink(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const nextRaw = String(formData.get("next") ?? "");
  if (!email) return { error: "Email is required." };

  const supabase = await createSupabaseServerClient();
  const next = isSafeNext(nextRaw) ? nextRaw : "/app";
  const origin = await siteOrigin();
  const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo },
  });
  if (error) return { error: error.message };
  return { info: "Check your inbox for the sign-in link." };
}

export async function signUp(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const roleRaw = String(formData.get("role") ?? "buyer");
  const role = roleRaw === "supplier" ? "supplier" : "buyer";
  if (!email || !password) return { error: "Email and password are required." };
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createSupabaseServerClient();
  const origin = await siteOrigin();
  const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent(
    role === "supplier" ? "/supplier" : "/app",
  )}`;
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo, data: { role } },
  });
  if (error) return { error: error.message };

  // H4 — best-effort welcome email. Never fail signup if mail breaks.
  try {
    await sendEmail({
      to: email,
      template: "welcome",
      data: { appUrl: origin, role },
      refId: `welcome:${email}`,
    });
  } catch (err) {
    const msg = err instanceof EmailError ? err.message : String(err);
    console.warn(`[signup] welcome email failed: ${msg}`);
  }

  return {
    info: "Account created. Check your inbox to confirm the email address.",
  };
}

export async function requestPasswordReset(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Email is required." };

  const supabase = await createSupabaseServerClient();
  const origin = await siteOrigin();
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(
    "/reset-password",
  )}`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  if (error) return { error: error.message };
  return { info: "If that email exists, a reset link has been sent." };
}

export async function updatePassword(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expired. Request a new reset link." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  redirect("/app");
}
