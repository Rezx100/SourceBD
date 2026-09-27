// /app/messages — the buyer's inbox (Spec B6), in the dashboard kit.
//
// Server component. Calls `public.thread_list()` under the caller's session
// and draws the two-pane inbox: the thread list, and on desktop an empty
// conversation pane. Message bodies are NOT read here — only metadata. Bodies
// live on `/app/messages/[thread]`.

import { Button } from "@/components/dashboard/controls";
import { Inbox, type InboxThread } from "@/components/dashboard/inbox";
import { PageHeader } from "@/components/dashboard/page";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/dashboard/app-shell";
import { loadBuyerShell } from "@/lib/dashboard/load-buyer-shell";

export const dynamic = "force-dynamic";

async function MessagesPageBody() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("thread_list");
  const threads: InboxThread[] = error || data == null ? [] : (data as InboxThread[]);

  return (
    <div className="flex flex-col gap-5">
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

// The kit's shell on every buyer page (one sidebar, one topbar), read in the
// same wave as the page's own data.
export default async function MessagesPage() {
  const supabase = await createSupabaseServerClient();
  const [shell, body] = await Promise.all([loadBuyerShell(supabase, "/app/messages"), MessagesPageBody()]);
  return (
    <AppShell sidebar={shell.sidebar} topbar={shell.topbar} mainId="main-content" screenLabel="Messages">
      {body}
    </AppShell>
  );
}
