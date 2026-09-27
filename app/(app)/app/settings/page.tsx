// Settings · Workspace (/app/settings, and /app/settings/workspace).
//
// Server component. Reads `settings_get` and mounts the company-info form over
// its `workspace` fields. A reply without `workspace` (the RPC before it
// learnt the field) is an empty workspace, not an error; a failed read is an
// error, and draws no form a save could blank the company from.

import { ErrorNote, Page } from "@/components/dashboard/page";
import { type SettingsDoc, SettingsFrame, SettingsHeader, workspaceOf } from "@/components/dashboard/settings";
import { SettingsWorkspaceForm } from "@/components/settings-workspace-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function WorkspacePageBody() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("settings_get");
  const settings = error ? null : ((data ?? null) as SettingsDoc | null);

  return (
    <>
      <SettingsHeader settings={settings} />
      <SettingsFrame current="workspace">
        {settings ? (
          <SettingsWorkspaceForm initial={workspaceOf(settings)} />
        ) : (
          <ErrorNote>Could not load your company info. Reload the page to try again; nothing has changed.</ErrorNote>
        )}
      </SettingsFrame>
    </>
  );
}

export default async function SettingsWorkspacePage() {
  return <Page>{await WorkspacePageBody()}</Page>;
}
