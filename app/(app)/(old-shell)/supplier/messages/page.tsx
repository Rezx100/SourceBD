// /supplier/messages — supplier inbox (Spec S3).
//
// Mirrors the buyer-side `/app/messages` page but renders the buyer
// counterpart (display_name → email fallback) instead of the supplier
// counterpart. Calls the same `public.thread_list()` RPC; migration
// 0035 added `viewer_role` + `buyer_email` + `buyer_display_name` so
// both viewers share one function. Threads with `viewer_role='buyer'`
// (i.e. the supplier user is themselves the buyer of some other
// conversation — admin or self-claimed-supplier-as-buyer edge cases)
// are filtered out so the supplier inbox is unambiguously inbound.

import Link from "next/link";
import { ChatCircleText } from "@phosphor-icons/react/dist/ssr";

import { Card, CardContent } from "@/components/ui/card";
import { MasterDetail } from "@/components/ui/master-detail";
import { PageHeader } from "@/components/ui/page-kit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Thread = {
  id: string;
  buyer_id: string;
  supplier_id: string;
  supplier_slug: string;
  supplier_name: string;
  supplier_entity_type: string;
  buyer_email: string | null;
  buyer_display_name: string | null;
  viewer_role: "buyer" | "supplier";
  rfq_id: string | null;
  subject: string | null;
  last_message_at: string | null;
  updated_at: string;
  created_at: string;
  message_count: number;
};

export default async function SupplierMessagesPage() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("thread_list");
  const all: Thread[] = error || data == null ? [] : (data as Thread[]);
  const threads = all.filter((t) => t.viewer_role === "supplier");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        kicker="Supplier"
        title="Messages"
        description="Buyer inquiries against your claimed companies."
      />

      <MasterDetail
        mode="list"
        list={
          error ? (
            <Card>
              <CardContent className="text-sm text-sem-red">
                Could not load your inbox.
              </CardContent>
            </Card>
          ) : threads.length === 0 ? (
            <Card>
              <CardContent className="space-y-3 py-8 text-center">
                <ChatCircleText
                  size={32}
                  weight="duotone"
                  className="mx-auto text-ink-tertiary"
                  aria-hidden
                />
                <p className="text-sm text-ink-secondary">
                  No buyer inquiries yet.
                </p>
                <p className="text-[13px] text-ink-tertiary">
                  When a buyer opens a thread against one of your claimed
                  companies it will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="px-0 py-0">
                <ul className="m-0 flex list-none flex-col p-0">
                  {threads.map((t) => (
                    <li
                      key={t.id}
                      className="border-b border-hairline last:border-b-0"
                    >
                      <Link
                        href={`/supplier/messages/${t.id}`}
                        className="flex items-center gap-3 px-4 py-3 transition hover:bg-brand-forest-tint focus:outline-none focus-visible:bg-brand-forest-tint"
                      >
                        <ChatCircleText
                          size={20}
                          weight="duotone"
                          className="text-accent-indigo"
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-display text-sm font-semibold text-ink-primary">
                              {buyerLabel(t)}
                            </span>
                          </div>
                          <p className="truncate text-[13px] text-ink-tertiary">
                            {t.subject ?? "General inquiry"} ·{" "}
                            {t.supplier_name} ·{" "}
                            {t.message_count.toLocaleString()}{" "}
                            {t.message_count === 1 ? "message" : "messages"}
                          </p>
                        </div>
                        <span className="font-mono text-[12px] text-ink-tertiary">
                          {fmtRelative(t.last_message_at ?? t.created_at)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )
        }
        detail={
          <div className="hidden h-full items-center justify-center rounded-card border border-hairline bg-surface-l1 p-10 text-sm text-ink-tertiary shadow-[0_1px_2px_rgba(15,15,20,0.03)] lg:flex">
            <span>Select a conversation to read it here.</span>
          </div>
        }
      />
    </div>
  );
}

function buyerLabel(t: Thread) {
  const n = (t.buyer_display_name ?? "").trim();
  if (n.length > 0) return n;
  return t.buyer_email ?? "Buyer";
}

function fmtRelative(iso: string) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const delta = Date.now() - t;
  const day = 86_400_000;
  if (delta < 60_000) return "just now";
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < day) return `${Math.floor(delta / 3_600_000)}h ago`;
  if (delta < 30 * day) return `${Math.floor(delta / day)}d ago`;
  return new Date(iso).toLocaleDateString();
}
