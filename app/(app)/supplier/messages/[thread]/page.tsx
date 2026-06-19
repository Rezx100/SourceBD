// /supplier/messages/[thread] — single thread (Spec S3).
//
// Server-renders the initial 50 messages via `thread_messages(...)` then
// mounts `<ThreadRealtime/>` for Realtime row-insert events + composer.
// The composer POSTs `{ action: "send", thread_id, body }` to
// `/api/v1/messages`, which since Spec S3 also accepts supplier-role
// callers (the RPC's own participant check stays the security boundary).

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChatCircleText } from "@phosphor-icons/react/dist/ssr";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MasterDetail } from "@/components/ui/master-detail";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { ThreadRealtime } from "./thread-realtime";
import type { ThreadMessage } from "./thread-realtime";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Params = { thread: string };

type ThreadRow = {
  id: string;
  supplier_id: string;
  supplier_name: string;
  supplier_slug: string;
  supplier_entity_type: string;
  buyer_email: string | null;
  buyer_display_name: string | null;
  viewer_role: "buyer" | "supplier";
  subject: string | null;
  last_message_at: string | null;
  message_count: number;
};

export default async function SupplierThreadPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { thread: threadId } = await params;
  if (!UUID_RE.test(threadId)) notFound();

  const supabase = await createSupabaseServerClient();

  const [listRes, msgRes] = await Promise.all([
    supabase.rpc("thread_list"),
    supabase.rpc("thread_messages", { p_thread_id: threadId, p_limit: 50 }),
  ]);

  if (msgRes.error) {
    if (/not a participant/i.test(msgRes.error.message)) notFound();
  }

  const allThreads = (listRes.data ?? []) as ThreadRow[];
  const thread = allThreads.find((t) => t.id === threadId);
  if (!thread || thread.viewer_role !== "supplier") notFound();

  const messages = (msgRes.data ?? []) as ThreadMessage[];

  return (
    <MasterDetail
      mode="detail"
      className="mx-auto h-full max-w-6xl"
      list={<ThreadListPane items={allThreads} activeId={threadId} />}
      detail={
        <div className="flex h-full flex-col">
          <header className="mb-4 flex items-center justify-between gap-3 lg:hidden">
            <Button asChild variant="ghost" size="sm">
              <Link
                href="/supplier/messages"
                className="inline-flex items-center gap-1.5"
              >
                <ArrowLeft size={14} weight="bold" aria-hidden /> Inbox
              </Link>
            </Button>
          </header>

          <div className="mb-3 flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate font-display text-xl font-semibold tracking-tightish text-ink-primary">
                  {buyerLabel(thread)}
                </h1>
                <Badge tone="neutral">Buyer</Badge>
              </div>
              <p className="text-[11px] text-ink-tertiary">
                {thread.subject ?? "General inquiry"} · {thread.supplier_name}
              </p>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-hairline bg-surface-l1 shadow-[0_1px_2px_rgba(15,15,20,0.03)]">
            <ThreadRealtime threadId={threadId} initialMessages={messages} />
          </div>
        </div>
      }
    />
  );
}

function ThreadListPane({
  items,
  activeId,
}: {
  items: ThreadRow[];
  activeId: string;
}) {
  const threads = items.filter((t) => t.viewer_role === "supplier");
  return (
    <nav className="rounded-card border border-hairline bg-surface-l1">
      <p className="border-b border-hairline px-3 py-2 font-mono text-[11px] uppercase tracking-[0.05em] text-ink-tertiary">
        Messages
      </p>
      <ul className="m-0 flex max-h-[70vh] list-none flex-col overflow-y-auto p-0">
        {threads.map((t) => (
          <li key={t.id} className="border-b border-hairline last:border-b-0">
            <Link
              href={`/supplier/messages/${t.id}`}
              className={`flex items-center gap-2 px-3 py-2.5 transition hover:bg-brand-forest-tint ${
                t.id === activeId ? "bg-brand-forest-tint" : ""
              }`}
            >
              <ChatCircleText
                size={16}
                weight="duotone"
                className="shrink-0 text-accent-indigo"
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-ink-primary">
                  {buyerLabel(t)}
                </span>
                <span className="block truncate text-[11px] text-ink-tertiary">
                  {t.subject ?? "General inquiry"}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function buyerLabel(t: ThreadRow) {
  const n = (t.buyer_display_name ?? "").trim();
  if (n.length > 0) return n;
  return t.buyer_email ?? "Buyer";
}
