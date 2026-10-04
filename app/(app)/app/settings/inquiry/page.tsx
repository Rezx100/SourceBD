// /app/settings/inquiry on the v4 frame (B7b-2, Paper `10 · Settings · RFQ templates`): the message a new
// RFQ opens with and the questions it asks, and a preview of the message as a supplier would read it,
// filled in with the buyer's own name, company and website and the name of the supplier saved most
// recently. Reads `settings_get` (a reply without `inquiry` shows the composer's own defaults) and
// `buyer_saved_list` for the preview's supplier only; if that read fails the preview says "Supplier name".
// A failed `settings_get` draws no form: defaults over a failed read would let a save replace the
// buyer's own questions.

import { workspaceOf, inquiryOf } from "@/components/settings/doc";
import { loadSettings } from "@/components/settings/load";
import { SettingsError, SettingsShell } from "@/components/settings/shell";
import { TemplatesForm } from "@/components/settings/templates-form";
import { loadPreviewSupplier } from "@/components/settings/templates-load";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "RFQ templates · SourceBD" };

export default async function SettingsInquiryPage() {
  const supabase = await createSupabaseServerClient();
  const [doc, supplier] = await Promise.all([loadSettings(supabase), loadPreviewSupplier(supabase)]);
  const w = workspaceOf(doc);
  return (
    <SettingsShell current="templates" doc={doc} title="RFQ templates" caption="The message a new RFQ opens with. You can still edit it on each RFQ." wide>
      {doc ? (
        <TemplatesForm initial={inquiryOf(doc)} facts={{ supplier, user: doc.display_name?.trim() || null, company: w.company_name, website: w.website }} />
      ) : (
        <SettingsError retryHref="/app/settings/inquiry" />
      )}
    </SettingsShell>
  );
}
