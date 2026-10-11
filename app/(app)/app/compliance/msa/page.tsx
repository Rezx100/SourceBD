// /app/compliance/msa: the Modern Slavery Act section 54 statement editor on the v4 frame (B6c-2,
// Paper `10 · Modern slavery statement editor`, `11 · Alerts · modern slavery statement`).
//
// Server component. Calls compliance_msa_inputs() for the saved-supplier footprint and
// compliance_uflpa_tracker() for the UFLPA counts the risk section discloses, then mounts the client
// editor, which composes the draft in the browser: sections, the document with its claims in place,
// and a rail of the claims only the buyer can confirm. A failed footprint read is an error; a failed
// tracker read leaves its result as a claim. A phone draws Paper page 36 as a page of its own (its
// head has the way back, so the frame's bars step aside: `data-detail`), with "Written for you" from
// the same reads plus the certificate reads and the lists' read dates (`sanctions_lists_read()`).

import { PhoneLedger, PhoneSectionHead, PhoneSubHead } from "@/components/compliance/hub";
import { loadCompliance } from "@/components/compliance/load";
import { certLedger, listRead, shortDay, supplyLedger, uflpaLedger } from "@/components/compliance/words";
import { StatementEditor } from "@/components/statement/editor";
import { ScreeningNote, StatementError, StatementHead } from "@/components/statement/head";
import type { MsaInputs, MsaScreening } from "@/lib/msa-statement";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Buildings, Hourglass, Scales } from "@phosphor-icons/react/dist/ssr";

export const dynamic = "force-dynamic";

export const metadata = { title: "Modern slavery statement · SourceBD" };

export default async function MsaPage() {
  const supabase = await createSupabaseServerClient();
  const today = new Date();
  const [msa, ufl, d] = await Promise.all([supabase.rpc("compliance_msa_inputs"), supabase.rpc("compliance_uflpa_tracker"), loadCompliance(supabase, { certs: true, lists: true })]);
  // The editor needs the full footprint, not the summary the hub reads.
  const inputs = msa.error || !msa.data || typeof msa.data !== "object" ? null : (msa.data as MsaInputs);
  const screening = ufl.error || !ufl.data || typeof ufl.data !== "object" ? null : (ufl.data as MsaScreening);
  const written = inputs ? (
    <>
      <PhoneSectionHead title="Written for you" aside={`As at ${shortDay(today.toISOString(), today)}`} />
      <PhoneLedger
        rows={[
          { key: "supply", icon: Buildings, label: "Supply chain", ledger: supplyLedger(inputs) },
          { key: "uflpa", icon: Scales, label: "UFLPA", ledger: uflpaLedger(screening, listRead(d.lists, "uflpa"), today) },
          { key: "certs", icon: Hourglass, label: "Certificates", ledger: certLedger(d.expired, d.expiring, today) },
        ]}
      />
    </>
  ) : null;
  return (
    <div data-detail="" className="flex min-h-0 flex-1 flex-col">
      <StatementHead />
      <PhoneSubHead title="Modern slavery statement" line="UK Modern Slavery Act 2015, section 54" />
      {inputs === null ? (
        <StatementError />
      ) : (
        <>
          {screening === null ? <ScreeningNote /> : null}
          <StatementEditor inputs={inputs} screening={screening} written={written} />
        </>
      )}
    </div>
  );
}
