"use server";

// Server actions for sign-up, sign-in, the email link and the password reset (Spec F3, rebuilt for v4).
// Email and password, or a link by email; no Google or Microsoft (D-5).
//
// Where a person lands is decided here, never by a hidden field alone: `safeNext` lets only a same-origin
// path through. The address a link or email went to is kept for an hour in an httpOnly cookie, so the
// "Check your email" pages can name it and offer a resend without putting it in a URL.

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  AUTH_EMAIL_COOKIE,
  AUTH_NEXT_COOKIE,
  EXISTS,
  LINK_SENT_WORD,
  WRONG_SIGN_IN,
  WRONG_SIGN_IN_HELP,
  emailRefusal,
  passwordRefusal,
  safeNext,
  signInRefusal,
  signUpRefusal,
  type AuthActionState,
} from "@/components/auth/words";
import { AppOriginError, getCanonicalAppOrigin } from "@/lib/app-origin";
import { RESET_WINDOW_SEC, signedInWithin } from "@/lib/recent-sign-in";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendEmail, EmailError } from "@/lib/email/send";

const ONE_HOUR = 60 * 60;

async function rememberEmail(email: string, next?: string) {
  const jar = await cookies();
  const opts = { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: ONE_HOUR } as const;
  jar.set(AUTH_EMAIL_COOKIE, email, opts);
  // Where the confirmation email should lead, so a resend keeps an invite or a record the person was heading to.
  if (next) jar.set(AUTH_NEXT_COOKIE, next, opts);
  else jar.delete(AUTH_NEXT_COOKIE);
}

async function originOrError(): Promise<{ origin: string } | { error: string }> {
  try {
    return { origin: getCanonicalAppOrigin(await headers()) };
  } catch (err) {
    return { error: err instanceof AppOriginError ? err.message : "Unable to build auth redirect URL." };
  }
}

export async function signInWithPassword(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? ""));
  if (emailRefusal(email)) return { error: emailRefusal(email)!, field: "email" };
  if (!password) return { error: "Enter your password.", field: "password" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const why = signInRefusal(error.message);
    if (why === "unconfirmed") {
      await rememberEmail(email);
      redirect("/signup/verify");
    }
    if (why === "rate") return { error: "Too many attempts just now. Wait a minute and try again." };
    return { error: WRONG_SIGN_IN, kind: "wrong", info: WRONG_SIGN_IN_HELP };
  }

  revalidatePath("/", "layout");
  redirect(next);
}

export async function signInWithMagicLink(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = safeNext(String(formData.get("next") ?? ""));
  if (emailRefusal(email)) return { error: emailRefusal(email)!, field: "email" };

  const o = await originOrError();
  if ("error" in o) return { error: o.error };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${o.origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) {
    if (/rate limit|too many|security purposes/i.test(error.message)) return { error: "Too many attempts just now. Wait a minute and try again." };
    return { error: "We could not send the link just now. Check the address and try again.", field: "email" };
  }
  await rememberEmail(email);
  redirect("/login/sent");
}

export async function signUp(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "buyer") === "supplier" ? "supplier" : "buyer";
  // Where the person was going when they chose to sign up (an invite link, a record): kept through the
  // confirmation email. Only a same-origin path counts; otherwise their own home.
  const home = role === "supplier" ? "/supplier" : "/app";
  const next = safeNext(String(formData.get("next") ?? ""), home);
  if (emailRefusal(email)) return { error: emailRefusal(email)!, field: "email" };
  if (passwordRefusal(password)) return { error: passwordRefusal(password)!, field: "password" };

  const o = await originOrError();
  if ("error" in o) return { error: o.error };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${o.origin}/auth/callback?next=${encodeURIComponent(next)}`, data: { role } },
  });
  if (error) {
    const r = signUpRefusal(error.message);
    return { error: r.error, field: r.field ?? undefined, kind: r.error === EXISTS ? "exists" : undefined };
  }
  // Supabase answers a sign-up for an address that already has an account with a user that has no
  // identities (so a stranger cannot tell which addresses are registered by the error).
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { error: EXISTS, field: "email", kind: "exists" };
  }

  // Best effort: a welcome email must never fail the sign-up.
  try {
    await sendEmail({ to: email, template: "welcome", data: { appUrl: o.origin, role }, refId: `welcome:${email}` });
  } catch (err) {
    console.warn(`[signup] welcome email failed: ${err instanceof EmailError ? err.message : String(err)}`);
  }

  // With email confirmation off there is a session already; otherwise the link in the email makes one.
  if (data.session) {
    revalidatePath("/", "layout");
    redirect(next);
  }
  await rememberEmail(email, next);
  redirect("/signup/verify");
}

/** "Resend the email" on the verify page: the address is the one the cookie holds, never one from the form. */
export async function resendSignupEmail(): Promise<AuthActionState> {
  const jar = await cookies();
  const email = jar.get(AUTH_EMAIL_COOKIE)?.value;
  if (!email) return { error: "That page has timed out. Enter your email again." };
  const next = safeNext(jar.get(AUTH_NEXT_COOKIE)?.value);
  const o = await originOrError();
  if ("error" in o) return { error: o.error };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${o.origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) {
    if (/rate limit|too many|security purposes/i.test(error.message)) return { error: "Too many emails just now. Wait a minute and try again." };
    return { error: "We could not send it just now. Try again in a minute." };
  }
  return { info: LINK_SENT_WORD };
}

/** "Wrong email? Change it": forget the address and go back to the form. */
export async function changeSignupEmail(): Promise<void> {
  const jar = await cookies();
  jar.delete(AUTH_EMAIL_COOKIE);
  jar.delete(AUTH_NEXT_COOKIE);
  redirect("/signup");
}

export async function requestPasswordReset(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (emailRefusal(email)) return { error: emailRefusal(email)!, field: "email" };

  const o = await originOrError();
  if ("error" in o) return { error: o.error };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${o.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
  });
  if (error && /rate limit|too many|security purposes/i.test(error.message)) return { error: "Too many attempts just now. Wait a minute and try again." };
  // Any other answer is the same to the caller: the page never says whether the address has an account.
  await rememberEmail(email);
  redirect("/forgot-password/sent");
}

export async function updatePassword(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const password = String(formData.get("password") ?? "");
  if (passwordRefusal(password)) return { error: passwordRefusal(password)!, field: "password" };
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expired. Request a new reset link." };
  // This action asks for no current password, so it serves only a session that has just come through
  // a reset link. Any older session changes its password in Settings, which asks for the current one (ST-03).
  const { data: claims } = await supabase.auth.getClaims();
  if (!signedInWithin(claims?.claims.amr, RESET_WINDOW_SEC)) {
    return { error: "This reset link has expired. Request a new one." };
  }
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "We could not save that password. Use at least 8 characters, and avoid a common one.", field: "password" };
  revalidatePath("/", "layout");
  redirect("/app");
}
