// /app/compliance/expiry: certificate expiry on the v4 frame (B6c, Paper `10 · Compliance · certificate
// expiry, expired first`, `11 · Alerts · certificate expiry`). Every certificate on the saved suppliers
// that has lapsed with no renewal on file (most recent first), then every one lapsing inside 90 days
// (soonest first), in three groups under `?show=`, one ask each. The two reads stand on their own: a
// failed one is said, and the other still lists.

import { ExpiryHead, ExpiryList, ExpiryNone } from "@/components/compliance/expiry";
import { PartialNote } from "@/components/compliance/hub";
import { loadCompliance } from "@/components/compliance/load";
import { expiryCounts, expiryGroups, parseShow } from "@/components/compliance/words";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Certificate expiry · SourceBD" };

export default async function ExpiryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const show = parseShow(sp.show);
  const supabase = await createSupabaseServerClient();
  const today = new Date();
  const d = await loadCompliance(supabase, { certs: true, msa: true });
  const groups = expiryGroups(d.expired, d.expiring, today);
  const counts = expiryCounts(groups);
  const anyRead = d.expired !== null || d.expiring !== null;
  const shown = show === "all" ? counts.all : show === "expired" ? counts.expired : show === "30" ? counts.within30 : counts.within90;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ExpiryHead groups={groups} saved={d.msa?.total_saved ?? null} show={show} />
      {anyRead && (d.expired === null || d.expiring === null) ? (
        <div className="px-6 pb-3 max-md:px-4">
          <PartialNote missing={d.expired === null ? "expired" : "expiring"} />
        </div>
      ) : null}
      {anyRead && shown > 0 ? <ExpiryList groups={groups} show={show} /> : <ExpiryNone show={show} anyRead={anyRead} />}
    </div>
  );
}
