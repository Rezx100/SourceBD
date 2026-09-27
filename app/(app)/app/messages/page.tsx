// /app/messages — the buyer's inbox (Spec B6), in the dashboard kit.
//
// Server component. Calls `public.thread_list()` under the caller's session
// and draws the two-pane inbox: the thread list, and on desktop an empty
// conversation pane. Message bodies are NOT read here — only metadata. Bodies
// live on `/app/messages/[thread]`.

import { Button } from "@/components/dashboard/controls";
import { Inbox, type InboxThread } from "@/components/dashboard/inbox";
import { PageHeader, Page } from "@/components/dashboard/page";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function MessagesPageBody() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("thread_list");
  const threads: InboxThread[] = error || data == null ? [] : (data as InboxThread[]);

  return (
    // From `lg` the inbox fills the content region under the header and its
    // two panes scroll on their own; the frame chain below is what lets it.
    <div className="flex flex-col gap-5 lg:min-h-0 lg:flex-1">
      <PageHeader
        title="Messages"
        caption={
          error
            ? "Your conversations with suppliers."
            : `${threads.length.toLocaleString()} ${threads.length === 1 ? "conversation" : "conversations"} with suppliers`
        }
        actions={
          <Button href="/app/discover" clientNav>
            Find a supplier
          </Button>
        }
      />
      <Inbox threads={threads} error={Boolean(error)} />
    </div>
  );
}

export default async function MessagesPage() {
  return <Page className="lg:min-h-0 lg:flex-1">{await MessagesPageBody()}</Page>;
}
