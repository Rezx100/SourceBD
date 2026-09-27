// /app/messages/[thread] — one conversation (Spec B6), in the dashboard kit.
//
// Server-renders the thread list and the initial 50 messages via
// `thread_messages(...)` so the first paint is complete + RLS-validated, then
// mounts the `<ThreadRealtime/>` client island for Realtime row-insert events
// and the composer. Desktop: the list beside the conversation; phone: the
// conversation alone, with a Back link to the list.

import { notFound } from "next/navigation";

import { Button } from "@/components/dashboard/controls";
import { ConversationHeader, Inbox, type InboxThread } from "@/components/dashboard/inbox";
import { ErrorNote, PageHeader } from "@/components/dashboard/page";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { ThreadRealtime } from "./thread-realtime";
import type { ThreadMessage } from "./thread-realtime";
import { AppShell } from "@/components/dashboard/app-shell";
import { loadBuyerShell } from "@/lib/dashboard/load-buyer-shell";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Params = { thread: string };

async function ThreadPageBody({
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

  const allThreads = (listRes.data ?? []) as InboxThread[];
  const thread = allThreads.find((t) => t.id === threadId);
  if (!thread) notFound();

  const messages = (msgRes.data ?? []) as ThreadMessage[];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Messages"
        caption={`${allThreads.length.toLocaleString()} ${allThreads.length === 1 ? "conversation" : "conversations"} with suppliers`}
        actions={
          <Button href="/app/discover" clientNav>
            Find a supplier
          </Button>
        }
      />
      <Inbox threads={allThreads} error={false} currentId={threadId}>
        <ConversationHeader thread={thread} />
        {msgRes.error ? (
          <ErrorNote className="mx-4 mt-3">
            Earlier messages could not be read just now. Nothing has been lost — reload in a moment.
          </ErrorNote>
        ) : null}
        <ThreadRealtime threadId={threadId} initialMessages={messages} supplierName={thread.supplier_name} />
      </Inbox>
    </div>
  );
}

// The kit's shell on every buyer page (one sidebar, one topbar), read in the
// same wave as the page's own data.
export default async function ThreadPage(props: Parameters<typeof ThreadPageBody>[0]) {
  const supabase = await createSupabaseServerClient();
  const [shell, body] = await Promise.all([loadBuyerShell(supabase, "/app/messages/x"), ThreadPageBody(props)]);
  return (
    <AppShell sidebar={shell.sidebar} topbar={shell.topbar} mainId="main-content" screenLabel="Conversation">
      {body}
    </AppShell>
  );
}
