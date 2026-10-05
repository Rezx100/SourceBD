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

import { Empty, ErrorPanel, rowLinkClass } from "@/components/kit";
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
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Messages</h1>
        <p className="text-md text-ink-2">Buyer inquiries against your claimed companies.</p>
      </header>

      {error ? (
        <ErrorPanel title="Could not load your inbox." />
      ) : threads.length === 0 ? (
        <Empty icon={ChatCircleText} title="No buyer inquiries yet.">
          When a buyer opens a thread against one of your claimed
          companies it will appear here.
        </Empty>
      ) : (
        <ul
          aria-label="Conversations"
          className="m-0 flex list-none flex-col overflow-clip rounded-md border border-line p-0"
        >
          {threads.map((t) => (
            <li
              key={t.id}
              className="relative flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 hover:bg-brand-wash"
            >
              <ChatCircleText size={20} className="shrink-0 text-ink-3" aria-hidden />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/supplier/messages/${t.id}`}
                  className={`${rowLinkClass} block truncate after:absolute after:inset-0 after:content-['']`}
                >
                  {buyerLabel(t)}
                </Link>
                <p className="truncate text-sm text-ink-3">
                  {t.subject ?? "General inquiry"} · {t.supplier_name} ·{" "}
                  {t.message_count.toLocaleString()}{" "}
                  {t.message_count === 1 ? "message" : "messages"}
                </p>
              </div>
              <span className="shrink-0 text-xs text-ink-3">
                {fmtRelative(t.last_message_at ?? t.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
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
