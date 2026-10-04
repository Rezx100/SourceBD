// Company details at its own address: the phone's page (its list links here) and the link the RFQ
// composer gives for a missing company name. From 768 it is the same page as /app/settings.

import { CompanyPage } from "@/components/settings/company-page";
import { loadSettings } from "@/components/settings/load";
import { COMPANY_PHONE_HREF } from "@/components/settings/words";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Company details · SourceBD" };

export default async function SettingsWorkspacePage() {
  const doc = await loadSettings(await createSupabaseServerClient());
  return <CompanyPage doc={doc} retryHref={COMPANY_PHONE_HREF} />;
}
