"use server";

// The three small writes of the first session: hide the getting-started card, say the coach mark was
// seen, and say a source was opened. Each is one `profile_onboarding_set` call (0047) under the buyer's
// own session (the database reads who from the session; nothing here names a person), and each is
// best-effort: a failure leaves the card or the note to show again, never an error page.

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";

async function setKey(key: string, value: string | boolean): Promise<boolean> {
  try {
    const sb = await createSupabaseServerClient();
    const { error } = await sb.rpc("profile_onboarding_set", { p_key: key, p_value: value });
    return !error;
  } catch {
    return false;
  }
}

/** "Hide" on the getting-started card (the X). */
export async function dismissChecklist(): Promise<void> {
  if (await setKey("checklist_dismissed_at", new Date().toISOString())) revalidatePath("/app", "layout");
}

/** "Got it" on the first-results note: it is not shown again. */
export async function dismissCoach(): Promise<boolean> {
  return setKey("coach_source_seen", true);
}

/** A source page was opened from a record: the checklist's "Check a source". */
export async function markSourceChecked(): Promise<boolean> {
  return setKey("source_checked_at", new Date().toISOString());
}
