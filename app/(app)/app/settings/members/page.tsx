// /app/settings/members on the v4 frame (B7b-2, Paper `10 · Settings · Team and roles`): one member
// today, the buyer who is signed in, as the owner. Team seats arrive with the Enterprise plan, so there
// is no invite, no role chooser and nothing that pretends to send one (Paper draws those as design only).

import { loadSettings } from "@/components/settings/load";
import { TEAM_CAPTION, TeamPanel } from "@/components/settings/plan";
import { SettingsError, SettingsShell } from "@/components/settings/shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Team and roles · SourceBD" };

export default async function SettingsMembersPage() {
  const doc = await loadSettings(await createSupabaseServerClient());
  return (
    <SettingsShell current="team" doc={doc} title="Team and roles" caption={TEAM_CAPTION}>
      {doc ? <TeamPanel doc={doc} /> : <SettingsError retryHref="/app/settings/members" />}
    </SettingsShell>
  );
}
