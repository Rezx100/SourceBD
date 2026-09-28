// /app/messages/[thread] — one conversation (Spec B6), in the dashboard kit.
//
// Server-renders the thread list and the initial 50 messages via
// `thread_messages(...)` so the first paint is complete + RLS-validated, then
// mounts the `<ThreadRealtime/>` client island for Realtime row-insert events
// and the composer. Desktop: the list beside the conversation; phone: the
// conversation alone, with a Back link to the list.
//
//   ?record=<slug>   the supplier's record in the pane beside the conversation;
//                    the thread list steps aside so the two share the width,
//                    and Close returns to this thread.

import { notFound } from "next/navigation";

import { Button } from "@/components/dashboard/controls";
import { ConversationHeader, Inbox, threadHref, type InboxThread } from "@/components/dashboard/inbox";
import { ErrorNote, PageHeader, Page } from "@/components/dashboard/page";
import { RecordBeside, readRecordBeside } from "@/components/dashboard/record-beside";
import { formatCount } from "@/lib/dashboard/facts";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { ThreadRealtime } from "./thread-realtime";
import type { ThreadMessage } from "./thread-realtime";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Params = { thread: string };
type SearchParams = Record<string, string | string[] | undefined>;

async function ThreadPageBody({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams?: Promise<SearchParams>;
}) {
  const { thread: threadId } = await params;
  if (!UUID_RE.test(threadId)) notFound();
  const sp = (await searchParams) ?? {};
  const recordSlug = (Array.isArray(sp.record) ? sp.record[0] : sp.record)?.trim() || null;
  const closeHref = threadHref(threadId);

  const supabase = await createSupabaseServerClient();

  const [listRes, msgRes, record] = await Promise.all([
    supabase.rpc("thread_list"),
    supabase.rpc("thread_messages", { p_thread_id: threadId, p_limit: 50 }),
    recordSlug ? readRecordBeside(supabase, recordSlug, closeHref) : Promise.resolve(null),
  ]);

  if (msgRes.error) {
    if (/not a participant/i.test(msgRes.error.message)) notFound();
  }

  const allThreads = (listRes.data ?? []) as InboxThread[];
  const thread = allThreads.find((t) => t.id === threadId);
  if (!thread) notFound();

  const messages = (msgRes.data ?? []) as ThreadMessage[];

  return (
    // From `lg` the inbox fills the content region under the header and its
    // panes scroll on their own; the frame chain below is what lets it.
    <div className="flex flex-col gap-5 lg:min-h-0 lg:flex-1">
      <PageHeader
        title="Messages"
        caption={`${formatCount(allThreads.length)} ${allThreads.length === 1 ? "conversation" : "conversations"} with suppliers`}
        actions={
          <Button href="/app/discover" clientNav>
            Find a supplier
          </Button>
        }
      />
      <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1 lg:flex-row">
        <Inbox threads={allThreads} error={false} currentId={threadId} recordOpen={record !== null}>
          <ConversationHeader thread={thread} recordOpen={record !== null} />
          {msgRes.error ? (
            <ErrorNote className="mx-4 mt-3">
              Earlier messages could not be read just now. Nothing has been lost — reload in a moment.
            </ErrorNote>
          ) : null}
          <ThreadRealtime threadId={threadId} initialMessages={messages} supplierName={thread.supplier_name} />
        </Inbox>
        {record ? <RecordBeside read={record} closeHref={closeHref} retryHref={threadHref(threadId, record.slug)} /> : null}
      </div>
    </div>
  );
}

export default async function ThreadPage(props: Parameters<typeof ThreadPageBody>[0]) {
  return <Page className="lg:min-h-0 lg:flex-1">{await ThreadPageBody(props)}</Page>;
}
