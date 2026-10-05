// The Team page's read: `workspace_team()` under the buyer's session. A failed read is null, never an
// empty team: a page drawn over nothing would say "1 person" about a team it could not read.

import { parseTeam, type TeamDoc } from "./model";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the Supabase server client, as the other loaders take it.
type Client = any;

export async function loadTeam(supabase: Client): Promise<TeamDoc | null> {
  try {
    const { data, error } = await supabase.rpc("workspace_team");
    return error ? null : parseTeam(data);
  } catch {
    return null;
  }
}
