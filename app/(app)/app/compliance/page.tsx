// /app/compliance: the Compliance hub on the v4 frame (B6c, Paper `10 · Compliance · needs attention,
// ranked`, `11 · Alerts`). The certificates that need a look (expired with no renewal on file, then
// those lapsing inside 90 days), one ask each, and a 344 column: the UFLPA counts, the modern slavery
// statement, the expiry dates. The count in the heading, the landing's block and the sidebar badge are
// ONE function (`attentionOf`), so they agree by construction.
//
// Every read stands on its own: a failed one is said in the card that needed it and never turned into
// "nothing needs attention". Paper's sanctions-lists block is not here: no read carries a
// lists-last-read date for the whole saved list. Download CSV writes the certificate list when both
// reads worked (`/api/v1/export`); Paper's evidence pack for auditors is gap 8.

import { AttentionCard, AttentionError, ExpiryCard, HubEmpty, HubHead, MsaCard, PartialNote, PhoneUflpaNote, UflpaCard } from "@/components/compliance/hub";
import { loadCompliance } from "@/components/compliance/load";
import { COMPLIANCE_HREF, attention } from "@/components/compliance/words";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Compliance · SourceBD" };

export default async function CompliancePage() {
  const supabase = await createSupabaseServerClient();
  const today = new Date();
  const d = await loadCompliance(supabase, { certs: true, uflpa: true, msa: true });
  const att = attention(d.expired, d.expiring, today);
  const saved = d.msa?.total_saved ?? null;
  if (d.msa && d.msa.total_saved === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <HubHead saved={0} />
        <HubEmpty />
      </div>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <HubHead saved={saved} download={att !== null && att.total > 0 && d.expired !== null && d.expiring !== null} />
      <div className="flex gap-6 px-6 py-5 max-lg:flex-col max-md:gap-0 max-md:px-0 max-md:py-0">
        <div className="flex min-w-0 flex-1 flex-col gap-4 max-md:gap-0">
          <PhoneUflpaNote uflpa={d.uflpa} saved={saved} />
          {att === null ? (
            <div className="max-md:px-4">
              <AttentionError retryHref={COMPLIANCE_HREF} />
            </div>
          ) : (
            <>
              {d.expired === null || d.expiring === null ? (
                <div className="max-md:px-4 max-md:pb-3">
                  <PartialNote missing={d.expired === null ? "expired" : "expiring"} />
                </div>
              ) : null}
              <AttentionCard attention={att} />
            </>
          )}
        </div>
        <aside aria-label="Checks" className="flex w-details shrink-0 flex-col gap-4 max-lg:w-auto max-md:px-4 max-md:py-4">
          <UflpaCard uflpa={d.uflpa} />
          <MsaCard msa={d.msa} />
          <ExpiryCard expiring={d.expiring} today={today} />
        </aside>
      </div>
    </div>
  );
}
