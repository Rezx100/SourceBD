// /app/settings/notifications on the v4 frame (B7b-2, Paper `10 · Settings · Emails`, `11 · Emails`):
// Quotes, Saved suppliers and Weekly summary, each a switch that saves at once. Reads `settings_get`.
// A failed read draws no switches: switches drawn from defaults would show a preference the buyer never set.

import { EMAILS_CAPTION, EMAILS_NOTE } from "@/components/settings/emails";
import { EmailsForm } from "@/components/settings/emails-form";
import { loadSettings } from "@/components/settings/load";
import { SettingsError, SettingsShell } from "@/components/settings/shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Emails · SourceBD" };

export default async function SettingsNotificationsPage() {
  const doc = await loadSettings(await createSupabaseServerClient());
  return (
    <SettingsShell
      current="emails"
      doc={doc}
      title="Emails"
      caption={
        <>
          {EMAILS_CAPTION} <span className="text-ink-3">{EMAILS_NOTE}.</span>
        </>
      }
    >
      {doc ? <EmailsForm initial={doc.notifications} /> : <SettingsError retryHref="/app/settings/notifications" />}
    </SettingsShell>
  );
}
