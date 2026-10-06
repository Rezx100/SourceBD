// Phase 7 P3 — Admin feedback queue.

import { AdminColumn, AdminHead, AdminSection } from "@/components/admin/data-ui";
import { Button, Empty, InlineError, TabLink, TypeChip } from "@/components/kit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  user_id: string | null;
  page_path: string;
  message: string;
  status: string;
  created_at: string;
  user_email: string | null;
};

type Doc = { total: number; rows: Row[] };

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status === "triaged" || sp.status === "closed" ? sp.status : "open";

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("feedback_admin_list", {
    p_status: status,
    p_limit: 50,
    p_offset: 0,
  });

  const doc = (data ?? null) as Doc | null;

  return (
    <AdminColumn narrow>
      <AdminHead title="User feedback" lede="Notes buyers send from Send feedback in the account menu." />

      <nav aria-label="Feedback status" className="flex gap-1 border-b border-line">
        {(["open", "triaged", "closed"] as const).map((s) => (
          <TabLink key={s} href={`/admin/feedback?status=${s}`} current={status === s} className="capitalize">
            {s}
          </TabLink>
        ))}
      </nav>

      {error ? (
        <InlineError>Could not load feedback: {error.message}</InlineError>
      ) : !doc || doc.rows.length === 0 ? (
        <Empty title="No feedback in this queue">{`There are no ${status} reports right now.`}</Empty>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {doc.rows.map((row) => (
            <li key={row.id}>
              <AdminSection>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-xs text-ink-3">
                        {new Date(row.created_at).toISOString().replace("T", " ").slice(0, 19)} UTC
                      </p>
                      <p className="mt-1 text-base text-ink-2">
                        {row.user_email ?? "Unknown user"} · <span className="font-mono text-sm">{row.page_path}</span>
                      </p>
                    </div>
                    <TypeChip className="capitalize">{row.status}</TypeChip>
                  </div>
                  <p className="whitespace-pre-wrap text-base text-ink">{row.message}</p>
                  {row.status === "open" ? (
                    <form action={`/api/v1/admin/feedback/${row.id}`} method="post">
                      <input type="hidden" name="status" value="triaged" />
                      <Button type="submit" kind="secondary">
                        Mark triaged
                      </Button>
                    </form>
                  ) : null}
                </div>
              </AdminSection>
            </li>
          ))}
        </ul>
      )}
    </AdminColumn>
  );
}
