// /app/settings/subscription on the v4 frame (B7b-2, Paper `10 · Settings · Plan and usage`; the old
// /app/settings/plan address redirects here). Read-only: the plan from `settings_get`, that billing is
// not set up, and what Enterprise adds. Paper's "This month" shows the one count a read gives:
// evidence packs downloaded (0114); the others are not here (no read gives them).
// No plan lists contact details: no plan unlocks them (founder, 25 Sep 2026). Without the read the plan
// is not known, and naming one would be a guess.

import { loadPackCount, loadSettings } from "@/components/settings/load";
import { PLAN_CAPTION, PlanPanel } from "@/components/settings/plan";
import { SettingsError, SettingsShell } from "@/components/settings/shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Plan and usage · SourceBD" };

export default async function SettingsSubscriptionPage() {
  const supabase = await createSupabaseServerClient();
  const [doc, packs] = await Promise.all([loadSettings(supabase), loadPackCount(supabase, new Date())]);
  return (
    <SettingsShell current="plan" doc={doc} title="Plan and usage" caption={PLAN_CAPTION}>
      {doc ? <PlanPanel doc={doc} packs={packs} /> : <SettingsError retryHref="/app/settings/subscription" />}
    </SettingsShell>
  );
}
