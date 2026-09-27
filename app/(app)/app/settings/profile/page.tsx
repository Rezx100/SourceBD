// Settings — Profile (Spec B10).
//
// Reads the caller's settings via `settings_get` and mounts four client
// islands: picture, display name, email and password. The picture posts to
// /api/v1/settings/avatar; the other three POST to /api/v1/settings.

import { ErrorNote, Page } from "@/components/dashboard/page";
import { type SettingsDoc, SettingsFrame, SettingsHeader } from "@/components/dashboard/settings";
import { SettingsAvatarForm } from "@/components/settings-avatar-form";
import { SettingsChangeEmailForm } from "@/components/settings-change-email-form";
import { SettingsChangePasswordForm } from "@/components/settings-change-password-form";
import { SettingsProfileForm } from "@/components/settings-profile-form";
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
          <>
            {/* Blank name and avatar forms over a failed read would let a save
                clear them. Email and password need nothing from that read, so
                a buyer can still change them. */}
            <ErrorNote>Could not load your profile. Reload the page to try again; nothing has changed.</ErrorNote>
            <SettingsChangeEmailForm currentEmail="" />
            <SettingsChangePasswordForm />
          </>
        )}
      </SettingsFrame>
    </>
  );
}

export default async function SettingsProfilePage() {
  return <Page>{await SettingsProfilePageBody()}</Page>;
}
