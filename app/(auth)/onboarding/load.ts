// What the first-run pages read: who is signed in, what they have answered, and which step is next. A
// read that fails is null, never "nothing answered": a form drawn over blanks would let a save overwrite
// what the buyer had already given. Everything is read under the buyer's own session.

import { parseAnswers, firstStep, startPath, type BuyerAnswers, type Progress, type Step } from "@/lib/onboarding";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the Supabase server client, as the other loaders take it.
type Client = any;

export type Loaded =
  | { kind: "redirect"; to: string }
  | {
      kind: "ready";
      email: string | null;
      /** Null when the answers could not be read (a database without 0109, or an outage). */
      answers: BuyerAnswers | null;
      progress: Progress;
      /** The company type, people band and name as saved in Settings (empty strings when none). */
      step: Step | null;
      done: boolean;
    };

const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** `at` is the page's own address, so a signed-out person comes back to it after signing in. */
export async function loadOnboarding(supabase: Client, at: string): Promise<Loaded> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { kind: "redirect", to: `/login?next=${encodeURIComponent(at)}` };

  const [profile, answersRaw, settingsRaw] = await Promise.all([
    supabase.from("profiles").select("role, display_name, onboarding_state").eq("id", user.id).maybeSingle().then((r: { data: unknown }) => r.data as { role?: string; display_name?: string | null; onboarding_state?: Record<string, unknown> | null } | null).catch(() => null),
    supabase.rpc("onboarding_get_buyer").then((r: { data: unknown; error: unknown }) => (r.error ? null : r.data)).catch(() => null),
    supabase.rpc("settings_get").then((r: { data: unknown; error: unknown }) => (r.error ? null : r.data)).catch(() => null),
  ]);

  // Suppliers and admins have their own first screen; this flow is the buyer's.
  if (profile?.role === "supplier") return { kind: "redirect", to: "/supplier" };
  if (profile?.role === "admin") return { kind: "redirect", to: "/app" };

  const answers = parseAnswers(answersRaw);
  const ws = (settingsRaw && typeof settingsRaw === "object" ? ((settingsRaw as { workspace?: Record<string, unknown> }).workspace ?? {}) : {}) as Record<string, unknown>;
  const progress: Progress = {
    name: text(profile?.display_name) ?? text((settingsRaw as { display_name?: unknown } | null)?.display_name),
    company: text(ws.company_name),
    companyType: text(ws.company_type)?.toLowerCase() ?? null,
    people: text(ws.employee_count),
  };
  const done = Boolean(profile?.onboarding_state && typeof profile.onboarding_state === "object" && profile.onboarding_state.buyer_flow_done_at);
  if (done) return { kind: "redirect", to: startPath(answers?.jobRole) };

  return { kind: "ready", email: user.email ?? null, answers, progress, step: answers ? firstStep(answers, progress) : "about", done };
}
