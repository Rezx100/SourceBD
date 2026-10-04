// /app/compliance/msa: the Modern Slavery Act section 54 statement editor on the v4 frame (B6c-2,
// Paper `10 · Modern slavery statement editor`, `11 · Alerts · modern slavery statement`).
//
// Server component. Calls compliance_msa_inputs() for the saved-supplier footprint and
// compliance_uflpa_tracker() for the UFLPA counts the risk section discloses, then mounts the client
// editor, which composes the draft in the browser: sections, the document with its claims in place,
// and a rail of the claims only the buyer can confirm. A failed footprint read is an error; a failed
// tracker read leaves its result as a claim.

import { StatementEditor } from "@/components/statement/editor";
import { ScreeningNote, StatementError, StatementHead } from "@/components/statement/head";
import type { MsaInputs, MsaScreening } from "@/lib/msa-statement";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Modern slavery statement · SourceBD" };

export default async function MsaPage() {
  const supabase = await createSupabaseServerClient();
  const [msa, ufl] = await Promise.all([supabase.rpc("compliance_msa_inputs"), supabase.rpc("compliance_uflpa_tracker")]);
  // The editor needs the full footprint, not the summary the hub reads.
  const inputs = msa.error || !msa.data || typeof msa.data !== "object" ? null : (msa.data as MsaInputs);
  const screening = ufl.error || !ufl.data || typeof ufl.data !== "object" ? null : (ufl.data as MsaScreening);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <StatementHead />
      {inputs === null ? (
        <StatementError />
      ) : (
        <>
          {screening === null ? <ScreeningNote /> : null}
          <StatementEditor inputs={inputs} screening={screening} />
        </>
      )}
    </div>
  );
}
