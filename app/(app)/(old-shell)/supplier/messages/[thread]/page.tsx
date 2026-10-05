// /supplier/messages/[thread] — single thread (Spec S3).
//
// Server-renders the initial 50 messages via `thread_messages(...)` then
// mounts `<ThreadRealtime/>` for Realtime row-insert events + composer.
// The composer POSTs `{ action: "send", thread_id, body }` to
// `/api/v1/messages`, which since Spec S3 also accepts supplier-role
// callers (the RPC's own participant check stays the security boundary).

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

import { TypeChip, linkClass } from "@/components/kit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

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
    <div className="mx-auto grid w-full max-w-[1200px] items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <ThreadListPane items={allThreads} activeId={threadId} />
      <div className="flex min-w-0 flex-col gap-4">
        <Link
          href="/supplier/messages"
          className={cn(linkClass, "inline-flex items-center gap-1.5 text-sm lg:hidden")}
        >
          <ArrowLeft size={16} aria-hidden /> Inbox
        </Link>

        <header className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-ink">
              {buyerLabel(thread)}
            </h1>
            <TypeChip>Buyer</TypeChip>
          </div>
          <p className="text-md text-ink-2">
            {thread.subject ?? "General inquiry"} · {thread.supplier_name}
          </p>
        </header>

        <div className="flex min-h-0 flex-col overflow-clip rounded-md border border-line">
          <ThreadRealtime
            threadId={threadId}
            initialMessages={messages}
            today={new Date().toISOString()}
          />
        </div>
      </div>
    </div>
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
    <nav aria-label="Messages" className="rounded-md border border-line max-lg:hidden">
      <p className="border-b border-line px-3 py-2 text-xs font-medium text-ink-3">
        Messages
      </p>
      <ul className="m-0 flex max-h-[70vh] list-none flex-col overflow-y-auto p-0">
        {threads.map((t) => (
          <li key={t.id} className="border-b border-line last:border-b-0">
            <Link
              href={`/supplier/messages/${t.id}`}
              aria-current={t.id === activeId ? "page" : undefined}
              className={cn(
                "flex flex-col px-3 py-2.5 outline-none hover:bg-brand-wash focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand",
                t.id === activeId && "bg-brand-tint",
              )}
            >
              <span className="block truncate text-base font-medium text-ink">
                {buyerLabel(t)}
              </span>
              <span className="block truncate text-xs text-ink-3">
                {t.subject ?? "General inquiry"}
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
