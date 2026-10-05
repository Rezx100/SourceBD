// Whose data a person works on (gap 4b, `0116`): on a team, the owner's; otherwise their own. The database is
// the authority (its policies key every shared row by `workspace_owner()`); this is only how the app learns the
// id it must write under, and what to say when a role may not.
//
// A read that fails, or a database without 0116, answers the person's own id: before 0116 that is exactly
// right, and after it a write under the wrong id is refused by the policy (a 403 here), never stored.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type WorkspaceClient = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- a Supabase client or a test's stand-in; `rpc` may be absent.
  rpc?: (fn: string, args?: Record<string, unknown>) => any;
};

/** `workspace_owner()`, or `ownId` when it cannot be read. */
export async function workspaceOwnerId(supabase: WorkspaceClient, ownId: string): Promise<string> {
  try {
    if (typeof supabase.rpc !== "function") return ownId;
    const { data, error } = await supabase.rpc("workspace_owner");
    return !error && typeof data === "string" && UUID_RE.test(data) ? data : ownId;
  } catch {
    return ownId;
  }
}

/**
 * May this role do this (`workspace_can`)? `true` when it cannot be asked: before 0116, or a failed read, the
 * database's own policy still decides, and refusing here would only hide a button that works.
 */
export async function workspaceCan(supabase: WorkspaceClient, action: string): Promise<boolean> {
  try {
    if (typeof supabase.rpc !== "function") return true;
    const { data, error } = await supabase.rpc("workspace_can", { p_action: action });
    return error || typeof data !== "boolean" ? true : data;
  } catch {
    return true;
  }
}

/** What a Viewer is told when they try to save. */
export const VIEWER_CANT_SAVE = "Your role can't save suppliers.";
