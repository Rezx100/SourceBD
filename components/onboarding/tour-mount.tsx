// Spec H5 — Server wrapper for the onboarding tour client.
//
// Reads the caller's `profiles.onboarding_state` + `role` server-side and
// short-circuits to null when the tour should not render (anon caller, role
// mismatch, or tour already completed/dismissed). The DB read is the
// authoritative gate — a client that clears its localStorage cannot
// re-trigger the tour, and a client that fakes a "skip me" header has no
// effect because no client input feeds this decision.

import { createSupabaseServerClient } from "@/lib/supabase/server";

import Tour from "./tour";

type OnboardingState = {
  tour_completed_at?: string | null;
  tour_dismissed_at?: string | null;
  tour_last_step?: number | null;
};

type ProfileRow = {
  role: "buyer" | "supplier" | "admin";
  onboarding_state: OnboardingState | null;
};

type Flavour = "buyer" | "supplier";

export async function TourMount({ flavour }: { flavour: Flavour }) {
  let userId: string | null = null;
  let profile: ProfileRow | null = null;
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
    if (userId) {
      const { data } = await supabase
        .from("profiles")
        .select("role, onboarding_state")
        .eq("id", userId)
        .maybeSingle();
      profile = (data ?? null) as ProfileRow | null;
    }
  } catch {
    return null;
  }
  if (!userId || !profile) return null;
  if (profile.role !== flavour) return null;
  const st = profile.onboarding_state ?? {};
  if (st.tour_completed_at || st.tour_dismissed_at) return null;
  const initialStep =
    typeof st.tour_last_step === "number" && Number.isFinite(st.tour_last_step)
      ? st.tour_last_step
      : 0;
  return <Tour flavour={flavour} initialStep={initialStep} />;
}
