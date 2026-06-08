// /app/messages/[thread] — single thread (Spec B6), FE-SITEWIDE Phase C3.
//
// Server-renders the initial 50 messages via `thread_messages(...)` so
// the first paint is complete + RLS-validated, then mounts the
// `<ThreadRealtime/>` client island for Realtime row-insert events +
// composer. Phase C3 only restyles the page chrome — ThreadRealtime
// (the actual conversation view + composer) is untouched.

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChatCircleText } from "@phosphor-icons/react/dist/ssr";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MasterDetail } from "@/components/ui/master-detail";

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
  subject: string | null;
  last_message_at: string | null;
  message_count: number;
};

export default async function ThreadPage({
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
  if (!thread) notFound();

  const messages = (msgRes.data ?? []) as ThreadMessage[];

  return (
    <MasterDetail
      mode="detail"
      className="mx-auto h-full max-w-6xl"
      list={<ThreadListPane items={allThreads} activeId={threadId} />}
      detail={
        <div className="flex h-full flex-col gap-4">
          <header className="flex items-center justify-between gap-3">
            <Link
              href="/app/messages"
              className="btn-proto inline-flex items-center gap-1.5 lg:hidden"
            >
              <ArrowLeft size={12} weight="bold" aria-hidden /> Inbox
            </Link>
            <Link
              href={`/app/discover/${thread.supplier_slug}`}
              className="btn-proto ml-auto"
            >
              View profile
            </Link>
          </header>

          <div className="proto-card">
            <div className="proto-card-head">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="header-name !text-xl">{thread.supplier_name}</h1>
                  <span className="chip">{entityLabel(thread.supplier_entity_type)}</span>
                </div>
                <p className="mt-1 text-[11px] text-ink-tertiary">
                  {thread.subject ?? "General inquiry"}
                </p>
              </div>
            </div>

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
  return (
    <nav
      aria-label="Threads"
      className="overflow-hidden rounded-[12px] border border-hairline bg-white"
    >
      <p className="border-b border-hairline px-4 py-2.5 text-[11px] font-semibold text-ink-tertiary">
        Messages
      </p>
      <ul className="m-0 flex max-h-[72vh] list-none flex-col overflow-y-auto p-0">
        {items.map((t) => {
          const active = t.id === activeId;
          return (
            <li key={t.id}>
              <Link
                href={`/app/messages/${t.id}`}
                aria-current={active ? "page" : undefined}
                className={`flex items-start gap-2.5 border-b border-hairline px-4 py-3 last:border-b-0 ${
                  active ? "bg-[#FBFAF6]" : "hover:bg-[#FBFAF6]/60"
                }`}
              >
                <ChatCircleText
                  size={16}
                  weight="duotone"
                  className="mt-0.5 shrink-0 text-brand-forest"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <span
                    className={`block truncate font-display text-[13px] text-ink-primary ${
                      active ? "font-semibold" : "font-medium"
                    }`}
                  >
                    {t.supplier_name}
                  </span>
                  <span className="block truncate text-[11px] text-ink-tertiary">
                    {t.subject ?? "General inquiry"}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function entityLabel(et: string) {
  if (et === "factory") return "Factory";
  if (et === "buying_house") return "Buying house";
  return "Supplier";
}
