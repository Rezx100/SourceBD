"use server";

// The three first-run steps (Paper `20 Onboarding` 3 to 5). Each step posts its own answers and goes to
// the next: the name and work role, the company, then what the buyer sources. The buyer's identity is
// the session's, never a field; every answer is refused here as the database would, under its own field.
// Writes go through `onboarding_save_buyer` (0109) and the settings RPCs (0106), the same ones Settings uses.

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  TERMS_VERSION,
  aboutRefusal,
  companyRefusal,
  firstResultsHref,
  headingsOf,
  isCertKind,
  sourceRefusal,
  stepHref,
  type Refusal,
} from "@/lib/onboarding";
import type { CertKind } from "@/lib/discover-v32-state";

export type StepState = { error?: string; field?: string };

const NOT_SAVED = "We could not save that just now. Nothing was lost; try again in a moment.";
const SIGNED_OUT = "Your session ended. Sign in again to carry on.";

const fail = (r: Refusal): StepState => ({ error: r.message, field: r.field });
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the Supabase server client, as the other loaders take it.
async function signedIn(): Promise<{ sb: any } | null> {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  return user ? { sb } : null;
}

export async function saveAbout(_prev: StepState, fd: FormData): Promise<StepState> {
  const name = str(fd, "name").trim();
  const role = str(fd, "role");
  const refused = aboutRefusal({ name, role });
  if (refused) return fail(refused);
  const s = await signedIn();
  if (!s) return { error: SIGNED_OUT };
  // The terms are accepted by signing up; the server stamps the time when the version is first sent (0109).
  const [profile, buyer] = await Promise.all([
    s.sb.rpc("settings_update_profile", { p_display_name: name }),
    s.sb.rpc("onboarding_save_buyer", { p_input: { job_role: role, terms_version: TERMS_VERSION } }),
  ]);
  if (profile.error || buyer.error) return { error: NOT_SAVED };
  redirect(stepHref("company"));
}

export async function saveCompany(_prev: StepState, fd: FormData): Promise<StepState> {
  const input = { company: str(fd, "company").trim(), type: str(fd, "type"), country: str(fd, "country"), people: str(fd, "people") };
  const refused = companyRefusal(input);
  if (refused) return fail(refused);
  const s = await signedIn();
  if (!s) return { error: SIGNED_OUT };
  const [ws, buyer] = await Promise.all([
    s.sb.rpc("settings_update_workspace", { p_input: { company_name: input.company, company_type: input.type, employee_count: input.people } }),
    s.sb.rpc("onboarding_save_buyer", { p_input: { company_country: input.country } }),
  ]);
  if (ws.error || buyer.error) return { error: NOT_SAVED };
  redirect(stepHref("source"));
}

export async function saveSource(_prev: StepState, fd: FormData): Promise<StepState> {
  const hs = headingsOf(fd.getAll("hs"));
  const certs = fd.getAll("cert").map(String);
  const markets = fd.getAll("market").map(String);
  const refused = sourceRefusal({ hs, certs, markets });
  if (refused) return fail(refused);
  const s = await signedIn();
  if (!s) return { error: SIGNED_OUT };
  const saved = await s.sb.rpc("onboarding_save_buyer", { p_input: { sourcing_hs_headings: hs, required_cert_kinds: certs, sell_markets: markets } });
  if (saved.error) return { error: NOT_SAVED };
  // The flow is done once the answers are in: from here the person is a buyer with a search, not a
  // newcomer. A failure to say so only means the first-run page may be offered again, never a lost answer.
  try {
    await s.sb.rpc("profile_onboarding_set", { p_key: "buyer_flow_done_at", p_value: new Date().toISOString() });
  } catch {
    // The query builder is a thenable, not a promise: a try, not a .catch, keeps a failure here from losing the redirect.
  }
  redirect(firstResultsHref(hs, certs.filter(isCertKind) as CertKind[]));
}
