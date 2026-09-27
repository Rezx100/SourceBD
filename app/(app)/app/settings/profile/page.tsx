// Settings — Profile (Spec B10).
//
// Reads the caller's settings via `settings_get` and mounts four client
// islands: picture, display name, email and password. The picture posts to
// /api/v1/settings/avatar; the other three POST to /api/v1/settings.

import { AppShell } from "@/components/dashboard/app-shell";
import { ErrorNote } from "@/components/dashboard/page";
import { type SettingsDoc, SettingsFrame, SettingsHeader } from "@/components/dashboard/settings";
import { SettingsAvatarForm } from "@/components/settings-avatar-form";
import { SettingsChangeEmailForm } from "@/components/settings-change-email-form";
import { SettingsChangePasswordForm } from "@/components/settings-change-password-form";
import { SettingsProfileForm } from "@/components/settings-profile-form";
import { loadBuyerShell } from "@/lib/dashboard/load-buyer-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function SettingsProfilePageBody() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("settings_get");
  const settings = error ? null : ((data ?? null) as SettingsDoc | null);

  return (
    <>
      <SettingsHeader settings={settings} />
      <SettingsFrame current="profile">
        {settings ? (
          <>
            <SettingsAvatarForm
              initialAvatarUrl={settings.avatar_url ?? null}
              displayName={settings.display_name ?? ""}
              email={settings.email ?? ""}
            />
            <SettingsProfileForm initialDisplayName={settings.display_name ?? ""} />
            <SettingsChangeEmailForm currentEmail={settings.email ?? ""} />
            <SettingsChangePasswordForm />
          </>
        ) : (
          // Blank forms over a failed read would let a save clear the name.
          <ErrorNote>Could not load your profile. Reload the page to try again; nothing has changed.</ErrorNote>
        )}
      </SettingsFrame>
    </>
  );
}

// The kit's shell on every buyer page (one sidebar, one topbar), read in the
// same wave as the page's own data.
export default async function SettingsProfilePage() {
  const supabase = await createSupabaseServerClient();
  const [shell, body] = await Promise.all([loadBuyerShell(supabase, "/app/settings/profile"), SettingsProfilePageBody()]);
  return (
    <AppShell sidebar={shell.sidebar} topbar={shell.topbar} mainId="main-content" screenLabel="Profile">
      {body}
    </AppShell>
  );
}
