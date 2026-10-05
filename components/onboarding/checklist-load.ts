// What the getting-started card reads (Paper `20 Onboarding` 7), under the buyer's own session: whether
// they hid it, how many suppliers they saved, whether they opened a source, their RFQs, the alerts
// setting, their template, their team. Each read stands alone and is soft: a failed one is null (no
// tick, no count), never a "0 saved" or a wrong tick. Once the card is hidden nothing else is read.

import { checklistOf, type Checklist, type Facts } from "@/lib/checklist";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the Supabase server client, as the other loaders take it.
type Client = any;

const soft = async <T,>(read: () => PromiseLike<T> | T): Promise<T | null> => {
  try {
    return await read();
  } catch {
    return null;
  }
};

const countOf = (r: { count?: number | null; error?: unknown } | null): number | null => (r && !r.error && typeof r.count === "number" ? r.count : null);

export async function loadChecklistFacts(supabase: Client, userId: string): Promise<Facts | null> {
  const profile = await soft(() => supabase.from("profiles").select("onboarding_state").eq("id", userId).maybeSingle());
  const state = profile && !profile.error && profile.data && typeof profile.data.onboarding_state === "object" ? (profile.data.onboarding_state as Record<string, unknown> | null) : null;
  // Without the profile we know neither whether it was hidden nor whether a source was opened.
  if (!state && (!profile || profile.error)) return null;
  if (state?.checklist_dismissed_at) return { saved: null, sourceChecked: null, rfqs: null, alertsOn: null, template: null, invited: null, dismissed: true };

  const [saved, rfqs, settings, team] = await Promise.all([
    soft(() => supabase.from("saved_suppliers").select("supplier_id", { count: "exact", head: true })),
    soft(() => supabase.from("rfqs").select("id", { count: "exact", head: true }).eq("buyer_id", userId)),
    soft(() => supabase.rpc("settings_get")),
    soft(() => supabase.rpc("workspace_team")),
  ]);

  const doc = settings && !settings.error && settings.data && typeof settings.data === "object" ? (settings.data as { notifications?: { saved_alerts?: unknown }; inquiry?: { email_template?: unknown } | null }) : null;
  const t = team && !team.error && team.data && typeof team.data === "object" ? (team.data as { members?: unknown; invites?: unknown }) : null;
  const people = t && Array.isArray(t.members) && Array.isArray(t.invites) ? Math.max(0, t.members.length - 1) + t.invites.length : null;

  return {
    saved: countOf(saved),
    sourceChecked: Boolean(state?.source_checked_at),
    rfqs: countOf(rfqs),
    alertsOn: doc && typeof doc.notifications?.saved_alerts === "boolean" ? doc.notifications.saved_alerts : null,
    template: doc ? typeof doc.inquiry?.email_template === "string" && doc.inquiry.email_template.trim().length > 0 : null,
    invited: people,
    dismissed: false,
  };
}

/** The card's model, or null when it should not be drawn (hidden, finished, or nothing could be read). */
export async function loadChecklist(supabase: Client, userId: string | null | undefined): Promise<Checklist | null> {
  if (!userId) return null;
  const facts = await loadChecklistFacts(supabase, userId);
  return facts ? checklistOf(facts) : null;
}
