// The one coach mark of the first results (Paper `20 Onboarding` 6): after the buyer's answers open their
// first search, a dark card says where facts come from. No tour, no steps: one note, "Got it", and it is
// not shown again (`onboarding_state.coach_source_seen`). The page asks for it with `?welcome=1`, which
// only the end of onboarding sets; a buyer who has seen it never gets it back from a stale link.

import { CoachCard } from "./coach-card";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the Supabase server client, as the other loaders take it.
type Client = any;

export async function FirstResultsCoach({ supabase, closeHref }: { supabase: Client; closeHref: string }) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase.from("profiles").select("onboarding_state").eq("id", user.id).maybeSingle();
    if (error) return null;
    const st = (data?.onboarding_state ?? {}) as Record<string, unknown>;
    if (st.coach_source_seen) return null;
  } catch {
    return null;
  }
  return <CoachCard closeHref={closeHref} />;
}
