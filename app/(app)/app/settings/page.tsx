// /app/settings on the v4 frame (B7b, Paper `10 · Settings`, `11 · Settings · grouped list`): from 768
// the first page of the navigation, Company details; on a phone the grouped list of every page.
// `settings_get` is read once. A reply without `workspace` is an empty company, not an error; a failed
// read is an error and draws no form a save could blank the company from.

import { CompanyPage } from "@/components/settings/company-page";
import { loadSettings } from "@/components/settings/load";
import { SettingsError, SettingsIndex } from "@/components/settings/shell";
import { SETTINGS_HOME } from "@/components/settings/words";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Settings · SourceBD" };

export default async function SettingsPage() {
  const doc = await loadSettings(await createSupabaseServerClient());
  return (
    <>
      <div className="flex min-h-0 flex-1 max-md:hidden">
        <CompanyPage doc={doc} retryHref={SETTINGS_HOME} />
      </div>
      {doc ? (
        <SettingsIndex doc={doc} />
      ) : (
        <div className="p-4 md:hidden">
          <SettingsError retryHref={SETTINGS_HOME} />
        </div>
      )}
    </>
  );
}
