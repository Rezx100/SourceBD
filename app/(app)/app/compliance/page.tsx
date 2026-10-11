// /app/compliance: the Compliance hub on the v4 frame (B6c, Paper `10 · Compliance · needs attention,
// ranked`, `11 · Alerts`). The certificates that need a look (expired with no renewal on file, then
// those lapsing inside 90 days), one ask each, and a 344 column: the UFLPA counts, the modern slavery
// statement, the expiry dates. The count in the heading, the landing's block and the sidebar badge are
// ONE function (`attentionOf`), so they agree by construction.
//
// Every read stands on its own: a failed one is said in the card that needed it and never turned into
// "nothing needs attention". A phone draws Paper page 36's hub (`PhoneHub`): the four checks as a
// ledger, sanctions among them (`compliance_msa_inputs.sanctions_hits`, `sanctions_lists_read()`), and
// what needs a look as cards; from 768 the layout below is unchanged. Download CSV writes the
// certificate list when both reads worked (`/api/v1/export`). "Download an evidence pack" is a dialog (`components/compliance/
// evidence-pack.tsx`, gap 8, CSV only) shown whenever the saved count was read.

import { Suspense } from "react";
import { AttentionCard, AttentionError, ExpiryCard, HubEmpty, HubHead, MsaCard, PartialNote, PhoneHub, UflpaCard } from "@/components/compliance/hub";
import { loadCompliance } from "@/components/compliance/load";
import { COMPLIANCE_HREF, attention } from "@/components/compliance/words";
import { ChecklistSlot } from "@/components/onboarding/checklist";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Compliance · SourceBD" };

/** Who is signed in, for the getting-started card only: a failed read is no card, never a failed page. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the Supabase server client, as the other loaders take it.
async function whoIs(supabase: any): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return typeof data?.user?.id === "string" ? data.user.id : null;
  } catch {
    return null;
  }
}

export default async function CompliancePage() {
  const supabase = await createSupabaseServerClient();
  const today = new Date();
  const [d, who] = await Promise.all([loadCompliance(supabase, { certs: true, uflpa: true, msa: true, lists: true }), whoIs(supabase)]);
  // The getting-started card, at the top of Alerts on a phone (a sidebar card from 1440, drawn by the layout).
  const started = (
    <Suspense fallback={null}>
      <ChecklistSlot supabase={supabase} userId={who} variant="phone" />
    </Suspense>
  );
  const att = attention(d.expired, d.expiring, today);
  const saved = d.msa?.total_saved ?? null;
  if (d.msa && d.msa.total_saved === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {started}
        <HubHead saved={0} />
        <HubEmpty />
      </div>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {started}
      <HubHead saved={saved} download={att !== null && att.total > 0 && d.expired !== null && d.expiring !== null} pack={saved !== null} />
      <PhoneHub data={d} today={today} />
      <div className="flex gap-6 px-6 py-5 max-lg:flex-col max-md:hidden">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {att === null ? (
            <div>
              <AttentionError retryHref={COMPLIANCE_HREF} />
            </div>
          ) : (
            <>
              {d.expired === null || d.expiring === null ? (
                <div>
                  <PartialNote missing={d.expired === null ? "expired" : "expiring"} />
                </div>
              ) : null}
              <AttentionCard attention={att} />
            </>
          )}
        </div>
        <aside aria-label="Checks" className="flex w-details shrink-0 flex-col gap-4 max-lg:w-auto">
          <UflpaCard uflpa={d.uflpa} />
          <MsaCard msa={d.msa} />
          <ExpiryCard expiring={d.expiring} today={today} />
        </aside>
      </div>
    </div>
  );
}
