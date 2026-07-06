// Phase 7 P3 — Admin feedback queue.

import Link from "next/link";

import {
  AdminEmptyState,
  AdminPage,
  AdminPageHeader,
  AdminPanel,
} from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
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
    <AdminPage maxWidth="4xl">
      <AdminPageHeader
        kicker="Admin · Feedback"
        title="User feedback"
        description="In-app notes submitted via the ? hotkey or the floating feedback button."
        actions={
          <div className="flex flex-wrap gap-2">
            {(["open", "triaged", "closed"] as const).map((s) => (
              <Link
                key={s}
                href={`/admin/feedback?status=${s}`}
                className={
                  "rounded-pill border px-3 py-1.5 text-[13px] font-medium capitalize " +
                  (status === s
                    ? "border-brand-forest/30 bg-brand-forest-soft text-brand-forest"
                    : "border-neutral-200 text-ink-secondary hover:bg-neutral-50")
                }
              >
                {s}
              </Link>
            ))}
          </div>
        }
      />

      {error ? (
        <AdminPanel>
          <p className="text-sm text-sem-red">Could not load feedback: {error.message}</p>
        </AdminPanel>
      ) : !doc || doc.rows.length === 0 ? (
        <AdminEmptyState
          title="No feedback in this queue"
          description={`There are no ${status} reports right now.`}
        />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {doc.rows.map((row) => (
            <li key={row.id}>
              <AdminPanel className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-[12px] text-ink-tertiary">
                      {new Date(row.created_at).toISOString().replace("T", " ").slice(0, 19)} UTC
                    </p>
                    <p className="mt-1 text-sm text-ink-secondary">
                      {row.user_email ?? "Unknown user"} ·{" "}
                      <span className="font-mono text-[13px]">{row.page_path}</span>
                    </p>
                  </div>
                  <span className="rounded-pill border border-neutral-200 px-2 py-0.5 text-[12px] capitalize text-ink-tertiary">
                    {row.status}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-primary">
                  {row.message}
                </p>
                {row.status === "open" ? (
                  <form action={`/api/v1/admin/feedback/${row.id}`} method="post">
                    <input type="hidden" name="status" value="triaged" />
                    <Button type="submit" variant="secondary" className="min-h-[44px]">
                      Mark triaged
                    </Button>
                  </form>
                ) : null}
              </AdminPanel>
            </li>
          ))}
        </ul>
      )}
    </AdminPage>
  );
}
