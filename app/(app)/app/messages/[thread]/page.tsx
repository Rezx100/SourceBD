// /app/messages/[thread]: one conversation on the v4 frame (B6a, Paper `10 · Messages · thread`,
// `· thread with record beside`, `11 · thread`). The list beside it (360; gone on a phone, where the
// header's arrow goes back), the supplier's name and RFQ, the strip of the RFQ's facts, the
// messages with their composer. The first 50 messages are read here so the first paint is complete
// and RLS-checked; `ThreadLive` takes over for new ones.
//
//   ?record=<slug>   the supplier's record in a 344 column beside the conversation (a drawer under
//                    1280, a sheet on a phone); Hide record and Close return to this thread.
//   ?show= and ?q=   the list's tab and search, kept so the list does not forget them.
//
// An id that is not a conversation of the caller's is a 404, so no `loading.tsx` sits above this
// route (a Suspense boundary would commit a 200 before `notFound()` ran). A failed read is not a
// 404: it says so and offers a retry.

import { notFound } from "next/navigation";
import { ErrorPanel, buttonClass } from "@/components/kit";
import Link from "next/link";
import { BesideRecord } from "@/components/messages/beside";
import { RfqBar, RfqLinkBar, ThreadHead } from "@/components/messages/conversation";
import { InboxView } from "@/components/messages/inbox";
import { InboxColumn, InboxError } from "@/components/messages/list";
import { loadInbox, readMessages, readRfq } from "@/components/messages/load";
import { ColumnNotice, RecordColumn } from "@/components/messages/record-column";
import { ThreadLive } from "@/components/messages/thread-live";
import { parseQuery, parseShow, phoneStripLine, quoteWords, rfqStrip, threadHref } from "@/components/messages/words";
import { ProfileReadTimeout, loadRecordSheet } from "@/lib/dashboard/load-record";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Messages · SourceBD" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || null;

export default async function ThreadPage({ params, searchParams }: { params: Promise<{ thread: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { thread: threadId } = await params;
  if (!UUID_RE.test(threadId)) notFound();
  const sp = await searchParams;
  const state = { show: parseShow(sp.show), q: parseQuery(sp.q) };
  const recordSlug = one(sp.record);
  const supabase = await createSupabaseServerClient();
  const now = new Date();

  const [inbox, messages] = await Promise.all([loadInbox(supabase), readMessages(supabase, threadId)]);
  // "Not a participant" is the one answer that says the conversation is not this buyer's.
  if (messages.kind === "denied") notFound();

  if (inbox.rows === null) {
    // Without the list there is no name to draw and no way to say the thread is missing: not a 404.
    return (
      <div data-detail="" className="flex min-h-0 flex-1 max-md:min-h-dvh">
        <InboxColumn className="max-md:hidden">
          <InboxError retryHref={threadHref(threadId, state)} />
        </InboxColumn>
        <section aria-label="Conversation" className="flex min-w-0 flex-1 flex-col p-6 max-md:p-4">
          <ErrorPanel
            title="We couldn't load this conversation."
            retry={
              <Link href={threadHref(threadId, state)} prefetch={false} className={buttonClass({ kind: "primary" })}>
                Try again
              </Link>
            }
          >
            Nothing has been lost. Your messages are safe.
          </ErrorPanel>
        </section>
      </div>
    );
  }

  const thread = inbox.rows.find((t) => t.id === threadId);
  if (!thread) notFound();

  const closeHref = threadHref(threadId, state);
  const recordOpen = recordSlug !== null;
  const sameCompany = recordSlug !== null && recordSlug === thread.supplier_slug;
  const [rfq, record] = await Promise.all([
    readRfq(supabase, thread.rfq_id),
    sameCompany
      ? loadRecordSheet(supabase, recordSlug, now, { closeHref, supplierId: thread.supplier_id }).then(
          (model) => ({ model, slow: false }),
          (err: unknown) => ({ model: null, slow: err instanceof ProfileReadTimeout }),
        )
      : Promise.resolve(null),
  ]);
  const strip = rfqStrip(rfq, thread.supplier_id);

  return (
    <div data-detail="" className="flex min-h-0 flex-1 max-md:min-h-dvh">
      <InboxView inbox={inbox} state={state} currentId={threadId} now={now} className="max-md:hidden" />
      <section aria-label="Conversation" className="flex min-w-0 flex-1 flex-col">
        <ThreadHead thread={thread} state={state} recordOpen={recordOpen} />
        {strip ? <RfqBar strip={strip} /> : thread.rfq_id ? <RfqLinkBar rfqId={thread.rfq_id} /> : null}
        <ThreadLive
          key={threadId}
          threadId={threadId}
          initialMessages={messages.kind === "ok" ? messages.messages : []}
          supplierName={thread.supplier_name}
          today={now.toISOString()}
          phoneLine={strip ? phoneStripLine(strip) : null}
          phoneHref={strip ? `/app/rfqs?open=${encodeURIComponent(strip.rfqId)}` : null}
          readFailed={messages.kind === "error"}
        />
      </section>
      {recordOpen ? (
        <BesideRecord title={record?.model?.name ?? thread.supplier_name} closeHref={closeHref}>
          {record?.model ? (
            <RecordColumn model={record.model} today={now} rfq={rfq} quote={rfq ? quoteWords(rfq, thread.supplier_id) : null} closeHref={closeHref} />
          ) : (
            <ColumnNotice slow={record?.slow ?? false} retryHref={threadHref(threadId, state, recordSlug)} closeHref={closeHref} />
          )}
        </BesideRecord>
      ) : null}
    </div>
  );
}
