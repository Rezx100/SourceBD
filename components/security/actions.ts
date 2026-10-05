"use server";

// Security's writes (Paper `10 · Settings · Security`): turn two-step sign-in on and off (Supabase Auth MFA,
// TOTP) and end devices (0115 and Auth's own sign-out). Each runs under the buyer's own session; nothing here
// names a person. A refusal is a sentence the page shows under the field, never Auth's own words.

import { revalidatePath } from "next/cache";

import { codeRefusal } from "./model";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Started = { factorId: string; qr: string; secret: string; error: null } | { factorId?: undefined; qr?: undefined; secret?: undefined; error: string };
/** `ok` and a sentence: a plain pair, not a union, so the test build (not strict) narrows it the same way. */
export type Done = { ok: boolean; error: string | null };

const SIGNED_OUT = "Your session ended. Sign in again to carry on.";
const TRY_AGAIN = "We could not do that just now. Nothing was changed; try again in a minute.";
const BAD_CODE = "That code doesn't match. Use the code showing in your app now.";
const RATE = "Too many tries just now. Wait a minute and try again.";

const rate = (m: string) => /rate limit|too many|security purposes/i.test(m);

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the Supabase server client, as the other loaders take it.
async function signedIn(): Promise<{ sb: any } | null> {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  return user ? { sb } : null;
}

/** Step one of turning it on: a new authenticator factor and its QR code and secret. Leftover unfinished ones are removed first. */
export async function startTwoStep(): Promise<Started> {
  const s = await signedIn();
  if (!s) return { error: SIGNED_OUT };
  try {
    const listed = await s.sb.auth.mfa.listFactors();
    for (const f of (listed.data?.all ?? []) as { id: string; factor_type: string; status: string }[]) {
      if (f.factor_type === "totp" && f.status !== "verified") await s.sb.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await s.sb.auth.mfa.enroll({ factorType: "totp", friendlyName: `Authenticator app ${new Date().toISOString().slice(0, 19)}` });
    if (error || !data?.totp?.qr_code || !data?.totp?.secret) return { error: error && rate(error.message) ? RATE : TRY_AGAIN };
    return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret, error: null };
  } catch {
    return { error: TRY_AGAIN };
  }
}

/** Step two: the code from the app proves it is set up. This session becomes a two-step session. */
export async function finishTwoStep(factorId: string, code: string): Promise<Done> {
  const clean = String(code ?? "").replace(/\s+/g, "");
  const refused = codeRefusal(clean);
  if (refused) return { ok: false, error: refused };
  if (typeof factorId !== "string" || !factorId) return { ok: false, error: TRY_AGAIN };
  const s = await signedIn();
  if (!s) return { ok: false, error: SIGNED_OUT };
  try {
    const { error } = await s.sb.auth.mfa.challengeAndVerify({ factorId, code: clean });
    if (error) return { ok: false, error: rate(error.message) ? RATE : BAD_CODE };
    // Every other device signs in again, and with the code: a session opened before two-step was on does not
    // learn of it until its token is refreshed (up to an hour), so the others are ended now. Best effort: the
    // two-step setting itself is already on, and the middleware refuses a session once it knows.
    try {
      await s.sb.auth.signOut({ scope: "others" });
    } catch {
      // Left to expire.
    }
    revalidatePath("/app/settings/security");
    return { ok: true, error: null };
  } catch {
    return { ok: false, error: TRY_AGAIN };
  }
}

/** Closing the dialog before the code: the unfinished factor is removed so it is not left half set up. */
export async function cancelTwoStep(factorId: string): Promise<void> {
  const s = await signedIn();
  if (!s || typeof factorId !== "string" || !factorId) return;
  try {
    const listed = await s.sb.auth.mfa.listFactors();
    const f = ((listed.data?.all ?? []) as { id: string; status: string }[]).find((x) => x.id === factorId);
    // Only an unfinished factor is removed here: turning off a working one asks for a code.
    if (f && f.status !== "verified") await s.sb.auth.mfa.unenroll({ factorId });
  } catch {
    // Left for the next start to clear.
  }
}

/** Turning it off asks for a current code, so a lifted session cannot switch the protection off. */
export async function turnOffTwoStep(code: string): Promise<Done> {
  const clean = String(code ?? "").replace(/\s+/g, "");
  const refused = codeRefusal(clean);
  if (refused) return { ok: false, error: refused };
  const s = await signedIn();
  if (!s) return { ok: false, error: SIGNED_OUT };
  try {
    const listed = await s.sb.auth.mfa.listFactors();
    const factor = ((listed.data?.totp ?? []) as { id: string }[])[0];
    if (!factor) return { ok: false, error: TRY_AGAIN };
    const verified = await s.sb.auth.mfa.challengeAndVerify({ factorId: factor.id, code: clean });
    if (verified.error) return { ok: false, error: rate(verified.error.message) ? RATE : BAD_CODE };
    const { error } = await s.sb.auth.mfa.unenroll({ factorId: factor.id });
    if (error) return { ok: false, error: TRY_AGAIN };
    revalidatePath("/app/settings/security");
    return { ok: true, error: null };
  } catch {
    return { ok: false, error: TRY_AGAIN };
  }
}

/** Sign out one other device. The database refuses this device's own session and anyone else's. */
export async function endDevice(sessionId: string): Promise<Done> {
  if (typeof sessionId !== "string" || !/^[0-9a-f-]{36}$/i.test(sessionId)) return { ok: false, error: TRY_AGAIN };
  const s = await signedIn();
  if (!s) return { ok: false, error: SIGNED_OUT };
  try {
    const { error } = await s.sb.rpc("account_session_end", { p_session_id: sessionId });
    if (error) return { ok: false, error: TRY_AGAIN };
    revalidatePath("/app/settings/security");
    // The call answers false for a session that is not there or is this one; either way nothing is left to end.
    return { ok: true, error: null };
  } catch {
    return { ok: false, error: TRY_AGAIN };
  }
}

/** "Sign out everywhere else": every session but this one, through Auth. */
export async function signOutOtherDevices(): Promise<Done> {
  const s = await signedIn();
  if (!s) return { ok: false, error: SIGNED_OUT };
  try {
    const { error } = await s.sb.auth.signOut({ scope: "others" });
    if (error) return { ok: false, error: TRY_AGAIN };
    revalidatePath("/app/settings/security");
    return { ok: true, error: null };
  } catch {
    return { ok: false, error: TRY_AGAIN };
  }
}
