// Settings — Notifications (Spec B10).
//
// Reads the three notification toggles via `settings_get` and mounts the
// notification-toggles client island. Each toggle change POSTs
// {action:'update_notifications', <key>:bool} to /api/v1/settings.

import { ErrorNote, Page } from "@/components/dashboard/page";
import { type SettingsDoc, SettingsFrame, SettingsHeader } from "@/components/dashboard/settings";
import { SettingsNotificationToggles } from "@/components/settings-notification-toggles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function SettingsNotificationsPageBody() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("settings_get");
  const settings = error ? null : ((data ?? null) as SettingsDoc | null);

  return (
    <>
      <SettingsHeader settings={settings} />
      <SettingsFrame current="notifications">
        <p className="m-0 max-w-prose text-base text-ink-muted">
          Choose which emails you receive. Sending starts in a later release; what you set here is recorded now, so you
          are opted in or out from the first email.
        </p>
        {settings ? (
          <SettingsNotificationToggles initial={settings.notifications} />
        ) : (
          // Switches drawn from defaults over a failed read would show a preference the buyer never set.
          <ErrorNote>Could not load your email preferences. Reload the page to try again; nothing has changed.</ErrorNote>
        )}
      </SettingsFrame>
    </>
  );
}

export default async function SettingsNotificationsPage() {
  return <Page>{await SettingsNotificationsPageBody()}</Page>;
}
