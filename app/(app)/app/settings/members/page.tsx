// /app/settings/members on the v4 frame (gap 4, Paper `10 · Settings · Team and roles`): the people on
// the account, the invites waiting, Invite people, and for the owner a role chooser and a menu on each
// person. Read through `workspace_team()` (migration 0111); a failed read is an error, never a team of
// one drawn from nothing. Until 0111 is applied the read fails and the page says so.

import { SettingsShell } from "@/components/settings/shell";
import { loadSettings } from "@/components/settings/load";
import { InviteButton, LeaveButton, TeamActionsProvider } from "@/components/team/actions";
import { loadTeam } from "@/components/team/load";
import { countsLine, isOwner, joinedWords } from "@/components/team/model";
import { TeamError, TeamView } from "@/components/team/view";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Team and roles · SourceBD" };

export default async function SettingsMembersPage({ searchParams }: { searchParams?: Promise<{ joined?: string }> } = {}) {
  const supabase = await createSupabaseServerClient();
  const [doc, team, sp] = await Promise.all([loadSettings(supabase), loadTeam(supabase), searchParams ?? Promise.resolve({} as { joined?: string })]);
  const me = team?.members.find((m) => m.isYou);
  return (
    <TeamActionsProvider>
      <SettingsShell
        current="team"
        doc={doc}
        title="Team and roles"
        wide
        caption={team ? countsLine(team) : undefined}
        action={team ? isOwner(team) ? <InviteButton /> : me ? <LeaveButton me={me} /> : undefined : undefined}
      >
        {team ? <TeamView team={team} now={new Date()} joined={sp.joined === "1" ? joinedWords(team) : null} /> : <TeamError />}
      </SettingsShell>
    </TeamActionsProvider>
  );
}
