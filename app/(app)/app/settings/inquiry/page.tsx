// Settings · Inquiry (/app/settings/inquiry): the questions a new RFQ asks and
// the message it opens with. Reads `settings_get().inquiry`; a reply without
// it shows the composer's own defaults.

import { ErrorNote, Page } from "@/components/dashboard/page";
import { inquiryOf, type SettingsDoc, SettingsFrame, SettingsHeader } from "@/components/dashboard/settings";
import { SettingsInquiryForm } from "@/components/settings-inquiry-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function InquiryPageBody() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("settings_get");
  const settings = error ? null : ((data ?? null) as SettingsDoc | null);

  return (
    <>
      <SettingsHeader settings={settings} />
      <SettingsFrame current="inquiry">
        {settings ? (
          <SettingsInquiryForm initial={inquiryOf(settings)} />
        ) : (
          // Defaults drawn over a failed read would let a save replace the buyer's own questions.
          <ErrorNote>Could not load your RFQ defaults. Reload the page to try again; nothing has changed.</ErrorNote>
        )}
      </SettingsFrame>
    </>
  );
}

export default async function SettingsInquiryPage() {
  return <Page>{await InquiryPageBody()}</Page>;
}
