// /app/messages: the buyer's inbox on the v4 frame (B6a, Paper `10 · Messages empty`, `11 ·
// Messages`). The conversations in a 360 list (the whole width on a phone) with a search, an All
// tab and, where `thread_list` carries 0112's keys, an Unread and a "No reply yet" tab; a
// conversation opens at /app/messages/[id]. A row's last line and its unread mark come from
// `thread_list` itself; on a database without 0112 there is no line and no mark.
//
// A failed `thread_list` is an error where the list was: "no conversations" is a claim about the
// account that a failed read cannot make. In the `(list)` group so its loading state does not wrap
// `messages/[thread]`, which answers 404 for a conversation that is not the caller's.

import { InboxView } from "@/components/messages/inbox";
import { InboxEmpty, PickPrompt } from "@/components/messages/list";
import { loadInbox } from "@/components/messages/load";
import { parseQuery, parseShow } from "@/components/messages/words";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Messages · SourceBD" };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const state = { show: parseShow(sp.show), q: parseQuery(sp.q) };
  const supabase = await createSupabaseServerClient();
  const inbox = await loadInbox(supabase);
  if (inbox.rows !== null && inbox.rows.length === 0) return <InboxEmpty />;
  return (
    <div className="flex min-h-0 flex-1">
      <InboxView inbox={inbox} state={state} currentId={null} now={new Date()} />
      <PickPrompt />
    </div>
  );
}
