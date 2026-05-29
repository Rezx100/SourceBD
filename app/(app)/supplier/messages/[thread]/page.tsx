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

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    <div className="mx-auto flex h-full max-w-3xl flex-col">
      <header className="mb-4 flex items-center justify-between gap-3">
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
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-tertiary">
            {thread.subject ?? "General inquiry"} · {thread.supplier_name}
          </p>
        </div>
      </div>

      <ThreadRealtime threadId={threadId} initialMessages={messages} />
    </div>
  );
}

function buyerLabel(t: ThreadRow) {
  const n = (t.buyer_display_name ?? "").trim();
  if (n.length > 0) return n;
  return t.buyer_email ?? "Buyer";
}
