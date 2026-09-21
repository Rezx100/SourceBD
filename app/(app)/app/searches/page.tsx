// REZ-B — saved searches. Live counts from discover_suppliers, cached 10 min
// on the row.

import Link from "next/link";
import { AppShell } from "@/components/dashboard/app-shell";
import { Caption, Title } from "@/components/dashboard/type";
import { loadBuyerShell } from "@/lib/dashboard/load-buyer-shell";
import { formatCount } from "@/lib/dashboard/facts";
import { runSavedSearchesGet, type SavedSearchJson } from "@/lib/saved-searches";
import { getServerRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Saved searches · SourceBD",
};

export default async function SearchesPage() {
  const supabase = await createSupabaseServerClient();
  const role = await getServerRole();
  const shell = await loadBuyerShell(supabase, "search");
  const listed = await runSavedSearchesGet({ role, supabase });
  const searches =
    listed.status === 200 && listed.body && typeof listed.body === "object"
      ? ((listed.body as { searches?: SavedSearchJson[] }).searches ?? [])
      : [];

  return (
    <AppShell sidebar={shell.sidebar} topbar={shell.topbar} mainId="main-content" screenLabel="Saved searches">
      <Title as="h1">Saved searches</Title>
      <Caption>
        {listed.status !== 200
          ? "Saved searches could not be read"
          : searches.length === 0
            ? "None saved yet. Save a search from the results panel."
            : `${formatCount(searches.length)} saved`}
      </Caption>
      {searches.length > 0 ? (
        <ul className="mt-4 divide-y divide-line-subtle rounded-md border border-line bg-surface">
          {searches.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <Link href={s.href} className="min-w-0 font-medium text-brand-ink">
                {s.name}
              </Link>
              <Caption>
                {s.last_count === null ? "count could not be read" : `${formatCount(s.last_count)} suppliers`}
              </Caption>
            </li>
          ))}
        </ul>
      ) : null}
    </AppShell>
  );
}
