// /app/compliance/uflpa: UFLPA checks on the v4 frame (B6c, Paper `10 · Compliance · UFLPA checks,
// populated`, `11 · Alerts · UFLPA checks`). The saved suppliers checked against the UFLPA Entity
// List: three counts and one row per supplier with its result, hits first (the RPC's order). A failed
// read is an error; "No link found" is never a clearance and says so.

import { loadCompliance } from "@/components/compliance/load";
import { UflpaEmpty, UflpaError, UflpaHead, UflpaStats, UflpaTable } from "@/components/compliance/uflpa";
import { UFLPA_HREF } from "@/components/compliance/words";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "UFLPA checks · SourceBD" };

export default async function UflpaPage() {
  const supabase = await createSupabaseServerClient();
  const d = await loadCompliance(supabase, { uflpa: true, msa: true });
  const u = d.uflpa;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <UflpaHead saved={d.msa?.total_saved ?? null} />
      <div className="flex flex-col gap-4 px-6 py-5 max-md:gap-3 max-md:px-0 max-md:py-2">
        {u === null ? (
          <div className="max-md:px-4">
            <UflpaError retryHref={UFLPA_HREF} />
          </div>
        ) : u.rows.length === 0 ? (
          <div className="max-md:px-4">
            <UflpaEmpty />
          </div>
        ) : (
          <>
            <UflpaStats uflpa={u} />
            <UflpaTable rows={u.rows} />
          </>
        )}
      </div>
    </div>
  );
}
