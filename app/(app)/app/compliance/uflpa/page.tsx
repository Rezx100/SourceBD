// /app/compliance/uflpa: UFLPA checks on the v4 frame (B6c, Paper `10 · Compliance · UFLPA checks,
// populated`, `11 · Alerts · UFLPA checks`). The saved suppliers checked against the UFLPA Entity
// List: three counts and one row per supplier with its result, hits first (the RPC's order). A failed
// read is an error; "No link found" is never a clearance and says so. A phone draws Paper page 36
// (`UflpaPhone`) as a page of its own: its head has the way back, so the frame's bars step aside
// (`data-detail`), and the list's read date and entry count come from `sanctions_lists_read()`.

import { loadCompliance } from "@/components/compliance/load";
import { UflpaEmpty, UflpaError, UflpaHead, UflpaPhone, UflpaStats, UflpaTable } from "@/components/compliance/uflpa";
import { UFLPA_HREF, listRead } from "@/components/compliance/words";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "UFLPA checks · SourceBD" };

export default async function UflpaPage() {
  const supabase = await createSupabaseServerClient();
  const d = await loadCompliance(supabase, { uflpa: true, lists: true });
  const u = d.uflpa;
  return (
    <div data-detail="" className="flex min-h-0 flex-1 flex-col">
      <UflpaHead />
      <UflpaPhone uflpa={u} read={listRead(d.lists, "uflpa")} today={new Date()} />
      <div className="flex flex-col gap-4 px-6 py-5 max-md:hidden">
        {u === null ? (
          <UflpaError retryHref={UFLPA_HREF} />
        ) : u.rows.length === 0 ? (
          <UflpaEmpty />
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
